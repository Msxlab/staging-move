import { describe, expect, it } from "vitest";
import { summarizeConnectorMetrics } from "./connector-metrics";

describe("summarizeConnectorMetrics (admin)", () => {
  it("computes per-connector totals and a confirm rate over terminal outcomes", () => {
    const out = summarizeConnectorMetrics({
      usps: { CONFIRMED: 8, FAILED: 1, NEEDS_USER: 1, QUEUED: 3 },
      acme: { SUBMITTED: 2 },
    });

    const usps = out.find((s) => s.connectorKey === "usps");
    expect(usps?.total).toBe(13);
    expect(usps?.confirmed).toBe(8);
    expect(usps?.queued).toBe(3);
    // 8 / (8 + 1 + 1) = 0.8
    expect(usps?.confirmRate).toBeCloseTo(0.8);

    const acme = out.find((s) => s.connectorKey === "acme");
    expect(acme?.submitted).toBe(2);
    expect(acme?.confirmRate).toBeNull(); // nothing terminal yet
  });

  it("sorts connectors by key and handles empty input", () => {
    expect(summarizeConnectorMetrics({})).toEqual([]);
    const out = summarizeConnectorMetrics({ zeta: { CONFIRMED: 1 }, alpha: { CONFIRMED: 1 } });
    expect(out.map((s) => s.connectorKey)).toEqual(["alpha", "zeta"]);
  });
});
