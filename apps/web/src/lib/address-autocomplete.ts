import { getRuntimeConfigValue } from "@/lib/runtime-config";
import type {
  AddressAutocompletePrediction,
  AddressAutocompleteResult,
  AddressAutocompleteSearchResponse,
  AddressAutocompleteDetailsResponse,
} from "@/lib/shared-address-autocomplete";

const GOOGLE_PLACES_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const GOOGLE_PLACES_DETAILS_BASE_URL = "https://places.googleapis.com/v1/places";
const GOOGLE_PLACES_AUTOCOMPLETE_FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text.text",
  "suggestions.placePrediction.structuredFormat.mainText.text",
  "suggestions.placePrediction.structuredFormat.secondaryText.text",
].join(",");
const GOOGLE_PLACES_DETAILS_FIELD_MASK = "id,formattedAddress,addressComponents,location";
const PLACES_PROVIDER_CONFIG_STATUSES = new Set([
  "API_KEY_INVALID",
  "API_KEY_SERVICE_BLOCKED",
  "PERMISSION_DENIED",
  "REQUEST_DENIED",
]);

export class PlacesProviderConfigError extends Error {
  code = "PLACES_PROVIDER_CONFIG_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "PlacesProviderConfigError";
  }
}

interface GooglePlacesText {
  text?: string;
}

interface GoogleAutocompletePrediction {
  placeId?: string;
  text?: GooglePlacesText;
  structuredFormat?: {
    mainText?: GooglePlacesText;
    secondaryText?: GooglePlacesText;
  };
}

interface GoogleAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: GoogleAutocompletePrediction;
  }>;
  error?: GooglePlacesError;
}

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface GooglePlaceDetailsResponse {
  id?: string;
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: {
    latitude?: number;
    longitude?: number;
  };
  error?: GooglePlacesError;
}

interface GooglePlacesError {
  code?: number;
  message?: string;
  status?: string;
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
  return (preferShort ? match.shortText : match.longText) || match.longText || match.shortText || "";
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

function normalizePlaceId(value: string) {
  return value.trim().replace(/^places\//, "");
}

function isProviderConfigError(status?: string, message?: string) {
  return Boolean(
    status && PLACES_PROVIDER_CONFIG_STATUSES.has(status)
      || message && /API key|referer|referrer|not authorized|permission|billing/i.test(message),
  );
}

function assertGoogleResponse(response: Response, error?: GooglePlacesError) {
  if (response.ok) {
    return;
  }
  const status = error?.status;
  const message = error?.message || status || `GOOGLE_PLACES_REQUEST_FAILED_${response.status}`;
  if (isProviderConfigError(status, message)) {
    throw new PlacesProviderConfigError(message);
  }
  throw new Error(message);
}

export function isPlacesProviderConfigError(error: unknown) {
  return (
    error instanceof PlacesProviderConfigError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "PLACES_PROVIDER_CONFIG_ERROR")
  );
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

  const body: Record<string, unknown> = {
    input: query,
    includedRegionCodes: ["us"],
    includedPrimaryTypes: ["street_address", "premise", "subpremise"],
  };

  const sessionToken = sanitizeSessionToken(input.sessionToken);
  if (sessionToken) {
    body.sessionToken = sessionToken;
  }

  const response = await fetch(GOOGLE_PLACES_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_PLACES_AUTOCOMPLETE_FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await response.json()) as GoogleAutocompleteResponse;
  assertGoogleResponse(response, json.error);

  const predictions = (json.suggestions || [])
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is GoogleAutocompletePrediction => Boolean(prediction?.placeId))
    .map((prediction) => ({
      placeId: prediction.placeId!,
      description: prediction.text?.text || "",
      primaryText: prediction.structuredFormat?.mainText?.text || prediction.text?.text || "",
      secondaryText: prediction.structuredFormat?.secondaryText?.text || "",
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

  const normalizedPlaceId = normalizePlaceId(placeId);
  if (!normalizedPlaceId) {
    return { enabled: true, result: null };
  }

  const url = new URL(`${GOOGLE_PLACES_DETAILS_BASE_URL}/${encodeURIComponent(normalizedPlaceId)}`);

  const normalizedSessionToken = sanitizeSessionToken(sessionToken);
  if (normalizedSessionToken) {
    url.searchParams.set("sessionToken", normalizedSessionToken);
  }

  const response = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_PLACES_DETAILS_FIELD_MASK,
    },
    cache: "no-store",
  });
  const json = (await response.json()) as GooglePlaceDetailsResponse;
  assertGoogleResponse(response, json.error);

  if (!json.id) {
    return { enabled: true, result: null };
  }

  const components = json.addressComponents || [];
  const result: AddressAutocompleteResult = {
    placeId: json.id || normalizedPlaceId,
    formattedAddress: json.formattedAddress || null,
    street: normalizeStreet(components, json.formattedAddress),
    city: normalizeCity(components),
    state: readComponent(components, "administrative_area_level_1", true).toUpperCase(),
    zip: readComponent(components, "postal_code"),
    country: readComponent(components, "country", true) || "USA",
    latitude: typeof json.location?.latitude === "number" ? json.location.latitude : null,
    longitude: typeof json.location?.longitude === "number" ? json.location.longitude : null,
  };

  return {
    enabled: true,
    result,
  };
}
