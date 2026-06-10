import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, rawPrisma } from "@/lib/db";
import {
  hashPassword,
  validatePasswordPolicy,
  generateOpaqueToken,
} from "@/lib/user-auth";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { sendEmailVerificationEmail } from "@/lib/email-service";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/config";
import { ensureSubscriptionDefaults } from "@/lib/billing";
import { ensureWorkspaceDefaults } from "@/lib/workspace-provisioning";
import { normalizeAcceptedLegalConsents, recordLegalAcceptance } from "@/lib/legal-acceptance";
import { isAllowlistedQaEmail, resetAllowlistedQaAccountForSignup } from "@/lib/qa-account";
import { sendAdminSignupAlert } from "@/lib/admin-alerts";

export const runtime = "nodejs";

const registerSchema = z.object({
  email: z.string().email().max(191).transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(200),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  // Self-attestation that the account holder meets the minimum age. Only
  // enforced when the COPPA age gate is enabled (see below); optional otherwise.
  confirmedAgeEligible: z.boolean().optional(),
  legalConsents: z
    .object({
      termsAccepted: z.boolean().optional(),
      disclaimerAccepted: z.boolean().optional(),
      termsVersion: z.string().max(50).optional(),
      disclaimerVersion: z.string().max(50).optional(),
      acceptedAt: z.string().max(100).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.errors }, { status: 400 });
  }

  const { email, password, firstName, lastName, legalConsents } = parsed.data;
  const rl = await enforceRateLimitPolicy(request, "auth_register", {
    email,
    routeId: "register",
  });
  if (!rl.success) {
    return NextResponse.json(
      { code: rl.policy.userFacingErrorCode, error: "Too many requests. Please wait." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const acceptedLegalConsents = legalConsents === undefined
    ? null
    : normalizeAcceptedLegalConsents(legalConsents);
  if (legalConsents !== undefined && !acceptedLegalConsents) {
    return NextResponse.json(
      { error: "You must accept the Terms of Use and Disclaimer before continuing.", code: "LEGAL_ACCEPTANCE_REQUIRED" },
      { status: 400 },
    );
  }

  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  // COPPA / minimum-age gate. Inert unless COPPA_AGE_GATE_ENABLED is on, so the
  // live signup is unchanged until legal flips it on at launch (doc 22-child-role).
  // When on, the caller must affirm they meet the minimum age (self-attestation;
  // a stronger birthdate-based gate can replace this in a later phase). The UI
  // surfaces the checkbox only once the flag is on.
  const ageGateOn = ["true", "1"].includes((process.env.COPPA_AGE_GATE_ENABLED || "").toLowerCase());
  if (ageGateOn && parsed.data.confirmedAgeEligible !== true) {
    return NextResponse.json(
      {
        error: "You must confirm you meet the minimum age requirement to create an account.",
        code: "AGE_CONFIRMATION_REQUIRED",
      },
      { status: 400 },
    );
  }

  const autoVerifyQaAccount = isAllowlistedQaEmail(email);

  // Is email taken?
  //
  // Use rawPrisma here: the soft-delete client extension hides
  // deletedAt != null rows from findUnique. Without the raw client we
  // would miss the soft-deleted row, fall through to user.create, and
  // trip the email-unique constraint with an unhandled 500. The intent
  // (per the comment below) is to block re-signup for soft-deleted
  // emails, so we need the raw client to *see* the deleted row.
  const existing = await rawPrisma.user.findUnique({
    where: { email },
    select: { id: true, deletedAt: true },
  });

  if (existing) {
    if (!autoVerifyQaAccount) {
      // Deliberately reject both active and soft-deleted rows. Public signup
      // must never attach a password to, or revive, an existing account.
      return NextResponse.json({ error: "Account already exists." }, { status: 409 });
    }

    const resetResult = await resetAllowlistedQaAccountForSignup({ email });
    if (!resetResult.reset) {
      return NextResponse.json(
        {
          error: "Account already exists.",
          code: "QA_ACCOUNT_RESET_BLOCKED",
        },
        { status: 409 },
      );
    }
  }

  const locale = resolveLocale(
    request.cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get("accept-language"),
  );

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      preferredLocale: locale,
      ...(autoVerifyQaAccount ? { emailVerifiedAt: new Date() } : {}),
    },
  });
  await ensureSubscriptionDefaults(user.id);
  await ensureWorkspaceDefaults(user.id);

  // Owner alert: instant new-signup notification. Fire-and-forget — the
  // helper never throws, so this can never break registration. The QA
  // account is gated here AND suppressed inside the helper (single
  // enforcement point).
  if (!autoVerifyQaAccount) {
    void sendAdminSignupAlert({
      userId: user.id,
      email,
      name: [firstName, lastName].filter(Boolean).join(" ") || null,
      source: "password",
    });
  }

  if (acceptedLegalConsents) {
    await recordLegalAcceptance({
      userId: user.id,
      request,
      page: "/sign-up",
      source: "mobile_register",
      consents: acceptedLegalConsents,
    });
  }

  if (!autoVerifyQaAccount) {
    // Email verification token (24h).
    const { token, hash } = generateOpaqueToken();
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        email,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await sendEmailVerificationEmail({
      userEmail: email,
      userName: firstName || "there",
      verifyToken: token,
      locale,
      dedupeKey: `verify:${user.id}:${hash}`,
    }).catch((err) => console.error("[EMAIL] verification send failed:", err));
  }

  return NextResponse.json(
    {
      success: true,
      userId: user.id,
      emailVerified: autoVerifyQaAccount,
      requiresEmailVerification: !autoVerifyQaAccount,
    },
    { status: 201 },
  );
}
