import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

// GET /api/affiliate/export?type=clicks|conversions
//
// Affiliate log export for payout reconciliation with a network. Admin-gated and
// audit-logged (the rows are PII-adjacent — they tie a user's click to a
// provider). Bounded to keep a single download sane.
const MAX_ROWS = 5000;

function csvCell(value: unknown): string {
  // Formula-injection guard + quoting, same posture as the user data export.
  const raw = value === null || value === undefined ? "" : String(value);
  const guarded = raw.length > 0 && "=+-@".includes(raw.trimStart()[0] ?? "") ? "'" + raw : raw;
  return guarded.includes(",") || guarded.includes('"') || guarded.includes("\n")
    ? `"${guarded.replace(/"/g, '""')}"`
    : guarded;
}

function csv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

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
      body = csv(
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
      body = csv(
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
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="locateflow-affiliate-${type}.csv"`,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Affiliate export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
