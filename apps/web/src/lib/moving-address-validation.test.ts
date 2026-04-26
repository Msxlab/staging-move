import { describe, expect, it } from "vitest";
import {
  normalizeMovingState,
  validateMovingAddressStates,
} from "./moving-address-validation";

describe("moving address validation", () => {
  it("normalizes state codes", () => {
    expect(normalizeMovingState(" tx ")).toBe("TX");
  });

  it("requires origin and destination states before task generation", () => {
    expect(
      validateMovingAddressStates({
        fromAddress: { state: "" },
        toAddress: { state: "TX" },
        destinationField: "toAddressId",
      }),
    ).toMatchObject({ ok: false, field: "fromAddressId" });

    expect(
      validateMovingAddressStates({
        fromAddress: { state: "NJ" },
        toAddress: { state: "" },
        destinationField: "destinationAddress.state",
      }),
    ).toMatchObject({ ok: false, field: "destinationAddress.state" });
  });

  it("accepts valid route states", () => {
    expect(
      validateMovingAddressStates({
        fromAddress: { state: "NJ" },
        toAddress: { state: "tx" },
        destinationField: "toAddressId",
      }),
    ).toEqual({ ok: true, fromState: "NJ", toState: "TX" });
  });
});
