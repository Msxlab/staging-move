import { describe, expect, it } from "vitest";
import {
  DEFAULT_US_TIME_ZONE,
  formatDateOnlyUtc,
  formatInUserTimeZone,
  isValidTimeZone,
  resolveUserTimeZone,
  STATE_TIME_ZONE,
} from "./timezone";

describe("resolveUserTimeZone", () => {
  it("prefers a valid stored profile timezone", () => {
    expect(resolveUserTimeZone({ timezone: "America/Chicago", state: "NY" })).toBe(
      "America/Chicago",
    );
  });

  it("falls back to the state map when no timezone is stored", () => {
    expect(resolveUserTimeZone({ state: "CA" })).toBe("America/Los_Angeles");
    expect(resolveUserTimeZone({ state: "TX" })).toBe("America/Chicago");
    expect(resolveUserTimeZone({ state: "NY" })).toBe("America/New_York");
  });

  it("is case-insensitive on the state code", () => {
    expect(resolveUserTimeZone({ state: "ca" })).toBe("America/Los_Angeles");
  });

  it("ignores an invalid stored timezone and uses the state map", () => {
    expect(resolveUserTimeZone({ timezone: "Mars/Olympus", state: "CO" })).toBe(
      "America/Denver",
    );
  });

  it("defaults to Eastern when nothing is resolvable", () => {
    expect(resolveUserTimeZone()).toBe(DEFAULT_US_TIME_ZONE);
    expect(resolveUserTimeZone({})).toBe(DEFAULT_US_TIME_ZONE);
    expect(resolveUserTimeZone({ state: "ZZ" })).toBe(DEFAULT_US_TIME_ZONE);
    expect(DEFAULT_US_TIME_ZONE).toBe("America/New_York");
  });

  it("maps every US state + DC to a valid IANA zone", () => {
    for (const tz of Object.values(STATE_TIME_ZONE)) {
      expect(isValidTimeZone(tz)).toBe(true);
    }
    // Spot-check coverage breadth (50 states + DC + 5 territories).
    expect(Object.keys(STATE_TIME_ZONE).length).toBeGreaterThanOrEqual(51);
  });
});

describe("isValidTimeZone", () => {
  it("accepts known IANA zones and rejects junk/empty", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Europe/Istanbul")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});

describe("formatDateOnlyUtc", () => {
  it("renders a UTC-midnight date-only value as its own calendar day", () => {
    // Stored at UTC midnight; must read as Apr 21 regardless of process tz.
    const moveDate = new Date("2026-04-21T00:00:00.000Z");
    expect(
      formatDateOnlyUtc(moveDate, { month: "long", day: "numeric", year: "numeric" }),
    ).toBe("April 21, 2026");
  });

  it("does NOT shift the day backward the way a US-zone render would", () => {
    // The core regression: formatting a UTC-midnight value in a US zone shows
    // the *previous* evening. formatDateOnlyUtc must stay on the 21st.
    const moveDate = new Date("2026-04-21T00:00:00.000Z");
    const utc = formatDateOnlyUtc(moveDate, { month: "short", day: "numeric" });
    const eastern = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    }).format(moveDate);
    expect(utc).toBe("Apr 21");
    expect(eastern).toBe("Apr 20"); // demonstrates why date-only must use UTC
  });

  it("returns empty string for an unparseable value", () => {
    expect(formatDateOnlyUtc("not-a-date")).toBe("");
  });
});

describe("formatInUserTimeZone", () => {
  it("renders a true instant in the resolved user zone, not the process tz", () => {
    // 18:30 UTC on Apr 21 → 14:30 EDT same day in New York.
    const instant = new Date("2026-04-21T18:30:00.000Z");
    const text = formatInUserTimeZone(
      instant,
      { timezone: "America/New_York" },
      { hour: "numeric", minute: "2-digit", hour12: false },
    );
    expect(text).toContain("14:30");
  });

  it("resolves via the state map when given a user shape without timezone", () => {
    // 02:00 UTC Apr 22 → 19:00 PDT Apr 21 in Los Angeles.
    const instant = new Date("2026-04-22T02:00:00.000Z");
    const text = formatInUserTimeZone(
      instant,
      { state: "CA" },
      { month: "short", day: "numeric", hour: "numeric", hour12: false },
    );
    expect(text).toContain("Apr 21");
  });

  it("accepts a bare IANA zone string", () => {
    const instant = new Date("2026-04-21T12:00:00.000Z");
    expect(
      formatInUserTimeZone(instant, "America/New_York", { month: "short", day: "numeric" }),
    ).toBe("Apr 21");
  });

  it("returns empty string for an unparseable value", () => {
    expect(formatInUserTimeZone("nope", "America/New_York")).toBe("");
  });
});
