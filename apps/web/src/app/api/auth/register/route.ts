import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  validatePasswordPolicy,
  generateOpaqueToken,
} from "@/lib/user-auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { sendEmailVerificationEmail } from "@/lib/email-service";
import {
  normalizeAcceptedLegalConsents,
  recordLegalAcceptance,
} from "@/lib/legal-acceptance";

export const runtime = "nodejs";

const registerSchema = z.object({
  email: z.string().email().max(191).transform((v) => v.toLowerCase()),
  password: z.string().max(200),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  legalConsents: z.object({
    termsAccepted: z.boolean(),
    disclaimerAccepted: z.boolean(),
    termsVersion: z.string().optional(),
    disclaimerVersion: z.string().optional(),
    acceptedAt: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  // Rate limit: 5 registrations per minute per IP
  const rlKey = getRateLimitKey(request, "auth:register");
  const rl = await rateLimit(rlKey, { limit: 5, windowSeconds: 60, failClosed: true });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

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

  const { email, password, firstName, lastName } = parsed.data;
  const acceptedLegalConsents = normalizeAcceptedLegalConsents(parsed.data.legalConsents);
  if (!acceptedLegalConsents) {
    return NextResponse.json(
      { error: "You must accept the Terms of Use and Legal Disclaimer before creating an account." },
      { status: 400 },
    );
  }

  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  // Is email taken?
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, deletedAt: true },
  });

  if (existing) {
    // Deliberately reject both active and soft-deleted rows. Public signup
    // must never attach a password to, or revive, an existing account.
    return NextResponse.json({ error: "Account already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
    },
  });

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

  await recordLegalAcceptance({
    userId: user.id,
    request,
    page: "/sign-up",
    source: "email_signup",
    consents: acceptedLegalConsents,
  });

  await sendEmailVerificationEmail({
    userEmail: email,
    userName: firstName || "there",
    verifyToken: token,
    dedupeKey: `verify:${user.id}:${hash}`,
  }).catch((err) => console.error("[EMAIL] verification send failed:", err));

  return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
}
