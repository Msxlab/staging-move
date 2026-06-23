import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireDbUserId();
    const { id } = await params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });

    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "MARK_READ", entityType: "Notification", entityId: id, route: "/api/notifications/feed/[id]" });

    return NextResponse.json({ success: true });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to mark notification read:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
