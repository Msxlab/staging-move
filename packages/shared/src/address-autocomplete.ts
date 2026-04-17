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
