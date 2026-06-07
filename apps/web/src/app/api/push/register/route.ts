import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

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

  const rl = await rateLimit(getRateLimitKey(req, "push:register", { userId }), {
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { token, platform, deviceName } = parsed.data;

  try {
    // Push tokens are per-DEVICE, not per-user. When a device changes hands
    // (a family iPad, a hand-me-down phone, or simply a logout/login on the
    // same device), re-assign the token to the current signed-in user so they
    // receive their notifications and the previous owner stops receiving theirs
    // on a device they no longer hold.
    const device = await prisma.pushDevice.upsert({
      where: { token },
      update: { userId, platform, deviceName, lastSeenAt: new Date() },
      create: { userId, token, platform, deviceName },
    });

    return NextResponse.json({ id: device.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Push token registration conflict" }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getRateLimitKey(req, "push:unregister", { userId }), {
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const { searchParams } = new URL(req.url);
  const token = typeof body?.token === "string" ? body.token : searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  if (token.length < 10 || token.length > 255) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  await prisma.pushDevice.deleteMany({ where: { userId, token } });
  return NextResponse.json({ ok: true });
}
