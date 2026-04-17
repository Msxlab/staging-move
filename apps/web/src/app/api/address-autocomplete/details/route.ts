import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { lookupAddressAutocomplete } from "@/lib/address-autocomplete";

export async function GET(request: NextRequest) {
  try {
    await requireDbUserId();

    const key = getRateLimitKey(request, "places:details");
    const limited = await rateLimit(key, { limit: 45, windowSeconds: 60 });
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("placeId") || "";
    const sessionToken = searchParams.get("sessionToken");
    if (!placeId.trim()) {
      return NextResponse.json({ error: "placeId is required" }, { status: 400 });
    }

    const result = await lookupAddressAutocomplete(placeId, sessionToken);
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Address autocomplete details failed:", error);
    return NextResponse.json({ error: "Failed to resolve address" }, { status: 500 });
  }
}
