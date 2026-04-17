import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

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

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "PASSWORD_CHANGE",
        entityType: "AdminUser",
        entityId: session.adminId,
        changes: "Password changed",
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Password change failed:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
