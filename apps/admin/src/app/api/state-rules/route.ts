import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

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
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
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
