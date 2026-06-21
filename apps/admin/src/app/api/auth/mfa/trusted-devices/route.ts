import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import {
  expireAdminMfaTrustCookie,
  getAdminMfaTrustCookie,
  hashAdminMfaTrustToken,
} from "@/lib/admin-mfa-trusted-device";

export async function GET(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const currentToken = getAdminMfaTrustCookie(request);
  const currentTokenHash = currentToken ? hashAdminMfaTrustToken(currentToken) : null;
  const devices = await prisma.adminMfaTrustedDevice.findMany({
    where: {
      adminUserId: session.adminId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      tokenHash: true,
      deviceLabel: true,
      ipAddress: true,
      userAgent: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
    take: 25,
  });

  return NextResponse.json(
    {
      devices: devices.map((device) => ({
        id: device.id,
        deviceLabel: device.deviceLabel,
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
        lastUsedAt: device.lastUsedAt,
        expiresAt: device.expiresAt,
        createdAt: device.createdAt,
        isCurrent: Boolean(currentTokenHash && currentTokenHash === device.tokenHash),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = typeof (body as { action?: unknown })?.action === "string"
    ? (body as { action: string }).action
    : "";
  const deviceId = typeof (body as { deviceId?: unknown })?.deviceId === "string"
    ? (body as { deviceId: string }).deviceId
    : "";

  if (action !== "revoke" && action !== "revoke_all") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const now = new Date();
  const currentToken = getAdminMfaTrustCookie(request);
  const currentTokenHash = currentToken ? hashAdminMfaTrustToken(currentToken) : null;
  let revoked = 0;
  let currentDeviceRevoked = action === "revoke_all";

  if (action === "revoke_all") {
    const result = await prisma.adminMfaTrustedDevice.updateMany({
      where: { adminUserId: session.adminId, revokedAt: null },
      data: { revokedAt: now },
    });
    revoked = result.count;
  } else {
    if (!deviceId) return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
    const device = await prisma.adminMfaTrustedDevice.findFirst({
      where: { id: deviceId, adminUserId: session.adminId, revokedAt: null },
      select: { id: true, tokenHash: true },
    });
    if (!device) return NextResponse.json({ error: "Trusted device not found" }, { status: 404 });
    const result = await prisma.adminMfaTrustedDevice.updateMany({
      where: { id: device.id, revokedAt: null },
      data: { revokedAt: now },
    });
    revoked = result.count;
    currentDeviceRevoked = Boolean(currentTokenHash && currentTokenHash === device.tokenHash);
  }

  await writeAdminAudit(session, {
    action: "MFA_TRUSTED_DEVICE_REVOKED",
    entityType: "AdminAuth",
    entityId: action === "revoke_all" ? session.adminId : deviceId,
    metadata: {
      operation: action,
      revoked,
      currentDeviceRevoked,
    },
    request: getAuditRequestMeta(request),
  });

  const response = NextResponse.json(
    { success: true, revoked, currentDeviceRevoked },
    { headers: { "Cache-Control": "no-store" } },
  );
  if (currentDeviceRevoked) {
    expireAdminMfaTrustCookie(response, request.headers.get("host"));
  }
  return response;
}
