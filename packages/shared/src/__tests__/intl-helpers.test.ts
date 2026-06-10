import { afterEach, describe, expect, it, vi } from "vitest";

import { formatRelativeTime } from "../intl-helpers";

const NOW = new Date("2026-06-10T12:00:00Z");

describe("formatRelativeTime", () => {
  it("formats past and future across units (Intl path)", () => {
    expect(formatRelativeTime(new Date("2026-06-10T11:58:00Z"), "en-US", NOW)).toBe("2 minutes ago");
    expect(formatRelativeTime(new Date("2026-06-10T13:00:00Z"), "en-US", NOW)).toBe("in 1 hour");
    // numeric:"auto" — proves the real Intl formatter is in play here.
    expect(formatRelativeTime(new Date("2026-06-09T12:00:00Z"), "en-US", NOW)).toBe("yesterday");
    expect(formatRelativeTime("not-a-date", "en-US", NOW)).toBe("");
  });

  describe("without Intl.RelativeTimeFormat (Hermes on Android)", () => {
    // Hermes' Intl subset has no RelativeTimeFormat; constructing it throws
    // "Cannot read property 'prototype' of undefined". This crashed the
    // mobile dashboard cold start whenever an offline snapshot existed.
    // The module captures the constructor at import time, so simulate Hermes
    // by deleting the API and re-importing a fresh module instance.
    const RTF = Intl.RelativeTimeFormat;

    afterEach(() => {
      (Intl as { RelativeTimeFormat?: typeof Intl.RelativeTimeFormat }).RelativeTimeFormat = RTF;
      vi.resetModules();
    });

    it("falls back to plain English instead of throwing", async () => {
      delete (Intl as { RelativeTimeFormat?: typeof Intl.RelativeTimeFormat }).RelativeTimeFormat;
      vi.resetModules();
      const { formatRelativeTime: hermesFormat } = await import("../intl-helpers");

      expect(hermesFormat(new Date("2026-06-10T11:58:00Z"), "en-US", NOW)).toBe("2 minutes ago");
      expect(hermesFormat(new Date("2026-06-10T13:00:00Z"), "en-US", NOW)).toBe("in 1 hour");
      // The discriminator: Intl numeric:"auto" would say "yesterday";
      // the fallback says "1 day ago" — proves the fallback actually ran.
      expect(hermesFormat(new Date("2026-06-09T12:00:00Z"), "en-US", NOW)).toBe("1 day ago");
      expect(hermesFormat(new Date("2026-06-03T12:00:00Z"), "en-US", NOW)).toBe("1 week ago");
      expect(hermesFormat(new Date("2026-06-10T12:00:00Z"), "en-US", NOW)).toBe("now");
    });
  });
});
