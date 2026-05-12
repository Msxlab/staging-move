import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { expireAdminSessionCookies, requireAdmin } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Both current and new passwords are required" }, { status: 400 });
    }

    // SEC-009: Strong password policy
    if (newPassword.length < 12) {
      return NextResponse.json({ error: "New password must be at least 12 characters" }, { status: 400 });
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json({ error: "Password must contain uppercase, lowercase, and a number" }, { status: 400 });
    }

    const admin = await prisma.adminUser.findUnique({ where: { id: session.adminId } });
    if (!admin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.adminUser.update({
      where: { id: session.adminId },
      data: { password: hashedPassword },
    });
    await prisma.adminSession.updateMany({
      where: { adminUserId: session.adminId, isActive: true },
      data: { isActive: false, lastActivity: new Date() },
    });

    await writeAdminAudit(session, {
      action: "PASSWORD_CHANGED",
      entityType: "AdminUser",
      entityId: session.adminId,
      metadata: { operation: "admin_password_change", sessionsRevoked: true },
      request: getAuditRequestMeta(request),
    });

    const response = NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
    return expireAdminSessionCookies(response, request.headers.get("host"));
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Password change failed:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
