import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import {
  isPlacesProviderConfigError,
  lookupAddressAutocomplete,
} from "@/lib/address-autocomplete";
import { enforcePlacesCostControls, isPlacesAutocompleteEnabled } from "../cost-controls";

async function readDetailsInput(request: NextRequest, source: "query" | "body") {
  if (source === "query") {
    const { searchParams } = new URL(request.url);
    return {
      placeId: searchParams.get("placeId") || "",
      sessionToken: searchParams.get("sessionToken"),
    };
  }
  const body = await request.json().catch(() => ({}));
  return {
    placeId: typeof body?.placeId === "string" ? body.placeId : "",
    sessionToken: typeof body?.sessionToken === "string" ? body.sessionToken : null,
  };
}

async function handleDetails(request: NextRequest, source: "query" | "body") {
  try {
    const userId = await requireDbUserId();

    if (!await isPlacesAutocompleteEnabled()) {
      return NextResponse.json({
        enabled: false,
        result: null,
        code: "PLACES_AUTOCOMPLETE_DISABLED",
      });
    }

    const { placeId, sessionToken } = await readDetailsInput(request, source);
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
    if (isPlacesProviderConfigError(error)) {
      console.warn("[PLACES] Address autocomplete details provider config rejected:", error?.message);
      return NextResponse.json({
        enabled: false,
        result: null,
        code: "PLACES_PROVIDER_CONFIG_ERROR",
      });
    }
    console.error("Address autocomplete details failed:", error);
    return NextResponse.json({ error: "Failed to resolve address" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleDetails(request, "query");
}

export async function POST(request: NextRequest) {
  return handleDetails(request, "body");
}
