import { NextRequest } from "next/server";
import { guardCronRequest } from "@/lib/cron-guard";
import { refreshPartnerConsentById } from "@/lib/partner-consent-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleRefresh(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardCronRequest(request, "partner-consent-refresh", { limit: 60 });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  return refreshPartnerConsentById(id);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRefresh(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleRefresh(request, context);
}
