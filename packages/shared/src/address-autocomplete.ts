export interface AddressAutocompletePrediction {
  placeId: string;
  description: string;
  primaryText: string;
  secondaryText: string;
}

export interface AddressAutocompleteResult {
  placeId: string | null;
  formattedAddress: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export interface AddressAutocompleteFormFields {
  street: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  formattedAddress?: string | null;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AddressAutocompleteSelectionFields {
  state?: string | null;
  zip?: string | null;
}

export type AddressAutocompleteSelectionConflictKind = "STATE" | "ZIP";

export interface AddressAutocompleteSelectionConflict {
  kind: AddressAutocompleteSelectionConflictKind;
  typedState: string | null;
  resultState: string | null;
  typedZip: string | null;
  resultZip: string | null;
}

export interface AddressAutocompleteSearchResponse {
  enabled: boolean;
  predictions: AddressAutocompletePrediction[];
}

export interface AddressAutocompleteDetailsResponse {
  enabled: boolean;
  result: AddressAutocompleteResult | null;
}

export function createAddressAutocompleteSessionToken() {
  return `addr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clearAddressAutocompleteMetadata<T extends Partial<AddressAutocompleteFormFields>>(value: T): T {
  return {
    ...value,
    formattedAddress: null,
    placeId: null,
    latitude: null,
    longitude: null,
  };
}

export function applyAddressAutocompleteResult<T extends AddressAutocompleteFormFields>(value: T, result: AddressAutocompleteResult): T {
  return {
    ...value,
    street: result.street || result.formattedAddress || value.street,
    city: result.city || value.city,
    state: result.state || value.state,
    zip: result.zip || value.zip,
    country: result.country || value.country || "USA",
    formattedAddress: result.formattedAddress,
    placeId: result.placeId,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

function normalizeState(value?: string | null) {
  const state = (value || "").trim().toUpperCase();
  return state.length === 2 ? state : null;
}

function normalizeZip5(value?: string | null) {
  const match = (value || "").trim().match(/^\d{5}/);
  return match ? match[0] : null;
}

export function getAddressAutocompleteSelectionConflict(
  typed: AddressAutocompleteSelectionFields,
  result: AddressAutocompleteResult,
): AddressAutocompleteSelectionConflict | null {
  const typedState = normalizeState(typed.state);
  const resultState = normalizeState(result.state);
  if (typedState && resultState && typedState !== resultState) {
    return {
      kind: "STATE",
      typedState,
      resultState,
      typedZip: normalizeZip5(typed.zip),
      resultZip: normalizeZip5(result.zip),
    };
  }

  const typedZip = normalizeZip5(typed.zip);
  const resultZip = normalizeZip5(result.zip);
  if (typedZip && resultZip && typedZip !== resultZip) {
    return {
      kind: "ZIP",
      typedState,
      resultState,
      typedZip,
      resultZip,
    };
  }

  return null;
}

export function formatAddressAutocompleteSelectionConflict(conflict: AddressAutocompleteSelectionConflict) {
  if (conflict.kind === "STATE") {
    return `That suggestion is in ${conflict.resultState}, but the entered state is ${conflict.typedState}.`;
  }
  return `That suggestion uses ZIP ${conflict.resultZip}, but the entered ZIP is ${conflict.typedZip}.`;
}
