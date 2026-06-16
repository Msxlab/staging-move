import {
  formatAddressAutocompleteSelectionConflict,
  getAddressAutocompleteSelectionConflict,
  type AddressAutocompleteResult,
  type AddressAutocompleteSelectionFields,
} from "@/lib/shared-address-autocomplete";

export function getAddressAutocompleteSelectionError(
  current: AddressAutocompleteSelectionFields,
  result: AddressAutocompleteResult,
) {
  const conflict = getAddressAutocompleteSelectionConflict(current, result);
  if (!conflict) return null;
  return `${formatAddressAutocompleteSelectionConflict(conflict)} Update or clear the state and ZIP before choosing this suggestion.`;
}
