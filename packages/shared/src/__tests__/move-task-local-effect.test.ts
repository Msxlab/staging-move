import { describe, expect, it } from "vitest";
import { parseMoveTaskLocalEffect } from "../move-task-local-effect";

describe("parseMoveTaskLocalEffect", () => {
  it("returns null for non-object localEffect values", () => {
    expect(parseMoveTaskLocalEffect(null)).toBeNull();
    expect(parseMoveTaskLocalEffect("bad")).toBeNull();
    expect(parseMoveTaskLocalEffect([])).toBeNull();
  });

  it("allowlists typed local effect metadata", () => {
    expect(
      parseMoveTaskLocalEffect({
        effectType: "CREATE_DESTINATION_SERVICE",
        localOnly: true,
        noExternalAutomation: true,
        createdServiceId: "service-1",
        token: "should-not-pass",
      }),
    ).toEqual({
      effectType: "CREATE_DESTINATION_SERVICE",
      localOnly: true,
      noExternalAutomation: true,
      createdServiceId: "service-1",
    });
  });
});
