import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

// POST /api/affiliate/postback/[network]
//
// Server-to-server conversion postback from an affiliate network. NOT behind a
// user session — it is authenticated by an HMAC-SHA256 signature over the raw
// body using a shared secret, and is idempotent on (network, externalTransactionId)
// so a partner can safely retry or send status updates.
//
// CCPA/CPRA note: this is an INBOUND server-to-server conversion postback
// (network → us). We RECEIVE conversion data here; we do not share/sell consumer
// PII outward, so it is intentionally NOT gated by the Do-Not-Sell opt-out. The
// outbound, attributed /api/affiliate/click + lead-dispatch paths ARE gated.
//
// Header: x-affiliate-signature: <hex hmac-sha256(rawBody, secret)>
// Body:   { externalTransactionId, clickId?, providerId?, amountCents?, currency?, status?, occurredAt? }

const KEY_RE = /^[a-z][a-z0-9-]*$/;
const ALLOWED_STATUS = new Set(["PENDING", "APPROVED", "REJECTED", "PAID"]);

function getNetworkSecret(network: string): string | null {
  // Per-network secret wins (AFFILIATE_POSTBACK_SECRET_IMPACT); otherwise a
  // single shared secret. Returns null when neither is configured.
  const perNetwork = process.env[`AFFILIATE_POSTBACK_SECRET_${network.toUpperCase().replace(/-/g, "_")}`];
  return perNetwork || process.env.AFFILIATE_POSTBACK_SECRET || null;
}

function signatureMatches(rawBody: string, secret: string, provided: string | null): boolean {
  if (!provided) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ network: string }> }) {
  try {
    const { network: rawNetwork } = await params;
    const network = (rawNetwork || "").toLowerCase().slice(0, 40);
    if (!KEY_RE.test(network)) {
      return NextResponse.json({ error: "Unknown network" }, { status: 404 });
    }

    const secret = getNetworkSecret(network);
    if (!secret) {
      return NextResponse.json({ error: "Postback is not configured for this network." }, { status: 503 });
    }

    const rawBody = await req.text();
    if (!signatureMatches(rawBody, secret, req.headers.get("x-affiliate-signature"))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody || "{}");
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const externalTransactionId =
      typeof body?.externalTransactionId === "string" ? body.externalTransactionId.trim().slice(0, 191) : "";
    if (!externalTransactionId) {
      return NextResponse.json({ error: "externalTransactionId is required" }, { status: 400 });
    }

    // Resolve the provider: prefer the echoed click id (also links the
    // conversion to its click), else an explicit providerId.
    const clickId = typeof body?.clickId === "string" ? body.clickId.trim() : "";
    let affiliateClickId: string | null = null;
    let providerId = typeof body?.providerId === "string" ? body.providerId.trim() : "";
    if (clickId) {
      const click = await prisma.affiliateClick.findUnique({
        where: { id: clickId },
        select: { id: true, providerId: true },
      });
      if (click) {
        affiliateClickId = click.id;
        if (!providerId) providerId = click.providerId;
      }
    }
    if (!providerId) {
      return NextResponse.json({ error: "providerId or a resolvable clickId is required" }, { status: 400 });
    }
    const provider = await prisma.serviceProvider.findUnique({ where: { id: providerId }, select: { id: true } });
    if (!provider) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    const statusRaw = typeof body?.status === "string" ? body.status.trim().toUpperCase() : "PENDING";
    const status = ALLOWED_STATUS.has(statusRaw) ? statusRaw : "PENDING";
    const amountCents = Number.isFinite(Number(body?.amountCents)) ? Math.max(0, Math.round(Number(body.amountCents))) : 0;
    const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim().slice(0, 8).toUpperCase() : "USD";
    const occurredAt = body?.occurredAt ? new Date(body.occurredAt) : null;
    const occurredAtValid = occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt : null;

    const conversion = await prisma.affiliateConversion.upsert({
      where: { network_externalTransactionId: { network, externalTransactionId } },
      create: {
        affiliateClickId,
        providerId,
        network,
        externalTransactionId,
        status,
        amountCents,
        currency,
        occurredAt: occurredAtValid,
      },
      update: {
        status,
        amountCents,
        currency,
        occurredAt: occurredAtValid,
        ...(affiliateClickId ? { affiliateClickId } : {}),
      },
    });

    return NextResponse.json({ ok: true, id: conversion.id, status: conversion.status });
  } catch (error) {
    console.error("Affiliate postback failed:", error);
    return NextResponse.json({ error: "Could not record conversion" }, { status: 500 });
  }
}
