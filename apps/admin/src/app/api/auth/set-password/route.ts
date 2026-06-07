import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { consumeSetPasswordToken, resolveSetPasswordToken } from "@/lib/admin-invite";

export const dynamic = "force-dynamic";

// Token-gated, session-less endpoint reached from the invite email link.
// GET validates a token (so the page can render the form or an "expired"
// message); POST consumes it and sets the chosen password. Listed in the
// middleware public paths because the invitee is, by definition, not yet
// authenticated.

const setPasswordSchema = z
  .object({
    token: z.string().trim().min(16).max(256),
    newPassword: z.string().min(12).max(256),
  })
  .strict();

function passwordComplexityError(pw: string): string | null {
  if (pw.length < 12) return "Password must be at least 12 characters";
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Password must contain uppercase, lowercase, and a number";
  }
  return null;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const resolved = await resolveSetPasswordToken(token);
  if (!resolved) {
    return NextResponse.json(
      { valid: false, error: "This link is invalid or has expired." },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { valid: true, purpose: resolved.purpose, expiresAt: resolved.expiresAt.toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const requestMeta = getAuditRequestMeta(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = setPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid token and a new password are required." }, { status: 400 });
  }
  const { token, newPassword } = parsed.data;

  const complexityError = passwordComplexityError(newPassword);
  if (complexityError) {
    return NextResponse.json({ error: complexityError }, { status: 400 });
  }

  // Atomically consume the token (single-use, expiry-checked, race-safe).
  const consumed = await consumeSetPasswordToken(token);
  if (!consumed) {
    return NextResponse.json(
      { error: "This link is invalid or has expired. Ask an admin to re-send the invitation." },
      { status: 400 },
    );
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: consumed.adminUserId },
    select: { id: true, email: true, role: true, isActive: true },
  });
  if (!admin || !admin.isActive) {
    return NextResponse.json({ error: "This account is not available. Contact an administrator." }, { status: 403 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { mustChangePassword: false, password: hashedPassword },
  });

  // Revoke any sessions for this admin so a stale/in-progress session cannot
  // bypass the rotation. The invitee will sign in fresh with their new
  // password (and complete MFA enrollment if their role requires it).
  await prisma.adminSession.updateMany({
    where: { adminUserId: admin.id, isActive: true },
    data: { isActive: false, lastActivity: new Date() },
  }).catch(() => null);

  // Audit under the affected admin's identity. writeAdminAudit snapshots the
  // actor; here the actor IS the admin completing their own invite.
  await writeAdminAudit(
    { adminId: admin.id, email: admin.email, role: admin.role },
    {
      action: consumed.purpose === "RESET" ? "ADMIN_PASSWORD_RESET_COMPLETED" : "ADMIN_INVITE_COMPLETED",
      entityType: "AdminUser",
      entityId: admin.id,
      metadata: {
        operation: "admin_set_password",
        status: "success",
        purpose: consumed.purpose,
      },
      request: requestMeta,
    },
  );

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
