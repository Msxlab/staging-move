import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import {
  isPlacesProviderConfigError,
  searchAddressAutocomplete,
} from "@/lib/address-autocomplete";
import { enforcePlacesCostControls, isPlacesAutocompleteEnabled } from "./cost-controls";

async function readSearchInput(request: NextRequest, source: "query" | "body") {
  if (source === "query") {
    const { searchParams } = new URL(request.url);
    return {
      input: searchParams.get("input") || "",
      sessionToken: searchParams.get("sessionToken"),
    };
  }
  const body = await request.json().catch(() => ({}));
  return {
    input: typeof body?.input === "string" ? body.input : "",
    sessionToken: typeof body?.sessionToken === "string" ? body.sessionToken : null,
  };
}

async function handleAutocomplete(request: NextRequest, source: "query" | "body") {
  try {
    const userId = await requireDbUserId();

    if (!await isPlacesAutocompleteEnabled()) {
      return NextResponse.json({
        enabled: false,
        predictions: [],
        code: "PLACES_AUTOCOMPLETE_DISABLED",
      });
    }

    const { input, sessionToken } = await readSearchInput(request, source);
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
    if (isPlacesProviderConfigError(error)) {
      console.warn("[PLACES] Address autocomplete provider config rejected:", error?.message);
      return NextResponse.json({
        enabled: false,
        predictions: [],
        code: "PLACES_PROVIDER_CONFIG_ERROR",
      });
    }
    console.error("Address autocomplete search failed:", error);
    return NextResponse.json({ error: "Failed to search addresses" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleAutocomplete(request, "query");
}

export async function POST(request: NextRequest) {
  return handleAutocomplete(request, "body");
}
