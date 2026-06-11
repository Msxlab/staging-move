import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import { COACH_STEP_COPY_KEYS } from "./ob-coach";

/**
 * en/es parity for the onboarding coach + unified-CTA copy. The coach lives
 * on every wizard step, so a missing key in either catalog would crash the
 * step at render time — this test fails the build first.
 */
const REQUIRED_KEYS = [
  ...Object.values(COACH_STEP_COPY_KEYS),
  "coach_eyebrow",
  "coach_dismiss",
  "coach_reopen",
  "cta_hint_legal",
];

type Catalog = Record<string, unknown>;

function onboardingMessages(catalog: { onboarding: Catalog }): Catalog {
  return catalog.onboarding;
}

describe("onboarding coach message keys", () => {
  it.each(REQUIRED_KEYS)("defines a non-empty English string for %s", (key) => {
    const value = onboardingMessages(en)[key];
    expect(typeof value, `en.onboarding.${key}`).toBe("string");
    expect((value as string).trim().length).toBeGreaterThan(0);
  });

  it.each(REQUIRED_KEYS)("defines a non-empty Spanish string for %s", (key) => {
    const value = onboardingMessages(es)[key];
    expect(typeof value, `es.onboarding.${key}`).toBe("string");
    expect((value as string).trim().length).toBeGreaterThan(0);
  });

  it("keeps the coach copy honest — no scanning claims", () => {
    // LocateFlow never scans accounts, inboxes, or email; the coach must not
    // imply otherwise (legal posture: connectors stay flag-gated).
    for (const key of REQUIRED_KEYS) {
      const value = String(onboardingMessages(en)[key]).toLowerCase();
      expect(value).not.toContain("scan your account");
      expect(value).not.toContain("scan your inbox");
      expect(value).not.toContain("scan your email");
    }
  });
});
