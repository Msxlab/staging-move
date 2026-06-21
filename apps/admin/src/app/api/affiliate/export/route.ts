import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta } from "@/lib/audit";
import { buildCsv } from "@/lib/csv-safety";
import { contentDispositionAttachment } from "@/lib/http-download";

// GET /api/affiliate/export?type=clicks|conversions
//
// Affiliate log export for payout reconciliation with a network. Admin-gated and
// audit-logged (the rows are PII-adjacent — they tie a user's click to a
// provider). Bounded to keep a single download sane.
const MAX_ROWS = 5000;

// Use the canonical CSV-injection guard (`buildCsv`/`csvField`) shared with the
// waitlist + provider exports rather than a bespoke escaper. The previous local
// `csvCell` only neutralized a leading `=+-@` and missed the `\t`/`\r` formula
// triggers — and `externalTransactionId` is attacker-influenceable (it is taken
// verbatim from the affiliate-network postback body), so a malicious partner
// could smuggle a spreadsheet formula into this export.

const iso = (d: Date | null | undefined): string => (d ? d.toISOString() : "");

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const type = new URL(request.url).searchParams.get("type") === "conversions" ? "conversions" : "clicks";

    let body: string;
    if (type === "conversions") {
      const rows = await prisma.affiliateConversion.findMany({
        take: MAX_ROWS,
        orderBy: { createdAt: "desc" },
        select: {
          providerId: true,
          network: true,
          status: true,
          amountCents: true,
          currency: true,
          externalTransactionId: true,
          occurredAt: true,
          createdAt: true,
          provider: { select: { name: true } },
        },
      });
      body = buildCsv(
        ["providerName", "providerId", "network", "status", "amountCents", "currency", "externalTransactionId", "occurredAt", "createdAt"],
        rows.map((r) => [
          r.provider?.name ?? "",
          r.providerId,
          r.network,
          r.status,
          r.amountCents,
          r.currency,
          r.externalTransactionId,
          iso(r.occurredAt),
          iso(r.createdAt),
        ]),
      );
    } else {
      const rows = await prisma.affiliateClick.findMany({
        take: MAX_ROWS,
        orderBy: { createdAt: "desc" },
        select: {
          providerId: true,
          source: true,
          network: true,
          addressId: true,
          createdAt: true,
          provider: { select: { name: true } },
        },
      });
      body = buildCsv(
        ["providerName", "providerId", "source", "network", "addressId", "createdAt"],
        rows.map((r) => [
          r.provider?.name ?? "",
          r.providerId,
          r.source,
          r.network ?? "",
          r.addressId ?? "",
          iso(r.createdAt),
        ]),
      );
    }

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "EXPORT_AFFILIATE",
        entityType: "AffiliateClick",
        entityId: type,
        changes: JSON.stringify({ type }),
        ipAddress: getAuditRequestMeta(request).ipAddress || "unknown",
      },
    });

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": contentDispositionAttachment(`locateflow-affiliate-${type}.csv`),
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Affiliate export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
