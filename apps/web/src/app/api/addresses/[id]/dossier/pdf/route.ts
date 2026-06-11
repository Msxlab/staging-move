import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { getUserPlan } from "@/lib/plan-limits";
import { planFeatures } from "@locateflow/shared";
import { generateDossierReportPdf } from "@/lib/pdf/dossier-report";
import type { PdfDossier } from "@/lib/pdf/types";
import { GET as getDossier } from "../route";

// GET /api/addresses/:id/dossier/pdf — Pro-only New Home Dossier PDF export.
//
// Gate (owner decision): `dossierPdf` is Pro-only. Free/Individual/Family get
// the value-first teaser contract (HTTP 200, no payload) exactly like the
// other plan gates — never 403 — so the client renders an upgrade CTA.
//
// The dossier aggregation is single-sourced: this route delegates to the
// dossier data route's GET handler (same auth, workspace-scope, 404, and
// graceful-degradation contract) and renders the returned JSON to a PDF via
// the shared pdfkit stack (lib/pdf/*). It adds NO new data lookups of its own.
//
// pdfkit reads its bundled fonts via Node `fs`, so this must run on Node.

export const runtime = "nodejs";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireDbUserId();

    // Pro-only gate. Inactive/expired Pro resolves to FREE_TRIAL in getUserPlan,
    // so this also blocks lapsed Pro. Spend nothing beyond the plan read.
    if (!planFeatures((await getUserPlan(userId)).plan).dossierPdf) {
      return NextResponse.json({
        configured: true,
        entitled: false,
        upgradeRequired: "DOSSIER_PDF_UPGRADE_REQUIRED",
      });
    }

    // Delegate the aggregation to the dossier data route (single source of the
    // seven public lookups + the weather-window logic + workspace scoping).
    const dossierResponse = await getDossier(request, ctx);
    // Auth/404/scope outcomes (non-200) pass straight through unchanged.
    if (dossierResponse.status !== 200) return dossierResponse;

    const data = await dossierResponse.json();

    // The homeDossier gate inside the dossier route should never fire for a Pro
    // user (Pro has homeDossier), but if entitlement ever drifts, surface the
    // teaser rather than an empty PDF.
    if (data?.entitled === false) {
      return NextResponse.json(data);
    }
    // No address payload means the dossier route didn't return renderable data.
    if (!data?.address) {
      return NextResponse.json({ error: "Dossier not available" }, { status: 404 });
    }

    const { id } = await ctx.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const userName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

    const buffer = await generateDossierReportPdf(data as PdfDossier, userName);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="locateflow-home-dossier-${id}.pdf"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to build dossier PDF:", error);
    return NextResponse.json({ error: "Failed to build dossier PDF" }, { status: 500 });
  }
}
