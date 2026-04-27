import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateOpaqueToken } from "@/lib/user-auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email-service";

export const runtime = "nodejs";
export const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If an account exists, we sent password reset instructions.";

const schema = z.object({
  email: z.string().email().max(191).transform((v) => v.toLowerCase()),
});

function genericResponse() {
  return NextResponse.json({
    success: true,
    message: GENERIC_FORGOT_PASSWORD_MESSAGE,
  });
}

export async function POST(request: NextRequest) {
  const rlKey = getRateLimitKey(request, "auth:pwreset");
  const rl = await rateLimit(rlKey, { limit: 3, windowSeconds: 60 });
  if (!rl.success) {
    console.info("[AUTH] password reset skipped", { reason: "rate_limited" });
    return genericResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return genericResponse();
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Return the same success response for malformed input to avoid enumeration.
    return genericResponse();
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      email: true,
      firstName: true,
      passwordHash: true,
      emailVerifiedAt: true,
      deletedAt: true,
      preferredLocale: true,
      oauthAccounts: { select: { id: true, provider: true } },
    },
  });

  // Always respond success; never reveal whether the account exists.
  if (!user) {
    console.info("[AUTH] password reset skipped", { reason: "unknown_email" });
    return genericResponse();
  }
  if (user.deletedAt) {
    console.info("[AUTH] password reset skipped", {
      reason: "deleted_user",
      userId: user.id,
    });
    return genericResponse();
  }

  const hasPasswordLogin = !!user.passwordHash;
  const hasOAuthLogin = user.oauthAccounts.length > 0;
  const canSendSetPasswordLink = !hasPasswordLogin && hasOAuthLogin && !!user.emailVerifiedAt;
  console.info("[AUTH] password reset user branch", {
    userId: user.id,
    hasPasswordLogin,
    hasOAuthLogin,
    emailVerified: !!user.emailVerifiedAt,
  });

  if (!hasPasswordLogin && !canSendSetPasswordLink) {
    console.info("[AUTH] password reset skipped", {
      reason: "unsupported_account_state",
      userId: user.id,
      hasOAuthLogin,
      emailVerified: !!user.emailVerifiedAt,
    });
    return genericResponse();
  }

  const { token, hash } = generateOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const sent = await sendPasswordResetEmail({
    userEmail: user.email,
    userName: user.firstName || "there",
    resetToken: token,
    mode: hasPasswordLogin ? "reset" : "set-password",
    locale: user.preferredLocale,
    dedupeKey: `pwreset:${user.id}:${hash.slice(0, 12)}`,
  }).catch((err) => {
    console.error("[EMAIL] password reset send threw:", {
      userId: user.id,
      message: err instanceof Error ? err.message : "SEND_FAILED",
    });
    return false;
  });
  console.info("[AUTH] password reset email processed", {
    userId: user.id,
    mode: hasPasswordLogin ? "reset" : "set-password",
    sent,
  });

  return genericResponse();
}
