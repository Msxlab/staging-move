import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  featureFlagFindUnique: vi.fn(),
  featureFlagUpdate: vi.fn(),
  adminAuditLogCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    featureFlag: {
      findMany: vi.fn(),
      findUnique: (...args: unknown[]) => mocks.featureFlagFindUnique(...args),
      create: vi.fn(),
      update: (...args: unknown[]) => mocks.featureFlagUpdate(...args),
      delete: vi.fn(),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.adminAuditLogCreate(...args),
    },
  },
}));

import { PUT } from "./route";

function request(body: unknown) {
  return new Request("https://admin.locateflow.com/api/feature-flags", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("feature flag step-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin-1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.featureFlagFindUnique.mockResolvedValue({
      id: "flag-1",
      name: "billing-ui",
      enabled: false,
      description: null,
      targetType: "ALL",
    });
    mocks.featureFlagUpdate.mockResolvedValue({
      id: "flag-1",
      name: "billing-ui",
      enabled: true,
      description: null,
      targetType: "ALL",
    });
  });

  it("requires password confirmation before mutating feature flags", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Confirm your password before changing feature flags.",
    });

    const response = await PUT(request({ id: "flag-1", enabled: true }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ requiresPassword: true });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin-1" },
      undefined,
      { operation: "feature_flag_write" },
    );
    expect(mocks.featureFlagUpdate).not.toHaveBeenCalled();
  });
});
