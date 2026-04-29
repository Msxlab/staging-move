import { NextResponse } from "next/server";
import { getPublicSubscriptionOffersViewModel } from "@/lib/acquisition-campaigns";

export const dynamic = "force-dynamic";

export async function GET() {
  const offers = await getPublicSubscriptionOffersViewModel();
  return NextResponse.json({ campaign: offers.annualTrial, offers });
}
