import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    address: { findMany: vi.fn() },
    service: { findMany: vi.fn() },
    userCustomProvider: { findMany: vi.fn() },
    moveTask: { findMany: vi.fn() },
    userEvent: { findMany: vi.fn() },
    dataConsent: { findMany: vi.fn() },
    supportTicket: { findMany: vi.fn() },
    notification: { findMany: vi.fn() },
    notificationPreference: { findMany: vi.fn() },
    pushDevice: { findMany: vi.fn() },
    budget: { findMany: vi.fn() },
    movingPlan: { findMany: vi.fn() },
    userSession: { findMany: vi.fn() },
    subscription: { findUnique: vi.fn() },
    workspaceMember: { findMany: vi.fn() },
    workspaceInvitation: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
  extractRequestMeta: vi.fn(() => ({ ipAddress: "203.0.113.10", userAgent: "vitest" })),
}));

vi.mock("@/lib/shared-encryption", () => ({
  decrypt: vi.fn((value: string) => value === "enc-email" ? "customer@example.com" : `decrypted:${value}`),
}));

vi.mock("@/lib/rate-limit-policy", () => ({
  enforceRateLimitPolicy: vi.fn(() => Promise.resolve({
    success: true,
    remaining: 2,
    resetAt: Date.now() + 60_000,
    retryAfterSeconds: 60,
    policy: { userFacingErrorCode: "EXPORT_RATE_LIMITED" },
    key: "export-key",
  })),
}));

vi.mock("@/lib/user-step-up", () => ({
  verifyUserStepUp: vi.fn(() => Promise.resolve({ ok: true, method: "password" })),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { verifyUserStepUp } from "@/lib/user-step-up";
import { POST } from "./route";

const mockPrisma = {
  address: { findMany: prisma.address.findMany as Mock },
  service: { findMany: prisma.service.findMany as Mock },
  userCustomProvider: { findMany: prisma.userCustomProvider.findMany as Mock },
  moveTask: { findMany: prisma.moveTask.findMany as Mock },
  userEvent: { findMany: prisma.userEvent.findMany as Mock },
  dataConsent: { findMany: (prisma as any).dataConsent.findMany as Mock },
  supportTicket: { findMany: (prisma as any).supportTicket.findMany as Mock },
  notification: { findMany: (prisma as any).notification.findMany as Mock },
  notificationPreference: { findMany: (prisma as any).notificationPreference.findMany as Mock },
  pushDevice: { findMany: (prisma as any).pushDevice.findMany as Mock },
  budget: { findMany: prisma.budget.findMany as Mock },
  movingPlan: { findMany: prisma.movingPlan.findMany as Mock },
  userSession: { findMany: (prisma as any).userSession.findMany as Mock },
  subscription: { findUnique: (prisma as any).subscription.findUnique as Mock },
  workspaceMember: { findMany: (prisma as any).workspaceMember.findMany as Mock },
  workspaceInvitation: { findMany: (prisma as any).workspaceInvitation.findMany as Mock },
  user: { findUnique: (prisma as any).user.findUnique as Mock },
};
const mockRequireDbUserId = requireDbUserId as any;
const mockVerifyUserStepUp = verifyUserStepUp as any;
const mockEnforceRateLimitPolicy = enforceRateLimitPolicy as any;
const mockCreateAuditLog = createAuditLog as any;

function makeRequest(input: Record<string, unknown>) {
  return new Request("http://localhost/api/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmPassword: "correct-password", ...input }),
  }) as any;
}

describe("export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockPrisma.address.findMany.mockResolvedValue([]);
    mockPrisma.service.findMany.mockResolvedValue([]);
    mockPrisma.userCustomProvider.findMany.mockResolvedValue([]);
    mockPrisma.moveTask.findMany.mockResolvedValue([]);
    mockPrisma.userEvent.findMany.mockResolvedValue([]);
    mockPrisma.dataConsent.findMany.mockResolvedValue([]);
    mockPrisma.supportTicket.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notificationPreference.findMany.mockResolvedValue([]);
    mockPrisma.pushDevice.findMany.mockResolvedValue([]);
    mockPrisma.budget.findMany.mockResolvedValue([]);
    mockPrisma.movingPlan.findMany.mockResolvedValue([]);
    mockPrisma.userSession.findMany.mockResolvedValue([]);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.workspaceMember.findMany.mockResolvedValue([]);
    mockPrisma.workspaceInvitation.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({ email: "user@example.com" });
    mockVerifyUserStepUp.mockResolvedValue({ ok: true, method: "password" });
    mockEnforceRateLimitPolicy.mockResolvedValue({
      success: true,
      remaining: 2,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "EXPORT_RATE_LIMITED" },
      key: "export-key",
    });
  });

  it("masks sensitive service fields in JSON exports", async () => {
    mockPrisma.service.findMany.mockResolvedValue([
      {
        category: "UTILITY",
        providerName: "Austin Energy",
        accountNumber: "acct-1234",
        website: "https://example.com",
        phone: "5551234567",
        email: "enc-email",
        monthlyCost: 120,
        billingDay: 15,
        billingCycle: "MONTHLY",
        autoRenewal: true,
        contractEndDate: null,
        isActive: true,
        notes: "secret",
        address: { nickname: "Home", city: "Austin", state: "TX" },
      },
    ]);

    const response = await POST(makeRequest({ type: "services", format: "json" }));
    const text = await response.text();
    const data = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(data.services).toHaveLength(1);
    expect(data.services[0].accountNumber).toBe("****1234");
    expect(data.services[0].email).toBe("cu****@example.com");
    expect(data.services[0].phone).toBe("****4567");
  });

  it("includes the user's own workspace context with sent-invite emails masked", async () => {
    mockPrisma.workspaceMember.findMany.mockResolvedValue([
      {
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date("2026-01-01"),
        workspace: { name: "Our Home", ownerUserId: "user-1", createdAt: new Date("2026-01-01") },
      },
    ]);
    mockPrisma.workspaceInvitation.findMany
      .mockResolvedValueOnce([
        {
          invitedEmail: "partner@example.com",
          role: "MEMBER",
          status: "PENDING",
          createdAt: new Date("2026-02-01"),
          expiresAt: new Date("2026-02-08"),
          workspace: { name: "Our Home" },
        },
      ])
      .mockResolvedValueOnce([]);

    const response = await POST(makeRequest({ type: "workspace", format: "json" }));
    const data = JSON.parse(await response.text());

    expect(response.status).toBe(200);
    expect(data.workspaceMemberships).toHaveLength(1);
    expect(data.workspaceMemberships[0]).toMatchObject({ workspaceName: "Our Home", isOwner: true, role: "OWNER" });
    expect(data.workspaceInvitationsSent[0].invitedEmail).toBe("pa****@example.com");
  });

  it("omits notes by default and decrypts them only when includeNotes=true", async () => {
    mockPrisma.service.findMany.mockResolvedValue([
      {
        category: "UTILITY",
        providerName: "Austin Energy",
        accountNumber: null,
        website: null,
        phone: null,
        email: null,
        monthlyCost: 0,
        billingDay: 1,
        billingCycle: "MONTHLY",
        autoRenewal: false,
        contractEndDate: null,
        isActive: true,
        notes: "enc-note-ciphertext",
        address: { nickname: "Home", city: "Austin", state: "TX" },
      },
    ]);

    const withoutNotes = await POST(makeRequest({ type: "services", format: "json" }));
    const withoutText = JSON.parse(await withoutNotes.text());
    expect(withoutText.services[0].notes).toBeNull();

    mockPrisma.service.findMany.mockResolvedValue([
      {
        category: "UTILITY",
        providerName: "Austin Energy",
        accountNumber: null,
        website: null,
        phone: null,
        email: null,
        monthlyCost: 0,
        billingDay: 1,
        billingCycle: "MONTHLY",
        autoRenewal: false,
        contractEndDate: null,
        isActive: true,
        notes: "enc-note-ciphertext",
        address: { nickname: "Home", city: "Austin", state: "TX" },
      },
    ]);
    const withNotes = await POST(
      makeRequest({ type: "services", format: "json", includeNotes: true }),
    );
    const withText = JSON.parse(await withNotes.text());
    expect(withText.services[0].notes).toBe("decrypted:enc-note-ciphertext");
  });

  it("prefixes dangerous CSV values to prevent formula injection", async () => {
    mockPrisma.service.findMany.mockResolvedValue([
      {
        category: "UTILITY",
        providerName: "=cmd|' /C calc'!A0",
        accountNumber: "acct-1234",
        website: "https://example.com",
        phone: "5551234567",
        email: "enc-email",
        monthlyCost: 120,
        billingDay: 15,
        billingCycle: "MONTHLY",
        autoRenewal: true,
        contractEndDate: null,
        isActive: true,
        notes: "safe",
        address: { nickname: "Home", city: "Austin", state: "TX" },
      },
    ]);

    const response = await POST(makeRequest({ type: "services", format: "csv" }));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).toContain("****1234");
  });

  it("includes move tasks and custom providers in full JSON exports without notes by default", async () => {
    mockPrisma.userCustomProvider.findMany.mockResolvedValue([
      {
        name: "Local Dentist",
        category: "HEALTHCARE_DENTAL",
        notes: "private provider note",
      },
    ]);
    mockPrisma.moveTask.findMany.mockResolvedValue([
      {
        title: "Find new dentist",
        actionType: "FIND_REPLACEMENT",
        status: "SUGGESTED",
        notes: "private task note",
      },
    ]);

    const response = await POST(makeRequest({ type: "full", format: "json" }));
    const data = JSON.parse(await response.text());

    expect(response.status).toBe(200);
    expect(data.customProviders).toHaveLength(1);
    expect(data.moveTasks).toHaveLength(1);
    expect(data.customProviders[0].notes).toBeNull();
    expect(data.moveTasks[0].notes).toBeNull();
    expect(mockPrisma.userCustomProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", deletedAt: null } }),
    );
    expect(mockPrisma.moveTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", deletedAt: null } }),
    );
  });

  it("exports custom provider and move task notes only with includeNotes=true", async () => {
    mockPrisma.userCustomProvider.findMany.mockResolvedValue([
      { name: "Local Gym", category: "FITNESS_GYM", notes: "membership note" },
    ]);
    mockPrisma.moveTask.findMany.mockResolvedValue([
      { title: "Cancel gym", actionType: "CANCEL_OR_CLOSE", status: "ACCEPTED", notes: "task note" },
    ]);

    const response = await POST(makeRequest({ type: "full", format: "json", includeNotes: true }));
    const data = JSON.parse(await response.text());

    expect(data.customProviders[0].notes).toBe("membership note");
    expect(data.moveTasks[0].notes).toBe("task note");
  });

  it("includes legal acknowledgement history in full JSON exports", async () => {
    mockPrisma.userEvent.findMany.mockResolvedValue([
      {
        event: "LEGAL_CONSENT_ACCEPTED",
        page: "/sign-up",
        metadata: JSON.stringify({
          termsAccepted: true,
          disclaimerAccepted: true,
          termsVersion: "2026-03-13",
          disclaimerVersion: "2026-03-13",
          source: "email_signup",
        }),
        createdAt: new Date("2026-04-24T12:00:00.000Z"),
      },
    ]);

    const response = await POST(makeRequest({ type: "full", format: "json" }));
    const data = JSON.parse(await response.text());

    expect(response.status).toBe(200);
    expect(data.legalConsents).toHaveLength(1);
    expect(data.legalConsents[0].metadata.termsAccepted).toBe(true);
    expect(data.legalConsents[0].metadata.source).toBe("email_signup");
    expect(mockPrisma.userEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      }),
    );
  });

  it("does not gate data export on subscription state", async () => {
    mockPrisma.address.findMany.mockResolvedValue([
      {
        nickname: "Old home",
        type: "CURRENT",
        street: "1 Main",
        street2: null,
        city: "Austin",
        state: "TX",
        zip: "78701",
        ownership: "RENT",
        isPrimary: true,
        startDate: null,
        endDate: null,
      },
    ]);

    const response = await POST(makeRequest({ type: "addresses", format: "json" }));
    const data = JSON.parse(await response.text());

    expect(response.status).toBe(200);
    expect(data.addresses).toHaveLength(1);
    expect(mockPrisma.subscription.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.address.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", deletedAt: null } }),
    );
  });

  it("explicitly excludes soft-deleted user data from full exports", async () => {
    const response = await POST(makeRequest({ type: "full", format: "json" }));

    expect(response.status).toBe(200);
    expect(mockPrisma.address.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", deletedAt: null } }),
    );
    expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", deletedAt: null } }),
    );
    expect(mockPrisma.userCustomProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", deletedAt: null } }),
    );
    expect(mockPrisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", deletedAt: null } }),
    );
    expect(mockPrisma.movingPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", deletedAt: null } }),
    );
  });

  it("requires server-side step-up before exporting data", async () => {
    mockVerifyUserStepUp.mockResolvedValue({
      ok: false,
      code: "STEP_UP_REQUIRED",
      message: "Re-authentication is required.",
    });

    const response = await POST(makeRequest({ type: "addresses", format: "json", confirmPassword: "" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("STEP_UP_REQUIRED");
    expect(mockPrisma.address.findMany).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "EXPORT_BLOCK",
      changes: expect.objectContaining({ code: "STEP_UP_REQUIRED" }),
    }));
  });

  it("applies a user-scoped export cooldown", async () => {
    mockEnforceRateLimitPolicy.mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
      policy: { userFacingErrorCode: "EXPORT_RATE_LIMITED" },
      key: "export-key",
    });

    const response = await POST(makeRequest({ type: "full", format: "json" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(body.code).toBe("EXPORT_RATE_LIMITED");
    expect(mockVerifyUserStepUp).not.toHaveBeenCalled();
  });

  it("returns the auth gate response instead of a generic 500 when unauthenticated", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await POST(makeRequest({ type: "full", format: "json" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockEnforceRateLimitPolicy).not.toHaveBeenCalled();
    expect(mockVerifyUserStepUp).not.toHaveBeenCalled();
  });
});
