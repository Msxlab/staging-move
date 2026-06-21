import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  adminFindUnique: vi.fn(),
  adminUpdate: vi.fn(),
  generateSecret: vi.fn(),
  generateProvisioningURI: vi.fn(),
  generateBackupCodes: vi.fn(),
  encrypt: vi.fn(),
  qrToDataURL: vi.fn(),
  writeAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: mocks.adminFindUnique,
      update: mocks.adminUpdate,
    },
  },
}));

vi.mock("@/lib/totp", () => ({
  generateSecret: mocks.generateSecret,
  generateProvisioningURI: mocks.generateProvisioningURI,
  generateBackupCodes: mocks.generateBackupCodes,
}));

vi.mock("@/lib/shared-encryption", () => ({ encrypt: mocks.encrypt }));
vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
  writeAdminAudit: mocks.writeAdminAudit,
}));
vi.mock("qrcode", () => ({ default: { toDataURL: mocks.qrToDataURL } }));

import { POST } from "./route";

const SESSION = {
  adminId: "admin_1",
  email: "admin@example.com",
  role: "SUPER_ADMIN",
  sessionId: "session_1",
};

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/auth/mfa/setup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "vitest",
    },
    body: JSON.stringify(body),
  });
}

describe("admin MFA setup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(SESSION);
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.adminFindUnique.mockResolvedValue({ email: "admin@example.com", mfaEnabled: false });
    mocks.adminUpdate.mockResolvedValue({});
    mocks.generateSecret.mockReturnValue("totp-secret");
    mocks.generateProvisioningURI.mockReturnValue("otpauth://totp/LocateFlow");
    mocks.generateBackupCodes.mockResolvedValue({ codes: ["BACKUP12"], hashes: ["hash-1"] });
    mocks.encrypt.mockReturnValue("encrypted-secret");
    mocks.qrToDataURL.mockResolvedValue("data:image/png;base64,qr");
    mocks.writeAdminAudit.mockResolvedValue(undefined);
  });

  it("returns one-time setup material with no-store headers", async () => {
    const response = await POST(request({ confirmPassword: "correct-password" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(body).toMatchObject({
      success: true,
      provisioningURI: "otpauth://totp/LocateFlow",
      qrDataUrl: "data:image/png;base64,qr",
      secret: "totp-secret",
      backupCodes: ["BACKUP12"],
    });
    expect(mocks.adminUpdate).toHaveBeenCalledWith({
      where: { id: "admin_1" },
      data: {
        mfaSecret: "encrypted-secret",
        mfaBackupCodes: JSON.stringify(["hash-1"]),
      },
    });
  });

  it("also marks step-up failures as no-store", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "Password confirmation required.",
    });

    const response = await POST(request({}));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({ requiresPassword: true });
    expect(mocks.adminUpdate).not.toHaveBeenCalled();
  });
});
