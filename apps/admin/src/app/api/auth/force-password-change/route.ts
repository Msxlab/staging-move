import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, refreshSessionCookie } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Forced first-login rotation for an admin who is ALREADY authenticated but
// still flagged mustChangePassword (e.g. an invitee who was handed a session,
// or a legacy admin an operator flagged to rotate). Unlike the token route,
// this uses the live session — no step-up password confirm, because the whole
// point is that the current password is one they must replace. Reissues the
// JWT with `mcp: false` so middleware stops gating them.

const bodySchema = z
  .object({
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

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "A new password is required." }, { status: 400 });
  }
  const { newPassword } = parsed.data;

  const complexityError = passwordComplexityError(newPassword);
  if (complexityError) {
    return NextResponse.json({ error: complexityError }, { status: 400 });
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: { id: true, email: true, role: true, isActive: true, mustChangePassword: true, password: true },
  });
  if (!admin || !admin.isActive) {
    return NextResponse.json({ error: "Account not available." }, { status: 403 });
  }
  if (admin.mustChangePassword !== true) {
    await writeAdminAudit(
      { adminId: admin.id, email: admin.email, role: admin.role },
      {
        action: "ADMIN_FORCED_PASSWORD_ROTATION_REJECTED",
        entityType: "AdminUser",
        entityId: admin.id,
        metadata: {
          operation: "admin_force_password_change",
          status: "failed",
          reason: "not_flagged_for_forced_rotation",
        },
        request: getAuditRequestMeta(request),
      },
    );
    return NextResponse.json(
      { error: "Forced password rotation is not required for this account." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Reject reusing the (temporary/seed) current password.
  const sameAsCurrent = await bcrypt.compare(newPassword, admin.password);
  if (sameAsCurrent) {
    return NextResponse.json({ error: "Choose a password different from your current one." }, { status: 400 });
  }

  const requestMeta = getAuditRequestMeta(request);
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { mustChangePassword: false, password: hashedPassword },
  });

  await writeAdminAudit(
    { adminId: admin.id, email: admin.email, role: admin.role },
    {
      action: "ADMIN_FORCED_PASSWORD_ROTATED",
      entityType: "AdminUser",
      entityId: admin.id,
      metadata: {
        operation: "admin_force_password_change",
        status: "success",
        wasFlagged: admin.mustChangePassword === true,
      },
      request: requestMeta,
    },
  );

  // Reissue the JWT so middleware no longer gates this admin. refreshSessionCookie
  // invalidates the old DB-tracked session row and mints a fresh one.
  await refreshSessionCookie(session, { mustChangePassword: false });

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
