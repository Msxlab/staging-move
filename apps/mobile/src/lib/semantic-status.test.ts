import { describe, expect, it } from "vitest";
import {
  confidenceTone,
  daysUntilDue,
  dueUrgencyTone,
  resolveToneColors,
  riskTone,
} from "./semantic-status";

const NOW = new Date("2026-06-18T12:00:00Z").getTime();

describe("daysUntilDue", () => {
  it("returns null for missing/unparseable input", () => {
    expect(daysUntilDue(null, NOW)).toBeNull();
    expect(daysUntilDue(undefined, NOW)).toBeNull();
    expect(daysUntilDue("not-a-date", NOW)).toBeNull();
  });
  it("is negative for past due dates and positive for future", () => {
    expect(daysUntilDue("2026-06-16T12:00:00Z", NOW)).toBe(-2);
    expect(daysUntilDue("2026-06-23T12:00:00Z", NOW)).toBe(5);
  });
});

describe("dueUrgencyTone", () => {
  it("flags overdue as error and due-soon as warning", () => {
    expect(dueUrgencyTone(-1)).toBe("error");
    expect(dueUrgencyTone(0)).toBe("warning");
    expect(dueUrgencyTone(2)).toBe("warning");
    expect(dueUrgencyTone(5)).toBe("info");
    expect(dueUrgencyTone(30)).toBe("neutral");
    expect(dueUrgencyTone(null)).toBe("neutral");
  });
});

describe("confidenceTone", () => {
  it("maps confidence levels case-insensitively", () => {
    expect(confidenceTone("high")).toBe("success");
    expect(confidenceTone("HIGH")).toBe("success");
    expect(confidenceTone("medium")).toBe("warning");
    expect(confidenceTone("low")).toBe("neutral");
    expect(confidenceTone(undefined)).toBe("neutral");
  });
});

describe("riskTone", () => {
  it("treats true high risk as danger, not amber", () => {
    expect(riskTone("high")).toBe("error");
    expect(riskTone("elevated")).toBe("error");
    expect(riskTone("moderate")).toBe("warning");
    expect(riskTone("low")).toBe("success");
    expect(riskTone(null)).toBe("neutral");
  });
});

describe("resolveToneColors", () => {
  const theme = {
    colors: {
      success: "#0F6B50",
      warning: "#7A5418",
      error: "#A23B3F",
      info: "#1F5FA0",
      textTertiary: "#888888",
      errorFaded: "rgba(162,59,63,0.14)",
    },
  };
  it("maps a tone to fg + bg, using *Faded when present and a fallback otherwise", () => {
    expect(resolveToneColors(theme, "error")).toEqual({ fg: "#A23B3F", bg: "rgba(162,59,63,0.14)" });
    expect(resolveToneColors(theme, "success").fg).toBe("#0F6B50");
    expect(resolveToneColors(theme, "success").bg).toBe("#0F6B5022"); // fallback alpha
    expect(resolveToneColors(theme, "neutral").fg).toBe("#888888");
  });
});
