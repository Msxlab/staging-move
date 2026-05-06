import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { generateAddressReportPdf } from "@/lib/pdf/address-report";
import { generateFullAccountPdf } from "@/lib/pdf/full-account";
import type { PdfAccountSnapshot, PdfAddress } from "@/lib/pdf/types";

/**
 * GET /api/export/pdf?type=address&addressId=xxx
 * GET /api/export/pdf?type=full
 *
 * Returns a server-rendered PDF of the requested data. The previous
 * implementation built HTML in the browser and called `window.print()`,
 * which depends on pop-up permission, leaks the document into the user's
 * print cache, and renders inconsistently across browsers. Generating
 * server-side with pdfkit removes all of that.
 *
 * The route is intentionally rate-limited and gated by session auth so
 * a leaked share link can't be used to enumerate other users' data.
 *
 * Localization note: v1 emits English-only PDFs. The generators take
 * domain data and rely on hard-coded English labels; future i18n work
 * should pass a locale + a `getTranslations`-resolved label bundle in
 * instead of widening the data shape.
 */

// pdfkit ships its own font files and uses Node `fs` to read them, so we
// must run on the Node.js runtime (not edge).
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    // 5 PDF exports per minute is plenty for a real user; anything
    // beyond that is either a runaway loop or abuse.
    const rlKey = getRateLimitKey(request, "export:pdf");
    const rl = await rateLimit(rlKey, { limit: 5, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many PDF exports. Please wait a minute and try again." },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "address";

    if (type === "address") {
      const addressId = searchParams.get("addressId");
      if (!addressId) {
        return NextResponse.json(
          { error: "addressId is required for type=address" },
          { status: 400 },
        );
      }
      const buffer = await buildAddressPdf(userId, addressId);
      if (!buffer) {
        return NextResponse.json(
          { error: "Address not found" },
          { status: 404 },
        );
      }
      return pdfResponse(buffer, `locateflow-address-report.pdf`);
    }

    if (type === "full") {
      const buffer = await buildFullAccountPdf(userId);
      return pdfResponse(buffer, `locateflow-account-snapshot.pdf`);
    }

    return NextResponse.json(
      { error: "Unsupported export type. Use 'address' or 'full'." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[EXPORT/PDF] Failed:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}

function pdfResponse(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}

async function buildAddressPdf(
  userId: string,
  addressId: string,
): Promise<Buffer | null> {
  const [address, user] = await Promise.all([
    prisma.address.findFirst({
      where: { id: addressId, userId, deletedAt: null },
      include: {
        services: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            providerName: true,
            category: true,
            monthlyCost: true,
            billingDay: true,
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    }),
  ]);
  if (!address) return null;

  const userName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
  const pdfAddress: PdfAddress = {
    id: address.id,
    type: address.type,
    nickname: address.nickname,
    street: address.street,
    city: address.city,
    state: address.state,
    zip: address.zip,
    isPrimary: address.isPrimary,
    ownership: address.ownership,
    startDate: address.startDate,
    services: address.services.map((s) => ({
      id: s.id,
      providerName: s.providerName,
      category: s.category,
      monthlyCost: Number(s.monthlyCost) || 0,
      billingDay: s.billingDay,
    })),
  };
  return generateAddressReportPdf(pdfAddress, userName);
}

async function buildFullAccountPdf(userId: string): Promise<Buffer> {
  const [user, subscription, addresses, movingPlans, taskCounts] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          preferredLocale: true,
          createdAt: true,
        },
      }),
      prisma.subscription.findUnique({
        where: { userId },
        select: { plan: true, status: true, currentPeriodEndsAt: true },
      }),
      prisma.address.findMany({
        where: { userId, deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        include: {
          services: {
            where: { deletedAt: null, isActive: true },
            select: {
              id: true,
              providerName: true,
              category: true,
              monthlyCost: true,
              billingDay: true,
            },
          },
        },
      }),
      prisma.movingPlan.findMany({
        where: { userId },
        orderBy: { moveDate: "desc" },
        select: {
          moveDate: true,
          status: true,
          fromAddress: { select: { city: true, state: true } },
          toAddress: { select: { city: true, state: true } },
        },
      }),
      prisma.moveTask.groupBy({
        by: ["status"],
        where: { userId, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

  // Move task counts come back as `[ { status, _count: { _all } } ]`.
  // Normalize into the trio the PDF cares about: open / completed /
  // dismissed. Anything else (e.g. archived) collapses into "open" so
  // the totals stay meaningful.
  let open = 0;
  let completed = 0;
  let dismissed = 0;
  for (const row of taskCounts) {
    const n = row._count._all;
    const status = row.status?.toUpperCase?.() ?? "";
    if (status === "COMPLETED") completed += n;
    else if (status === "DISMISSED") dismissed += n;
    else open += n;
  }

  const snapshot: PdfAccountSnapshot = {
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      preferredLocale: user.preferredLocale,
      createdAt: user.createdAt,
    },
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEndsAt: subscription.currentPeriodEndsAt,
        }
      : null,
    addresses: addresses.map((a) => ({
      id: a.id,
      type: a.type,
      nickname: a.nickname,
      street: a.street,
      city: a.city,
      state: a.state,
      zip: a.zip,
      isPrimary: a.isPrimary,
      ownership: a.ownership,
      startDate: a.startDate,
      services: a.services.map((s) => ({
        id: s.id,
        providerName: s.providerName,
        category: s.category,
        monthlyCost: Number(s.monthlyCost) || 0,
        billingDay: s.billingDay,
      })),
    })),
    movingPlans: movingPlans.map((p) => ({
      moveDate: p.moveDate,
      status: p.status,
      fromCity: p.fromAddress?.city ?? null,
      fromState: p.fromAddress?.state ?? null,
      toCity: p.toAddress?.city ?? null,
      toState: p.toAddress?.state ?? null,
    })),
    taskSummary: { open, completed, dismissed },
  };

  return generateFullAccountPdf(snapshot);
}
