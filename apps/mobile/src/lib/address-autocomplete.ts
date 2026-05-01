import {
  applyAddressAutocompleteResult,
  clearAddressAutocompleteMetadata,
  createAddressAutocompleteSessionToken,
  type AddressAutocompleteDetailsResponse,
  type AddressAutocompleteFormFields,
  type AddressAutocompleteResult,
  type AddressAutocompleteSearchResponse,
} from "@locateflow/shared";
import { api } from "@/lib/api";

export {
  applyAddressAutocompleteResult,
  clearAddressAutocompleteMetadata,
  createAddressAutocompleteSessionToken,
  type AddressAutocompleteFormFields,
  type AddressAutocompleteResult,
};

export async function searchAddressAutocomplete(input: string, sessionToken: string) {
  return api.post<AddressAutocompleteSearchResponse>("/api/address-autocomplete", {
    input,
    sessionToken,
  });
}

export async function lookupAddressAutocomplete(placeId: string, sessionToken: string) {
  return api.post<AddressAutocompleteDetailsResponse>("/api/address-autocomplete/details", {
    placeId,
    sessionToken,
  });
}
