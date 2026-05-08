import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    subscription: { findUnique: vi.fn() },
    address: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    movingPlan: { findMany: vi.fn() },
    moveTask: { groupBy: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(() => Promise.resolve("user_1")),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
  extractRequestMeta: vi.fn(() => ({ ipAddress: "203.0.113.10", userAgent: "Vitest" })),
}));

vi.mock("@/lib/rate-limit-policy", () => ({
  enforceRateLimitPolicy: vi.fn(() =>
    Promise.resolve({
      success: true,
      retryAfterSeconds: 0,
      policy: { group: "export_pdf", userFacingErrorCode: "EXPORT_RATE_LIMITED" },
    }),
  ),
}));

vi.mock("@/lib/security-events", () => ({
  emitSecurityEvent: vi.fn(),
}));

vi.mock("@/lib/user-step-up", () => ({
  verifyUserStepUp: vi.fn(() => Promise.resolve({ ok: false, code: "STEP_UP_REQUIRED", message: "Re-authentication is required." })),
}));

vi.mock("@/lib/pdf/address-report", () => ({
  generateAddressReportPdf: vi.fn(() => Buffer.from("address-pdf")),
}));

vi.mock("@/lib/pdf/full-account", () => ({
  generateFullAccountPdf: vi.fn(() => Buffer.from("full-pdf")),
}));

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { verifyUserStepUp } from "@/lib/user-step-up";
import { GET, POST } from "./route";

const verifyUserStepUpMock = verifyUserStepUp as unknown as Mock;
const rateLimitMock = enforceRateLimitPolicy as unknown as Mock;
const auditMock = createAuditLog as unknown as Mock;
const userMock = prisma.user as unknown as { findUniqueOrThrow: Mock };
const subscriptionMock = prisma.subscription as unknown as { findUnique: Mock };
const addressMock = prisma.address as unknown as { findMany: Mock };
const movingPlanMock = prisma.movingPlan as unknown as { findMany: Mock };
const moveTaskMock = prisma.moveTask as unknown as { groupBy: Mock };

function request(body: unknown) {
  return new NextRequest("https://locateflow.com/api/export/pdf", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Vitest" },
    body: JSON.stringify(body),
  });
}

describe("PDF export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyUserStepUpMock.mockResolvedValue({
      ok: false,
      code: "STEP_UP_REQUIRED",
      message: "Re-authentication is required.",
    });
    rateLimitMock.mockResolvedValue({
      success: true,
      retryAfterSeconds: 0,
      policy: { group: "export_pdf", userFacingErrorCode: "EXPORT_RATE_LIMITED" },
    });
  });

  it("denies legacy GET PDF export without step-up", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("STEP_UP_REQUIRED");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("denies full PDF export without step-up and audits the block", async () => {
    const res = await POST(request({ type: "full" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("STEP_UP_REQUIRED");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EXPORT_BLOCK",
        changes: expect.objectContaining({ type: "full", format: "pdf" }),
      }),
    );
  });

  it("allows full PDF export after valid step-up", async () => {
    verifyUserStepUpMock.mockResolvedValue({ ok: true, method: "password" });
    userMock.findUniqueOrThrow.mockResolvedValue({
      firstName: "User",
      lastName: "Example",
      email: "user@example.com",
      preferredLocale: "en",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    subscriptionMock.findUnique.mockResolvedValue(null);
    addressMock.findMany.mockResolvedValue([]);
    movingPlanMock.findMany.mockResolvedValue([]);
    moveTaskMock.groupBy.mockResolvedValue([]);

    const res = await POST(request({ type: "full", confirmPassword: "Password-2026!" }));
    const body = Buffer.from(await res.arrayBuffer()).toString("utf8");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(body).toBe("full-pdf");
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EXPORT_PDF",
        changes: expect.objectContaining({ type: "full", stepUpMethod: "password" }),
      }),
    );
  });
});
