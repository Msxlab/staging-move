import { describe, expect, it } from "vitest";
import { expandCoverageRows } from "../provider-coverage";

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
});
