import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  listRuntimeConfigCatalog: vi.fn(),
  upsertRuntimeConfigEntry: vi.fn(),
  resetRuntimeConfigEntry: vi.fn(),
  writeAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requirePermission: mocks.requirePermission,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
}));

vi.mock("@/lib/runtime-config", () => ({
  listRuntimeConfigCatalog: mocks.listRuntimeConfigCatalog,
  upsertRuntimeConfigEntry: mocks.upsertRuntimeConfigEntry,
  resetRuntimeConfigEntry: mocks.resetRuntimeConfigEntry,
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
  writeAdminAudit: mocks.writeAdminAudit,
}));

import { DELETE, GET, PUT } from "./route";

const superSession = {
  adminId: "admin_super",
  email: "root@example.com",
  role: "SUPER_ADMIN",
  sessionId: "session_1",
};

function request(method: string, body?: unknown) {
  return new NextRequest("https://admin.locateflow.test/api/runtime-config", {
    method,
    headers: { "content-type": "application/json", "user-agent": "vitest" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(superSession);
  mocks.requirePermission.mockResolvedValue(superSession);
  mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
  mocks.listRuntimeConfigCatalog.mockResolvedValue([
    {
      key: "RESEND_API_KEY",
      maskedValue: "re***1234",
      isSecret: true,
      status: "Verified from ENV",
    },
  ]);
  mocks.upsertRuntimeConfigEntry.mockResolvedValue({
    id: "runtime_config_1",
    lastValidationStatus: "CONFIGURED",
  });
  mocks.resetRuntimeConfigEntry.mockResolvedValue({
    id: "runtime_config_1",
    lastValidationStatus: "ENV_FALLBACK",
  });
});

describe("/api/runtime-config authorization", () => {
  it("GET blocks non-SUPER_ADMIN callers", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.listRuntimeConfigCatalog).not.toHaveBeenCalled();
  });

  it("PUT blocks non-SUPER_ADMIN callers and audits when an actor is known", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));

    const response = await PUT(request("PUT", {
      key: "RESEND_API_KEY",
      value: "re_live_abcdefghijklmnopqrstuvwxyz",
      confirmPassword: "password",
    }));

    expect(response.status).toBe(403);
    expect(mocks.upsertRuntimeConfigEntry).not.toHaveBeenCalled();
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      superSession,
      expect.objectContaining({
        action: "RUNTIME_CONFIG_UPDATE_FAILED",
        metadata: expect.objectContaining({ reason: "forbidden", status: "failed" }),
      }),
    );
  });

  it("DELETE blocks non-SUPER_ADMIN callers and audits when an actor is known", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));

    const response = await DELETE(request("DELETE", {
      key: "RESEND_API_KEY",
      confirmPassword: "password",
    }));

    expect(response.status).toBe(403);
    expect(mocks.resetRuntimeConfigEntry).not.toHaveBeenCalled();
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      superSession,
      expect.objectContaining({
        action: "RUNTIME_CONFIG_DELETE_FAILED",
        metadata: expect.objectContaining({ reason: "forbidden", status: "failed" }),
      }),
    );
  });
});

describe("/api/runtime-config step-up", () => {
  it("PUT returns requiresMfa when MFA is needed", async () => {
    mocks.requirePasswordConfirm.mockResolvedValueOnce({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await PUT(request("PUT", {
      key: "RESEND_API_KEY",
      value: "re_live_abcdefghijklmnopqrstuvwxyz",
      confirmPassword: "password",
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      superSession,
      expect.objectContaining({
        action: "RUNTIME_CONFIG_UPDATE_FAILED",
        metadata: expect.objectContaining({
          reason: "mfa_required_or_invalid",
          requiresMfa: true,
          valueLength: "re_live_abcdefghijklmnopqrstuvwxyz".length,
        }),
      }),
    );
  });

  it("DELETE returns requiresMfa when MFA is needed", async () => {
    mocks.requirePasswordConfirm.mockResolvedValueOnce({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await DELETE(request("DELETE", {
      key: "RESEND_API_KEY",
      confirmPassword: "password",
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      superSession,
      expect.objectContaining({
        action: "RUNTIME_CONFIG_DELETE_FAILED",
        metadata: expect.objectContaining({
          reason: "mfa_required_or_invalid",
          requiresMfa: true,
        }),
      }),
    );
  });
});

describe("/api/runtime-config audit safety", () => {
  it("failed validation writes RUNTIME_CONFIG_UPDATE_FAILED without raw value", async () => {
    mocks.upsertRuntimeConfigEntry.mockRejectedValueOnce(
      new Error("INVALID_RUNTIME_CONFIG_VALUE:stripe_price_prefix"),
    );

    const response = await PUT(request("PUT", {
      key: "STRIPE_PRICE_INDIVIDUAL_MONTHLY",
      value: "not_a_price",
      note: "contains copied secret",
      confirmPassword: "password",
    }));

    expect(response.status).toBe(400);
    const auditCall = mocks.writeAdminAudit.mock.calls.at(-1);
    expect(auditCall?.[1]).toMatchObject({
      action: "RUNTIME_CONFIG_UPDATE_FAILED",
      metadata: expect.objectContaining({
        reason: "invalid_value",
        validationErrorCode: "stripe_price_prefix",
        valueLength: "not_a_price".length,
        noteLength: "contains copied secret".length,
      }),
    });
    expect(JSON.stringify(auditCall?.[1])).not.toContain("not_a_price");
    expect(JSON.stringify(auditCall?.[1])).not.toContain("contains copied secret");
  });

  it("success audit uses safe metadata and does not store raw note or value", async () => {
    const response = await PUT(request("PUT", {
      key: "RESEND_API_KEY",
      value: "re_live_super_secret_value",
      note: "operator pasted a note",
      confirmPassword: "password",
      mfaCode: "123456",
      backupCode: "backup-code",
    }));

    expect(response.status).toBe(200);
    const auditCall = mocks.writeAdminAudit.mock.calls.at(-1);
    expect(auditCall?.[1]).toMatchObject({
      action: "RUNTIME_CONFIG_UPDATE_SUCCESS",
      metadata: expect.objectContaining({
        operation: "runtime_config_update",
        key: "RESEND_API_KEY",
        valueLength: "re_live_super_secret_value".length,
        noteLength: "operator pasted a note".length,
        status: "success",
      }),
    });
    expect(JSON.stringify(auditCall?.[1])).not.toContain("re_live_super_secret_value");
    expect(JSON.stringify(auditCall?.[1])).not.toContain("operator pasted a note");
    expect(JSON.stringify(auditCall?.[1])).not.toContain("123456");
    expect(JSON.stringify(auditCall?.[1])).not.toContain("backup-code");
  });

  it("delete audit records env fallback status", async () => {
    const response = await DELETE(request("DELETE", {
      key: "RESEND_API_KEY",
      confirmPassword: "password",
      mfaCode: "654321",
    }));

    expect(response.status).toBe(200);
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      superSession,
      expect.objectContaining({
        action: "RUNTIME_CONFIG_DELETE_SUCCESS",
        metadata: expect.objectContaining({
          operation: "runtime_config_delete",
          key: "RESEND_API_KEY",
          fallbackStatus: "ENV_FALLBACK",
          status: "success",
        }),
      }),
    );
  });
});
