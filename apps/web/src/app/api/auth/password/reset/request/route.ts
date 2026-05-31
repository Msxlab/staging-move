import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateOpaqueToken } from "@/lib/user-auth";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { sendPasswordResetEmail } from "@/lib/email-service";
import { extractRequestMeta } from "@/lib/audit";
import { recordUserSecurityAudit } from "@/lib/user-security-audit";

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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return genericResponse();
  }

  const parsed = schema.safeParse(body);
  const rl = await enforceRateLimitPolicy(request, "password_reset", {
    email: parsed.success ? parsed.data.email : null,
    routeId: "password_reset_request",
  });
  if (!rl.success) {
    console.info("[AUTH] password reset skipped", { reason: "rate_limited" });
    return genericResponse();
  }

  if (!parsed.success) {
    // Return the same success response for malformed input to avoid enumeration.
    return genericResponse();
  }

  // Soft-deleted users are hidden by the prisma soft-delete extension,
  // so a deleted account presents identically to an unknown email here
  // — both return null. Both branches are intentionally indistinguishable
  // in the response to avoid account enumeration.
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      email: true,
      firstName: true,
      passwordHash: true,
      emailVerifiedAt: true,
      preferredLocale: true,
      oauthAccounts: { select: { id: true, provider: true } },
    },
  });

  // Always respond success; never reveal whether the account exists.
  if (!user) {
    console.info("[AUTH] password reset skipped", { reason: "unknown_email_or_deleted" });
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

  const recentToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (recentToken) {
    console.info("[AUTH] password reset skipped", {
      reason: "recipient_rate_limited",
      userId: user.id,
    });
    return genericResponse();
  }

  const { token, hash } = generateOpaqueToken();
  // Supersede any still-valid reset token for this user so an older reset link
  // stops working the moment a new one is requested.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  recordUserSecurityAudit({
    userId: user.id,
    action: "PWRESET_REQ",
    entityId: user.id,
    changes: { status: "requested", mode: hasPasswordLogin ? "reset" : "set_password" },
    ...extractRequestMeta(request),
  });

  const sent = await sendPasswordResetEmail({
    userEmail: user.email,
    userName: user.firstName || "there",
    resetToken: token,
    mode: hasPasswordLogin ? "reset" : "set-password",
    dedupeKey: `pwreset:${user.id}:${hash}`,
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
