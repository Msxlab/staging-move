import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireAdmin();

    const admin = await prisma.adminUser.findUnique({
      where: { id: session.adminId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        permissions: true,
      },
    });

    if (!admin || !admin.isActive) {
      return NextResponse.json({ admin: null }, { status: 401 });
    }

    return NextResponse.json({ admin });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ admin: null }, { status: 401 });
    }
    return NextResponse.json({ admin: null }, { status: 401 });
  }
}
