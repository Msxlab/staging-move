import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("state_rules", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;
    const rule = await prisma.stateRule.findUnique({ where: { id } });
    if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ rule });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("state_rules", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json();
    const confirm = await requirePasswordConfirm(session, body.confirmPassword, {
      operation: "state_rule_mutation",
    });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    const existing = await prisma.stateRule.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updateData: any = {};
    const fields = ["stateCode", "stateName", "dmvRules", "voterRegistration", "utilityInfo", "taxInfo", "insuranceRules", "commonProviders"];
    for (const f of fields) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    const rule = await prisma.stateRule.update({ where: { id }, data: updateData });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE_STATE_RULE",
        entityType: "StateRule",
        entityId: id,
        changes: JSON.stringify(updateData),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ rule });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("state_rules", "canDelete", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const confirm = await requirePasswordConfirm(session, body.confirmPassword, {
      operation: "state_rule_mutation",
    });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    const rule = await prisma.stateRule.findUnique({ where: { id } });
    if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.stateRule.delete({ where: { id } });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "DELETE_STATE_RULE",
        entityType: "StateRule",
        entityId: id,
        changes: JSON.stringify({ stateCode: rule.stateCode }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
