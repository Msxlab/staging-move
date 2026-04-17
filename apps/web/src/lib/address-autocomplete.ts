import { getRuntimeConfigValue } from "@/lib/runtime-config";
import type {
  AddressAutocompletePrediction,
  AddressAutocompleteResult,
  AddressAutocompleteSearchResponse,
  AddressAutocompleteDetailsResponse,
} from "@/lib/shared-address-autocomplete";

const GOOGLE_PLACES_AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const GOOGLE_PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

interface GoogleAutocompletePrediction {
  description?: string;
  place_id?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

interface GoogleAutocompleteResponse {
  status?: string;
  error_message?: string;
  predictions?: GoogleAutocompletePrediction[];
}

interface GoogleAddressComponent {
  long_name?: string;
  short_name?: string;
  types?: string[];
}

interface GooglePlaceDetailsResponse {
  status?: string;
  error_message?: string;
  result?: {
    place_id?: string;
    formatted_address?: string;
    address_components?: GoogleAddressComponent[];
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  };
}

function sanitizeSessionToken(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().slice(0, 120);
  return /^[a-zA-Z0-9._-]+$/.test(normalized) ? normalized : null;
}

function sanitizeQuery(value: string) {
  return value.trim().slice(0, 200);
}

function readComponent(components: GoogleAddressComponent[] | undefined, type: string, preferShort = false) {
  const match = components?.find((component) => component.types?.includes(type));
  if (!match) return "";
  return (preferShort ? match.short_name : match.long_name) || match.long_name || match.short_name || "";
}

function normalizeStreet(components: GoogleAddressComponent[] | undefined, formattedAddress?: string | null) {
  const streetNumber = readComponent(components, "street_number");
  const route = readComponent(components, "route");
  const combined = [streetNumber, route].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  return formattedAddress?.split(",")[0]?.trim() || "";
}

function normalizeCity(components: GoogleAddressComponent[] | undefined) {
  return readComponent(components, "locality")
    || readComponent(components, "postal_town")
    || readComponent(components, "sublocality")
    || readComponent(components, "sublocality_level_1")
    || readComponent(components, "administrative_area_level_2")
    || "";
}

async function getGoogleMapsApiKey() {
  return getRuntimeConfigValue("GOOGLE_MAPS_API_KEY");
}

function assertGoogleStatus(status: string | undefined, errorMessage?: string) {
  if (status === "OK" || status === "ZERO_RESULTS") {
    return;
  }
  throw new Error(errorMessage || status || "GOOGLE_PLACES_REQUEST_FAILED");
}

export async function searchAddressAutocomplete(input: {
  query: string;
  sessionToken?: string | null;
}): Promise<AddressAutocompleteSearchResponse> {
  const apiKey = await getGoogleMapsApiKey();
  if (!apiKey) {
    return { enabled: false, predictions: [] };
  }

  const query = sanitizeQuery(input.query);
  if (query.length < 3) {
    return { enabled: true, predictions: [] };
  }

  const url = new URL(GOOGLE_PLACES_AUTOCOMPLETE_URL);
  url.searchParams.set("input", query);
  url.searchParams.set("types", "address");
  url.searchParams.set("components", "country:us");
  url.searchParams.set("key", apiKey);

  const sessionToken = sanitizeSessionToken(input.sessionToken);
  if (sessionToken) {
    url.searchParams.set("sessiontoken", sessionToken);
  }

  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json()) as GoogleAutocompleteResponse;
  assertGoogleStatus(json.status, json.error_message);

  const predictions = (json.predictions || [])
    .filter((prediction) => prediction.place_id)
    .map((prediction) => ({
      placeId: prediction.place_id!,
      description: prediction.description || "",
      primaryText: prediction.structured_formatting?.main_text || prediction.description || "",
      secondaryText: prediction.structured_formatting?.secondary_text || "",
    })) satisfies AddressAutocompletePrediction[];

  return {
    enabled: true,
    predictions,
  };
}

export async function lookupAddressAutocomplete(placeId: string, sessionToken?: string | null): Promise<AddressAutocompleteDetailsResponse> {
  const apiKey = await getGoogleMapsApiKey();
  if (!apiKey) {
    return { enabled: false, result: null };
  }

  const normalizedPlaceId = placeId.trim();
  if (!normalizedPlaceId) {
    return { enabled: true, result: null };
  }

  const url = new URL(GOOGLE_PLACES_DETAILS_URL);
  url.searchParams.set("place_id", normalizedPlaceId);
  url.searchParams.set("fields", "place_id,formatted_address,address_component,geometry");
  url.searchParams.set("key", apiKey);

  const normalizedSessionToken = sanitizeSessionToken(sessionToken);
  if (normalizedSessionToken) {
    url.searchParams.set("sessiontoken", normalizedSessionToken);
  }

  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json()) as GooglePlaceDetailsResponse;
  assertGoogleStatus(json.status, json.error_message);

  if (!json.result) {
    return { enabled: true, result: null };
  }

  const components = json.result.address_components || [];
  const result: AddressAutocompleteResult = {
    placeId: json.result.place_id || normalizedPlaceId,
    formattedAddress: json.result.formatted_address || null,
    street: normalizeStreet(components, json.result.formatted_address),
    city: normalizeCity(components),
    state: readComponent(components, "administrative_area_level_1", true).toUpperCase(),
    zip: readComponent(components, "postal_code"),
    country: readComponent(components, "country", true) || "USA",
    latitude: typeof json.result.geometry?.location?.lat === "number" ? json.result.geometry.location.lat : null,
    longitude: typeof json.result.geometry?.location?.lng === "number" ? json.result.geometry.location.lng : null,
  };

  return {
    enabled: true,
    result,
  };
}
