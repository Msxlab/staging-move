import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state")?.trim().toUpperCase();

    if (!state) {
      return NextResponse.json({ error: "State is required" }, { status: 400 });
    }

    const stateRule = await prisma.stateRule.findUnique({
      where: { stateCode: state },
    });

    return NextResponse.json({
      stateRule: stateRule
        ? {
            stateCode: stateRule.stateCode,
            stateName: stateRule.stateName,
            dmvRules: stateRule.dmvRules,
            voterRegistration: stateRule.voterRegistration,
            taxInfo: stateRule.taxInfo,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch state rule:", error);
    return NextResponse.json({ error: "Failed to fetch state rule" }, { status: 500 });
  }
}
