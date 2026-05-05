export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listRuntimeConfigCatalog, resetRuntimeConfigEntry, upsertRuntimeConfigEntry } from "@/lib/runtime-config";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "SUPER_ADMIN" });
    const configs = await listRuntimeConfigCatalog();
    return NextResponse.json({ configs });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    const { key, value, note, confirmPassword } = await req.json();

    const confirm = await requirePasswordConfirm(session, confirmPassword);
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    if (!key || !value) {
      return NextResponse.json({ error: "key and value are required" }, { status: 400 });
    }

    const entry = await upsertRuntimeConfigEntry({
      key,
      value,
      note,
      adminId: session.adminId,
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE",
        entityType: "RuntimeConfig",
        entityId: entry.id,
        changes: JSON.stringify({ key, note: note || null }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (e.message === "UNKNOWN_RUNTIME_CONFIG_KEY") return NextResponse.json({ error: "Unsupported config key" }, { status: 400 });
    if (e.message === "EMPTY_RUNTIME_CONFIG_VALUE") return NextResponse.json({ error: "Config value cannot be empty" }, { status: 400 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canDelete", { minimumRole: "SUPER_ADMIN" });
    const { key, confirmPassword } = await req.json();

    const confirm = await requirePasswordConfirm(session, confirmPassword);
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const entry = await resetRuntimeConfigEntry(key, session.adminId);

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "DELETE",
        entityType: "RuntimeConfig",
        entityId: entry?.id || key.slice(0, 30),
        changes: JSON.stringify({ key, source: "ENV" }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (e.message === "UNKNOWN_RUNTIME_CONFIG_KEY") return NextResponse.json({ error: "Unsupported config key" }, { status: 400 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
