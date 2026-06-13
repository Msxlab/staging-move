import { describe, expect, it } from "vitest";

import { formatLocalDateKey, parseLocalDateKey } from "./date-only";

describe("date-only helpers", () => {
  it("formats the selected local calendar day without UTC conversion", () => {
    expect(formatLocalDateKey(new Date(2026, 5, 20))).toBe("2026-06-20");
    expect(formatLocalDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("parses a date key back to a local calendar date", () => {
    const date = parseLocalDateKey("2026-06-20");

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(5);
    expect(date?.getDate()).toBe(20);
  });
});
