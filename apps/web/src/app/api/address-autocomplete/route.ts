import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import { searchAddressAutocomplete } from "@/lib/address-autocomplete";
import { enforcePlacesCostControls, isPlacesAutocompleteEnabled } from "./cost-controls";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    if (!await isPlacesAutocompleteEnabled()) {
      return NextResponse.json({
        enabled: false,
        predictions: [],
        code: "PLACES_AUTOCOMPLETE_DISABLED",
      });
    }

    const { searchParams } = new URL(request.url);
    const input = searchParams.get("input") || "";
    const sessionToken = searchParams.get("sessionToken");
    if (input.trim().length >= 3) {
      const costControlResponse = await enforcePlacesCostControls(request, userId, "autocomplete");
      if (costControlResponse) return costControlResponse;
    }

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
