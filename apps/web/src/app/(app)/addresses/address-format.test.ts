import { describe, expect, it } from "vitest";
import { formatAddressStartMonth } from "./address-format";

describe("formatAddressStartMonth", () => {
  it("formats persisted date-only values without local timezone drift", () => {
    expect(formatAddressStartMonth("2026-06-01T00:00:00.000Z", "en-US")).toBe("Jun 2026");
  });

  it("returns an empty label for invalid dates", () => {
    expect(formatAddressStartMonth("not-a-date", "en-US")).toBe("");
  });
});
