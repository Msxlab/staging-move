import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  serviceFindMany: vi.fn(),
  serviceUpdate: vi.fn(),
  addressFindMany: vi.fn(),
  addressUpdate: vi.fn(),
  // Shared stand-in for the other FIELD_ENCRYPTION_KEY models (user, adminUser,
  // runtimeConfigEntry, subscription, partnerConsent, connectorDispatch). Default empty so the
  // generic scan walks every model without needing rows in each.
  otherFindMany: vi.fn(),
  otherUpdate: vi.fn(),
  writeAdminAudit: vi.fn(),
  isEncrypted: vi.fn(),
  reEncrypt: vi.fn(),
  validateKeyFormat: vi.fn(),
}));

// Every model the rotation route must cover. service + address have bespoke
// mocks; the rest share otherFindMany/otherUpdate.
const OTHER_MODELS = [
  "user",
  "adminUser",
  "runtimeConfigEntry",
  "subscription",
  "partnerConsent",
  "connectorDispatch",
  "lead",
];

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => {
  // Rotation scans + updates run on the RAW client (rawPrisma) so soft-deleted
  // rows are rotated too; point both exports at the same mock fns.
  const client: Record<string, { findMany: (...a: unknown[]) => unknown; update: (...a: unknown[]) => unknown }> = {
    service: {
      findMany: (...args: unknown[]) => mocks.serviceFindMany(...args),
      update: (...args: unknown[]) => mocks.serviceUpdate(...args),
    },
    address: {
      findMany: (...args: unknown[]) => mocks.addressFindMany(...args),
      update: (...args: unknown[]) => mocks.addressUpdate(...args),
    },
  };
  for (const name of [
    "user",
    "adminUser",
    "runtimeConfigEntry",
    "subscription",
    "partnerConsent",
    "connectorDispatch",
    "lead",
  ]) {
    client[name] = {
      findMany: (...args: unknown[]) => mocks.otherFindMany(name, ...args),
      update: (...args: unknown[]) => mocks.otherUpdate(name, ...args),
    };
  }
  return { prisma: client, rawPrisma: client, prismaUnsafe: client };
});

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
  writeAdminAudit: (...args: unknown[]) => mocks.writeAdminAudit(...args),
}));

vi.mock("@/lib/shared-encryption", () => ({
  isEncrypted: (...args: unknown[]) => mocks.isEncrypted(...args),
  reEncrypt: (...args: unknown[]) => mocks.reEncrypt(...args),
  validateKeyFormat: (...args: unknown[]) => mocks.validateKeyFormat(...args),
}));

import { POST } from "./route";

const SESSION = {
  adminId: "admin-1",
  email: "admin@example.com",
  role: "SUPER_ADMIN",
  sessionId: "session-1",
};

const OLD_KEY = "a".repeat(64);
const NEW_KEY = "b".repeat(64);

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/security/key-rotation", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" },
    body: JSON.stringify(body),
  });
}

function auditActions() {
  return mocks.writeAdminAudit.mock.calls.map((call) => call[1]?.action);
}

function serializedAuditCalls() {
  return JSON.stringify(mocks.writeAdminAudit.mock.calls);
}

describe("security key rotation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIELD_ENCRYPTION_KEY = NEW_KEY;
    mocks.requirePermission.mockResolvedValue(SESSION);
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.validateKeyFormat.mockReturnValue(true);
    mocks.isEncrypted.mockImplementation((value) => typeof value === "string" && value.startsWith("enc:"));
    mocks.reEncrypt.mockReturnValue("enc:rotated");
    mocks.serviceFindMany
      .mockResolvedValueOnce([{ id: "svc-1", accountNumber: "enc:old", username: null, phone: null, email: null, notes: null }])
      .mockResolvedValueOnce([{ id: "svc-1", accountNumber: "enc:old", username: null, phone: null, email: null, notes: null }]);
    mocks.addressFindMany.mockResolvedValue([]);
    mocks.serviceUpdate.mockResolvedValue({});
    mocks.addressUpdate.mockResolvedValue({});
    mocks.otherFindMany.mockResolvedValue([]);
    mocks.otherUpdate.mockResolvedValue({});
    mocks.writeAdminAudit.mockResolvedValue(undefined);
  });

  it("requires SUPER_ADMIN, MFA step-up, and writes STARTED then COMPLETED on success", async () => {
    const response = await POST(request({ oldKey: OLD_KEY, confirmPassword: "pw", mfaCode: "123456" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.requirePermission).toHaveBeenCalledWith("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin-1" }),
      "pw",
      expect.objectContaining({
        operation: "key_rotation",
        requireMfa: true,
        mfaCode: "123456",
      }),
    );
    expect(auditActions()).toEqual(["KEY_ROTATION_STARTED", "KEY_ROTATION_COMPLETED"]);
    expect(serializedAuditCalls()).not.toContain(OLD_KEY);
    expect(serializedAuditCalls()).not.toContain(NEW_KEY);
  });

  it("rotates EVERY FIELD_ENCRYPTION_KEY model, not just service + address (audit P0-1)", async () => {
    const response = await POST(request({ oldKey: OLD_KEY, confirmPassword: "pw", mfaCode: "123456" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    // service + address keep their bespoke scans...
    expect(mocks.serviceFindMany).toHaveBeenCalled();
    expect(mocks.addressFindMany).toHaveBeenCalled();
    // ...and every other encrypted model is scanned too (the bug was that these
    // were silently skipped, so their ciphertext would become undecryptable).
    const scannedOthers = new Set(mocks.otherFindMany.mock.calls.map((call) => call[0]));
    for (const model of OTHER_MODELS) {
      expect(scannedOthers.has(model)).toBe(true);
    }
    // The STARTED audit advertises the full coverage set.
    const startedCall = mocks.writeAdminAudit.mock.calls.find((call) => call[1]?.action === "KEY_ROTATION_STARTED");
    expect(startedCall?.[1]?.metadata?.tables).toEqual(
      expect.arrayContaining(["service", "address", ...OTHER_MODELS]),
    );
    // The success message no longer over-promises "all encrypted fields".
    expect(body.message).toContain("Re-encrypted");
    expect(body.message).toContain("connectorDispatch");
    // Results report stats for every configured encrypted table.
    expect(Object.keys(body.results).sort()).toEqual(
      [
        "address",
        "adminUser",
        "connectorDispatch",
        "lead",
        "partnerConsent",
        "runtimeConfigEntry",
        "service",
        "subscription",
        "user",
      ],
    );
  });

  it("fails closed and writes KEY_ROTATION_FAILED if any record mutation fails", async () => {
    mocks.serviceUpdate.mockRejectedValue(new Error("db down"));

    const response = await POST(request({ oldKey: OLD_KEY, confirmPassword: "pw", mfaCode: "123456" }));

    expect(response.status).toBe(500);
    expect(auditActions()).toEqual(["KEY_ROTATION_STARTED", "KEY_ROTATION_FAILED"]);
    expect(mocks.writeAdminAudit).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "KEY_ROTATION_COMPLETED" }),
    );
    expect(serializedAuditCalls()).not.toContain(OLD_KEY);
    expect(serializedAuditCalls()).not.toContain(NEW_KEY);
  });

  it("rejects concurrent key rotation attempts and writes a safe failure audit", async () => {
    let releaseFirstScan!: (records: any[]) => void;
    const firstScan = new Promise<any[]>((resolve) => {
      releaseFirstScan = resolve;
    });
    mocks.serviceFindMany.mockReset();
    mocks.addressFindMany.mockReset();
    mocks.serviceFindMany.mockReturnValueOnce(firstScan);
    mocks.addressFindMany.mockResolvedValue([]);

    const first = POST(request({ oldKey: OLD_KEY, confirmPassword: "pw", mfaCode: "123456" }));
    await vi.waitFor(() => expect(auditActions()).toContain("KEY_ROTATION_STARTED"));

    const second = await POST(request({ oldKey: OLD_KEY, confirmPassword: "pw", mfaCode: "123456" }));
    const secondBody = await second.json();

    expect(second.status).toBe(409);
    expect(secondBody.error).toBe("Key rotation is already in progress");
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin-1" }),
      expect.objectContaining({
        action: "KEY_ROTATION_FAILED",
        metadata: expect.objectContaining({
          reasonCode: "rotation_already_in_progress",
          status: "failed",
        }),
      }),
    );
    expect(serializedAuditCalls()).not.toContain(OLD_KEY);
    expect(serializedAuditCalls()).not.toContain(NEW_KEY);

    releaseFirstScan([]);
    await first;
  });
});
