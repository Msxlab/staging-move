import { NextResponse } from "next/server";
import { getPublicCampaignViewModel } from "@/lib/acquisition-campaigns";

export const dynamic = "force-dynamic";

export async function GET() {
  const campaign = await getPublicCampaignViewModel();
  return NextResponse.json({ campaign });
}
