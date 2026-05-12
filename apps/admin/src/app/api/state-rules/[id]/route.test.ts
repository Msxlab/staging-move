import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  stateRuleDelete: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    stateRule: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: (...args: unknown[]) => mocks.stateRuleDelete(...args),
    },
    adminAuditLog: { create: vi.fn() },
  },
}));

import { DELETE } from "./route";

function request(body: unknown = {}) {
  return new Request("https://admin.locateflow.com/api/state-rules/rule-1", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("state rule mutation step-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin-1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.stateRuleDelete.mockResolvedValue({});
  });

  it("requires password confirmation before deleting a state rule", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Confirm your password before changing state rules.",
    });

    const response = await DELETE(request(), { params: Promise.resolve({ id: "rule-1" }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ requiresPassword: true });
    expect(mocks.stateRuleDelete).not.toHaveBeenCalled();
  });
});
