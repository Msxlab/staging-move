import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";

export const runtime = "nodejs";

// Consent categories are closed set. Adding a category here is a schema-level
// decision that requires updating the banner copy + the DataConsent reader.
//
// DO_NOT_SELL is the CCPA / CPRA right-of-opt-out. `granted: true` on this
// category means the user has opted OUT of data sale/sharing (i.e. the
// toggle is "on" in the Do Not Sell settings UI). It flows through the
// same append-only audit trail as the other categories, and a dedicated
// shortcut endpoint lives at /api/consent/ccpa for the mandatory
// "Do Not Sell or Share My Personal Information" link.
const CATEGORIES = [
  "ANALYTICS",
  "MARKETING",
  "SENSITIVE",
  "FUNCTIONAL",
  "DO_NOT_SELL",
] as const;
type Category = (typeof CATEGORIES)[number];

const CONSENT_TEXT_VERSION = "2026-05-01"; // bump when privacy policy changes

const postSchema = z.object({
  grants: z
    .array(
      z.object({
        category: z.enum(CATEGORIES),
        granted: z.boolean(),
      }),
    )
    .min(1)
    .max(CATEGORIES.length),
});

/**
 * Return the *current* effective consent per category — the newest row per
 * (userId, category). Categories with no row default to `granted: false`
 * except FUNCTIONAL which is always implicitly granted (essential cookies).
 */
export async function GET() {
  try {
    const userId = await requireDbUserId();

    const rows = await prisma.dataConsent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const effective: Record<Category, { granted: boolean; at: string | null }> = {
      ANALYTICS: { granted: false, at: null },
      MARKETING: { granted: false, at: null },
      SENSITIVE: { granted: false, at: null },
      FUNCTIONAL: { granted: true, at: null },
      // CCPA default: sale/sharing is allowed until the user opts out.
      // Business logic treats `granted: true` as "opted out, don't sell".
      DO_NOT_SELL: { granted: false, at: null },
    };

    for (const row of rows) {
      const cat = row.category as Category;
      if (!(cat in effective)) continue;
      if (effective[cat].at === null) {
        effective[cat] = {
          granted: row.granted,
          at: row.createdAt.toISOString(),
        };
      }
    }

    return NextResponse.json({ version: CONSENT_TEXT_VERSION, consents: effective });
  } catch (err: any) {
    if (err?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch consents" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.errors },
        { status: 400 },
      );
    }

    const ip =
      (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const userAgent = request.headers.get("user-agent") || null;

    // Append rows rather than upsert — we keep the full history for audit,
    // including the version of the consent text the user saw.
    await prisma.$transaction(
      parsed.data.grants.map((g) =>
        prisma.dataConsent.create({
          data: {
            userId,
            category: g.category,
            granted: g.granted,
            version: CONSENT_TEXT_VERSION,
            ipAddress: ip,
            userAgent: userAgent?.slice(0, 500) ?? null,
          },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to save consent" }, { status: 500 });
  }
}
