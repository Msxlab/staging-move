import { describe, expect, it } from "vitest";
import {
  isCanceledMovingPlanStatus,
  normalizeMovingPlanStatus,
} from "./constants";

describe("moving plan status helpers", () => {
  it("normalizes legacy CANCELLED rows to canonical CANCELED", () => {
    expect(normalizeMovingPlanStatus("CANCELLED")).toBe("CANCELED");
    expect(normalizeMovingPlanStatus("CANCELED")).toBe("CANCELED");
  });

  it("treats both canceled spellings as terminal canceled statuses", () => {
    expect(isCanceledMovingPlanStatus("CANCELED")).toBe(true);
    expect(isCanceledMovingPlanStatus("CANCELLED")).toBe(true);
    expect(isCanceledMovingPlanStatus("PLANNING")).toBe(false);
  });
});
