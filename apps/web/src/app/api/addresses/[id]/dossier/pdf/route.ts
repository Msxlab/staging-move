import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { getPlanForLimitScope } from "@/lib/plan-limits";
import { planLimitScopeForDataScope, resolveWorkspaceDataScope } from "@/lib/workspace-data-scope";
import { planFeatures } from "@locateflow/shared";
import { generateDossierReportPdf } from "@/lib/pdf/dossier-report";
import { contentDispositionAttachment } from "@/lib/http-download";
import type { PdfDossier } from "@/lib/pdf/types";
import { GET as getDossier } from "../route";

// GET /api/addresses/:id/dossier/pdf — Pro New Home Dossier PDF export.
//
// Gate (owner decision): `dossierPdf` is Pro only. Lower tiers get
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
    const scope = await resolveWorkspaceDataScope(request, userId);

    // Pro-only gate. Inactive/expired paid plans resolve to FREE_TRIAL in the plan
    // lookup, so this also blocks lapsed subscriptions. Spend nothing beyond
    // the plan read.
    const planInfo = await getPlanForLimitScope(userId, planLimitScopeForDataScope(scope));
    if (!planFeatures(planInfo.plan).dossierPdf) {
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

    // The homeDossier gate inside the dossier route should never fire for a
    // dossierPdf-entitled user, but if entitlement ever drifts, surface the
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
        "Content-Disposition": contentDispositionAttachment(
          `locateflow-home-dossier-${id}.pdf`,
          "locateflow-home-dossier.pdf",
        ),
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    // Log the real error (code/message/stack) so runtime-only failures are
    // diagnosable in prod — e.g. the standalone-build pdfkit font ENOENT that
    // caused dossier-pdf-500 was invisible behind the generic message before.
    const err = error as { code?: string; message?: string; stack?: string };
    console.error("Failed to build dossier PDF:", {
      code: err?.code,
      message: err?.message,
      stack: err?.stack,
    });
    return NextResponse.json({ error: "Failed to build dossier PDF" }, { status: 500 });
  }
}
