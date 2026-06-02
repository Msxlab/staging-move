import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuditLog: vi.fn(),
  enforceRateLimitPolicy: vi.fn(),
  verifyUserStepUp: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: mocks.createAuditLog,
  extractRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
}));

vi.mock("@/lib/rate-limit-policy", () => ({
  enforceRateLimitPolicy: mocks.enforceRateLimitPolicy,
}));

vi.mock("@/lib/user-step-up", () => ({
  verifyUserStepUp: mocks.verifyUserStepUp,
}));

import { auditWorkspaceSensitiveAction, requireWorkspaceStepUp } from "./workspace-step-up";

function request() {
  return new Request("https://locateflow.com/api/workspaces/ws-1/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json", "user-agent": "vitest" },
  });
}

describe("workspace step-up helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimitPolicy.mockResolvedValue({ success: true });
    mocks.createAuditLog.mockResolvedValue(undefined);
  });

  it("returns a 403 and audits when step-up is missing", async () => {
    mocks.verifyUserStepUp.mockResolvedValue({
      ok: false,
      code: "STEP_UP_REQUIRED",
      message: "Enter your password or a valid MFA code before transferring workspace ownership.",
    });

    const result = await requireWorkspaceStepUp({
      request: request(),
      userId: "u-1",
      workspaceId: "ws-1",
      body: { toUserId: "u-2" },
      operation: "workspace_transfer",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toMatchObject({
        code: "STEP_UP_REQUIRED",
        requiresStepUp: true,
      });
    }
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "WORKSPACE_STEP_FAIL",
      entityType: "Workspace",
      entityId: "ws-1",
      changes: { operation: "workspace_transfer", code: "STEP_UP_REQUIRED" },
    }));
  });

  it("rate limits MFA attempts before checking step-up", async () => {
    mocks.enforceRateLimitPolicy.mockResolvedValue({
      success: false,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "MFA_RATE_LIMITED" },
    });

    const result = await requireWorkspaceStepUp({
      request: request(),
      userId: "u-1",
      workspaceId: "ws-1",
      body: { mfaCode: "123456" },
      operation: "workspace_delete",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(429);
    expect(mocks.verifyUserStepUp).not.toHaveBeenCalled();
  });

  it("returns the verified method on success", async () => {
    mocks.verifyUserStepUp.mockResolvedValue({ ok: true, method: "password" });

    const result = await requireWorkspaceStepUp({
      request: request(),
      userId: "u-1",
      workspaceId: "ws-1",
      body: { confirmPassword: "pw" },
      operation: "workspace_restore",
    });

    expect(result).toEqual({ ok: true, method: "password" });
    expect(mocks.verifyUserStepUp).toHaveBeenCalledWith(expect.objectContaining({
      userId: "u-1",
      confirmPassword: "pw",
      operationLabel: "restoring this workspace",
    }));
  });

  it("audits successful sensitive workspace actions without raw credentials", async () => {
    await auditWorkspaceSensitiveAction({
      request: request(),
      userId: "u-1",
      workspaceId: "ws-1",
      action: "WORKSPACE_TRANSFER",
      stepUpMethod: "mfa",
      changes: { toUserId: "u-2" },
    });

    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "WORKSPACE_TRANSFER",
      changes: { toUserId: "u-2", stepUpMethod: "mfa" },
    }));
  });
});
