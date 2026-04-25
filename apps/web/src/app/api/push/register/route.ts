import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";

const registerSchema = z.object({
  token: z.string().min(10).max(255),
  platform: z.enum(["ios", "android", "web"]),
  deviceName: z.string().max(100).optional(),
}).strict();

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { token, platform, deviceName } = parsed.data;

  const device = await prisma.pushDevice.upsert({
    where: { token },
    update: { userId, platform, deviceName, lastSeenAt: new Date() },
    create: { userId, token, platform, deviceName },
  });

  return NextResponse.json({ id: device.id });
}

export async function DELETE(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  await prisma.pushDevice.deleteMany({ where: { userId, token } });
  return NextResponse.json({ ok: true });
}
