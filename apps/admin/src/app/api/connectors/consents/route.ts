export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";

const CONNECTOR_STEP_UP_GRACE_MS = 60 * 60 * 1000;
const KEY_RE = /^[a-z][a-z0-9-]*$/;
const ADMIN_REVOKE_REASONS = ["ADMIN_REVOKED", "SECURITY_INCIDENT"] as const;
const CONSENT_STATUSES = ["GRANTED", "REVOKED", "EXPIRED"] as const;

function safeParseScopes(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * GET — list partner consents for the admin Consent Admin view. Never selects
 * the encrypted token; only status, scopes, owner id, and lifecycle.
 */
export async function GET(req: NextRequest) {
  try {
    await requirePermission("connectors", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });

    const connectorKey = req.nextUrl.searchParams.get("connectorKey");
    const status = req.nextUrl.searchParams.get("status");
    const rows = await prisma.partnerConsent.findMany({
      where: {
        ...(connectorKey && KEY_RE.test(connectorKey) ? { connectorKey } : {}),
        ...(status && (CONSENT_STATUSES as readonly string[]).includes(status) ? { status } : {}),
      },
      select: {
        id: true,
        userId: true,
        connectorKey: true,
        status: true,
        scopesJson: true,
        revocationReason: true,
        grantedAt: true,
        revokedAt: true,
        expiresAt: true,
        tokenExpiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const consents = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      connectorKey: row.connectorKey,
      status: row.status,
      scopes: safeParseScopes(row.scopesJson),
      revocationReason: row.revocationReason,
      grantedAt: row.grantedAt,
      revokedAt: row.revokedAt,
      expiresAt: row.expiresAt,
      tokenExpiresAt: row.tokenExpiresAt,
      createdAt: row.createdAt,
    }));
    return NextResponse.json({ consents });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST — bulk-revoke every active consent for a connector (security incident
 * kill-switch). Zeroes the stored tokens. Step-up + audit required.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("connectors", "canUpdate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { connectorKey, reason, confirmPassword, mfaCode, backupCode } = await req.json();

    if (typeof connectorKey !== "string" || !KEY_RE.test(connectorKey)) {
      return NextResponse.json({ error: "connectorKey is required" }, { status: 400 });
    }
    const revocationReason = ADMIN_REVOKE_REASONS.includes(reason) ? reason : "ADMIN_REVOKED";

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "connector_consent_bulk_revoke",
      maxAgeMs: CONNECTOR_STEP_UP_GRACE_MS,
      requireMfa: true,
      mfaCode,
      backupCode,
    });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined }, { status: 403 });
    }

    const result = await prisma.partnerConsent.updateMany({
      where: { connectorKey, status: "GRANTED" },
      data: { status: "REVOKED", revokedAt: new Date(), revocationReason, tokenEncrypted: null, refreshTokenEncrypted: null },
    });
    // Kill in-flight work too: this is an incident kill-switch, but revoking the
    // consents alone leaves QUEUED/DISPATCHING ConnectorDispatch rows that the
    // worker would still claim (the per-connector config stays enabled). The
    // user-side revokeConsent already cancels these — mirror it here connector-wide.
    await prisma.connectorDispatch.updateMany({
      where: { connectorKey, status: { in: ["QUEUED", "DISPATCHING"] } },
      data: { status: "NEEDS_USER", lastErrorCode: "REVOKED" },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BULK_REVOKE_CONNECTOR_CONSENTS",
        entityType: "PartnerConsent",
        entityId: connectorKey,
        changes: JSON.stringify({ connectorKey, reason: revocationReason, revokedCount: result.count }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });
    return NextResponse.json({ revokedCount: result.count });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
