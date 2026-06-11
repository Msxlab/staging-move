import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { lookupFmcsaCarrier } from "@/lib/fmcsa";

/**
 * POST /api/movers/applications/:id/fmcsa — run the live FMCSA QCMobile
 * cross-check for an application and persist the snapshot (authority active,
 * HHG authority, safety rating) onto the row so the reviewer's decision is
 * informed. Not a decision itself → MODERATOR, no step-up. Degrades gracefully:
 * `not_configured` (no FMCSA_WEBKEY) / `not_found` / `error` are returned as-is
 * and the snapshot is only written when the lookup is `ok`.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("providers", "canUpdate", { minimumRole: "MODERATOR" });
    const { id } = await params;

    const application = await prisma.moverApplication.findUnique({
      where: { id },
      select: { id: true, usdotNumber: true },
    });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const result = await lookupFmcsaCarrier(application.usdotNumber);

    if (result.status === "ok") {
      await prisma.moverApplication.update({
        where: { id },
        data: {
          fmcsaAuthorityActive: result.authorityActive,
          fmcsaHhgAuthorized: result.hhgAuthorized,
          fmcsaSafetyRating: result.safetyRating,
          fmcsaCheckedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ fmcsa: result });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("FMCSA cross-check failed:", error);
    return NextResponse.json({ error: "FMCSA cross-check failed" }, { status: 500 });
  }
}
