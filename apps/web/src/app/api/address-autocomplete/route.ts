import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { searchAddressAutocomplete } from "@/lib/address-autocomplete";

export async function GET(request: NextRequest) {
  try {
    await requireDbUserId();

    const key = getRateLimitKey(request, "places:autocomplete");
    const limited = await rateLimit(key, { limit: 45, windowSeconds: 60 });
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input") || "";
    const sessionToken = searchParams.get("sessionToken");
    const result = await searchAddressAutocomplete({ query: input, sessionToken });
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Address autocomplete search failed:", error);
    return NextResponse.json({ error: "Failed to search addresses" }, { status: 500 });
  }
}
