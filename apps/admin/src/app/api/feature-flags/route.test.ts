import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  featureFlagFindUnique: vi.fn(),
  featureFlagCreate: vi.fn(),
  featureFlagUpdate: vi.fn(),
  featureFlagDelete: vi.fn(),
  adminAuditLogCreate: vi.fn(),
  writeAdminAudit: vi.fn(),
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
      create: (...args: unknown[]) => mocks.featureFlagCreate(...args),
      update: (...args: unknown[]) => mocks.featureFlagUpdate(...args),
      delete: (...args: unknown[]) => mocks.featureFlagDelete(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.adminAuditLogCreate(...args),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
  writeAdminAudit: (...args: unknown[]) => mocks.writeAdminAudit(...args),
}));

import { POST, PUT } from "./route";

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
      targetValue: null,
    });
    mocks.featureFlagCreate.mockResolvedValue({
      id: "flag-2",
      name: "billing-ui",
      enabled: true,
      description: null,
      targetType: "ALL",
      targetValue: null,
    });
    mocks.featureFlagUpdate.mockResolvedValue({
      id: "flag-1",
      name: "billing-ui",
      enabled: true,
      description: null,
      targetType: "ALL",
      targetValue: null,
    });
    mocks.featureFlagDelete.mockResolvedValue({
      id: "flag-1",
      name: "billing-ui",
      enabled: false,
      description: null,
      targetType: "ALL",
      targetValue: null,
    });
    mocks.writeAdminAudit.mockResolvedValue({});
  });

  it("requires MFA-backed password confirmation before mutating feature flags", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await PUT(request({ id: "flag-1", enabled: true }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ requiresPassword: true, requiresMfa: true });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin-1" },
      undefined,
      // Feature-flag step-up rides a one-hour grace so toggling a rollout
      // back and forth during an incident doesn't paint the operator with
      // password modals every ten minutes. See FEATURE_FLAG_STEP_UP_GRACE_MS
      // in route.ts.
      expect.objectContaining({
        operation: "feature_flag_write",
        maxAgeMs: 60 * 60 * 1000,
        requireMfa: true,
      }),
    );
    expect(mocks.featureFlagUpdate).not.toHaveBeenCalled();
  });

  it("passes MFA values through step-up on create", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue(null);

    const response = await POST(request({
      name: "billing-ui",
      enabled: true,
      confirmPassword: "pw",
      mfaCode: "123456",
    }));

    expect(response.status).toBe(200);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      { adminId: "admin-1" },
      "pw",
      expect.objectContaining({
        operation: "feature_flag_write",
        requireMfa: true,
        mfaCode: "123456",
      }),
    );
    expect(mocks.featureFlagCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "billing-ui",
          enabled: true,
          targetType: "ALL",
          targetValue: null,
        }),
      }),
    );
  });

  it("rejects invalid percentage targets before updating the row", async () => {
    const response = await PUT(request({
      id: "flag-1",
      targetType: "PERCENTAGE",
      targetValue: { percentage: 101 },
      confirmPassword: "pw",
      mfaCode: "123456",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Percentage target must be an integer from 0 to 100",
    });
    expect(mocks.requirePasswordConfirm).not.toHaveBeenCalled();
    expect(mocks.featureFlagUpdate).not.toHaveBeenCalled();
  });

  it("clears stale targetValue when an operator switches a flag back to ALL", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue({
      id: "flag-1",
      name: "billing-ui",
      enabled: true,
      description: null,
      targetType: "PLAN",
      targetValue: JSON.stringify({ plans: ["PRO"] }),
    });
    mocks.featureFlagUpdate.mockResolvedValue({
      id: "flag-1",
      name: "billing-ui",
      enabled: true,
      description: null,
      targetType: "ALL",
      targetValue: null,
    });

    const response = await PUT(request({
      id: "flag-1",
      targetType: "ALL",
      confirmPassword: "pw",
      backupCode: "BACKUP-1",
    }));

    expect(response.status).toBe(200);
    expect(mocks.featureFlagUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "flag-1" },
        data: expect.objectContaining({
          targetType: "ALL",
          targetValue: null,
        }),
      }),
    );
  });
});
