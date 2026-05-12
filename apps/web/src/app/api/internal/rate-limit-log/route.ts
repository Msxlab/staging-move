import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyInternalAuth } from "@/lib/internal-secrets";

const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

const dateField = z.string().min(1).refine((value) => !Number.isNaN(new Date(value).getTime()), {
  message: "Invalid date",
}).transform((value) => new Date(value));

const rateLimitLogSchema = z.object({
  ipAddress: z.string().min(1).max(45).optional().default("anonymous"),
  endpoint: z.string().min(5).max(200).refine((value) => value.startsWith("/api/"), {
    message: "endpoint must begin with /api/",
  }),
  count: z.number().int().min(1).max(100000),
  blocked: z.boolean().optional().default(true),
  windowStart: dateField,
  windowEnd: dateField,
}).strict().superRefine((value, ctx) => {
  if (value.windowStart.getTime() > value.windowEnd.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["windowEnd"],
      message: "windowEnd must be after windowStart",
    });
  }
  if (value.windowEnd.getTime() - value.windowStart.getTime() > MAX_WINDOW_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["windowEnd"],
      message: "window duration exceeds limit",
    });
  }
});

export async function POST(request: NextRequest) {
  if (!verifyInternalAuth(request.headers.get("authorization"), "internal")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = rateLimitLogSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await prisma.rateLimitLog.create({
      data: {
        ipAddress: parsed.data.ipAddress,
        endpoint: parsed.data.endpoint,
        count: parsed.data.count,
        blocked: parsed.data.blocked,
        windowStart: parsed.data.windowStart,
        windowEnd: parsed.data.windowEnd,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to record rate-limit log" }, { status: 500 });
  }
}
