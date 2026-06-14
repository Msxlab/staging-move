import { describe, expect, it } from "vitest";
import {
  formatAddressAutocompleteSelectionConflict,
  getAddressAutocompleteSelectionConflict,
  type AddressAutocompleteResult,
} from "../address-autocomplete";

function result(overrides: Partial<AddressAutocompleteResult> = {}): AddressAutocompleteResult {
  return {
    placeId: "place_1",
    formattedAddress: "200 S Biscayne Blvd, Miami, FL 33131",
    street: "200 S Biscayne Blvd",
    city: "Miami",
    state: "FL",
    zip: "33131",
    country: "USA",
    latitude: 25.771,
    longitude: -80.191,
    ...overrides,
  };
}

describe("address autocomplete selection guard", () => {
  it("rejects a suggestion from a different entered state", () => {
    const conflict = getAddressAutocompleteSelectionConflict(
      { state: "FL", zip: "33131" },
      result({ state: "NC", zip: "28747" }),
    );

    expect(conflict?.kind).toBe("STATE");
    expect(formatAddressAutocompleteSelectionConflict(conflict!)).toBe(
      "That suggestion is in NC, but the entered state is FL.",
    );
  });

  it("rejects a suggestion with a different entered ZIP", () => {
    const conflict = getAddressAutocompleteSelectionConflict(
      { state: "FL", zip: "33131" },
      result({ state: "FL", zip: "33130-1234" }),
    );

    expect(conflict).toMatchObject({
      kind: "ZIP",
      typedZip: "33131",
      resultZip: "33130",
    });
  });

  it("allows matching selections and incomplete manual context", () => {
    expect(getAddressAutocompleteSelectionConflict({ state: "fl", zip: "33131-0000" }, result())).toBeNull();
    expect(getAddressAutocompleteSelectionConflict({ state: "", zip: "" }, result())).toBeNull();
  });
});
