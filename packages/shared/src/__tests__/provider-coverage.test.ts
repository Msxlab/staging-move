import { describe, expect, it } from "vitest";
import {
  detectStateZipMismatch,
  expandCoverageRows,
  getZipReferenceFacts,
  zipToState,
} from "../provider-coverage";

describe("expandCoverageRows", () => {
  it("creates state-wide rows for STATE providers without ZIP rules", () => {
    const rows = expandCoverageRows({
      scope: "STATE",
      states: ["TX", "CA"],
      zipCodes: [],
    });

    expect(rows).toEqual([
      { state: "TX", zipPrefix: null, zipExact: null },
      { state: "CA", zipPrefix: null, zipExact: null },
    ]);
  });

  it("creates exact and prefix ZIP rows for valid ZIP rules", () => {
    const rows = expandCoverageRows({
      scope: "STATE",
      states: ["TX"],
      zipCodes: ["78701", "787"],
    });

    expect(rows).toEqual([
      { state: "TX", zipPrefix: null, zipExact: "78701" },
      { state: "TX", zipPrefix: "787", zipExact: null },
    ]);
  });

  it("returns no rows for FEDERAL providers without ZIP rules", () => {
    const rows = expandCoverageRows({
      scope: "FEDERAL",
      states: [],
      zipCodes: [],
    });

    expect(rows).toEqual([]);
  });

  it("uses a ZIP-prefix reference rather than a full ZIP dataset", () => {
    const facts = getZipReferenceFacts();

    expect(facts.granularity).toBe("three_digit_prefix");
    expect(facts.containsFullFiveDigitZips).toBe(false);
    expect(facts.clientSafeHintOnly).toBe(true);
    expect(facts.prefixCount).toBeGreaterThan(300);
    expect(facts.prefixCount).toBeLessThan(1_000);
  });
});

describe("ZIP state reference", () => {
  it("keeps the Arizona ZIP3 prefixes used by provider coverage", () => {
    expect(zipToState("85901")).toBe("AZ");
    expect(zipToState("86001")).toBe("AZ");
    expect(zipToState("86301")).toBe("AZ");
    expect(zipToState("86401")).toBe("AZ");
    expect(zipToState("86503")).toBe("AZ");
  });

  it("detects state and ZIP mismatches without blocking unresolved prefixes", () => {
    expect(detectStateZipMismatch("CA", "10001")).toEqual({
      typedState: "CA",
      zipState: "NY",
      normalizedZip: "10001",
    });
    expect(detectStateZipMismatch("NY", "10001")).toBeNull();
    expect(detectStateZipMismatch("CA", "002")).toBeNull();
  });
});
