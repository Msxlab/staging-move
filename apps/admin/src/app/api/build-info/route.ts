import { readBuildInfo } from "@locateflow/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(readBuildInfo("admin"), {
    headers: { "Cache-Control": "no-store" },
  });
}
