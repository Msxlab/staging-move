import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta } from "@/lib/audit";

// State-rule edits are bulk-editorial — an operator authoring DMV / tax /
// voter text for a state often saves dozens of fields back-to-back. The
// default 10-min step-up grace was making them re-type their password
// mid-session. Step-up is still REQUIRED on the first save; this only
// widens the freshness window the server accepts as proof.
const STATE_RULE_STEP_UP_GRACE_MS = 60 * 60 * 1000;

export async function GET() {
  try {
    await requirePermission("state_rules", "canRead", { minimumRole: "VIEWER" });
    const rules = await prisma.stateRule.findMany({ orderBy: { stateCode: "asc" } });
    return NextResponse.json({ rules });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch state rules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("state_rules", "canCreate", { minimumRole: "ADMIN" });
    const body = await request.json();
    const confirm = await requirePasswordConfirm(session, body.confirmPassword, {
      operation: "state_rule_mutation",
      maxAgeMs: STATE_RULE_STEP_UP_GRACE_MS,
    });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    if (!body.stateCode || !body.stateName) {
      return NextResponse.json({ error: "stateCode and stateName are required" }, { status: 400 });
    }

    const existing = await prisma.stateRule.findFirst({ where: { stateCode: body.stateCode } });
    if (existing) {
      return NextResponse.json({ error: "State rule already exists for this state" }, { status: 409 });
    }

    const rule = await prisma.stateRule.create({
      data: {
        stateCode: body.stateCode,
        stateName: body.stateName,
        dmvRules: body.dmvRules || null,
        voterRegistration: body.voterRegistration || null,
        utilityInfo: body.utilityInfo || null,
        taxInfo: body.taxInfo || null,
        insuranceRules: body.insuranceRules || null,
        commonProviders: body.commonProviders || null,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "CREATE_STATE_RULE",
        entityType: "StateRule",
        entityId: rule.id,
        changes: JSON.stringify({ stateCode: rule.stateCode }),
        ipAddress: getAuditRequestMeta(request).ipAddress || "unknown",
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to create state rule:", error);
    return NextResponse.json({ error: "Failed to create state rule" }, { status: 500 });
  }
}
