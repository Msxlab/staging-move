import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import { lookupAddressAutocomplete } from "@/lib/address-autocomplete";
import { enforcePlacesCostControls, isPlacesAutocompleteEnabled } from "../cost-controls";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    if (!await isPlacesAutocompleteEnabled()) {
      return NextResponse.json({
        enabled: false,
        result: null,
        code: "PLACES_AUTOCOMPLETE_DISABLED",
      });
    }

    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("placeId") || "";
    const sessionToken = searchParams.get("sessionToken");
    if (!placeId.trim()) {
      return NextResponse.json({ error: "placeId is required" }, { status: 400 });
    }

    const costControlResponse = await enforcePlacesCostControls(request, userId, "details");
    if (costControlResponse) return costControlResponse;

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
