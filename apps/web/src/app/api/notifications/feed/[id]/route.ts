import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";

export async function PATCH(
  _request: NextRequest,
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to mark notification read:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
