import { describe, expect, it } from "vitest";

import {
  buildMoveTaskLifecyclePatch,
  canTransitionMoveTaskStatus,
  getNextMoveTaskStatus,
} from "../move-task-lifecycle";

describe("move task lifecycle", () => {
  it("maps user lifecycle events to task statuses", () => {
    expect(getNextMoveTaskStatus("SUGGESTED", "ACCEPT")).toBe("ACCEPTED");
    expect(getNextMoveTaskStatus("ACCEPTED", "START")).toBe("IN_PROGRESS");
    expect(getNextMoveTaskStatus("IN_PROGRESS", "COMPLETE")).toBe(
      "COMPLETED",
    );
    expect(getNextMoveTaskStatus("SUGGESTED", "DISMISS")).toBe("DISMISSED");
    expect(getNextMoveTaskStatus("DISMISSED", "REOPEN")).toBe("REOPENED");
  });

  it("returns timestamp patches for lifecycle transitions", () => {
    const now = new Date("2026-04-24T12:00:00.000Z");

    expect(
      buildMoveTaskLifecyclePatch({ status: "SUGGESTED" }, "ACCEPT", now),
    ).toEqual({
      status: "ACCEPTED",
      acceptedAt: now,
      lastStatusChangedAt: now,
    });

    expect(
      buildMoveTaskLifecyclePatch({ status: "IN_PROGRESS" }, "COMPLETE", now),
    ).toEqual({
      status: "COMPLETED",
      completedAt: now,
      lastStatusChangedAt: now,
    });
  });

  it("rejects invalid lifecycle transitions", () => {
    expect(canTransitionMoveTaskStatus("COMPLETED", "COMPLETE")).toBe(false);
    expect(canTransitionMoveTaskStatus("DISMISSED", "REOPEN")).toBe(true);
    expect(() => getNextMoveTaskStatus("COMPLETED", "COMPLETE")).toThrow(
      "INVALID_MOVE_TASK_STATUS_TRANSITION",
    );
  });
});
