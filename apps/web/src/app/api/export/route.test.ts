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

vi.mock("@/lib/plan-limits", () => ({
  getUserPlan: vi.fn(() =>
    Promise.resolve({ plan: "PRO", status: "ACTIVE", isActive: true, hasPremium: true, isTrialExpired: false, limits: {} }),
  ),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { verifyUserStepUp } from "@/lib/user-step-up";
import { getUserPlan } from "@/lib/plan-limits";
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
const mockGetUserPlan = getUserPlan as any;
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
    mockGetUserPlan.mockResolvedValue({ plan: "PRO", status: "ACTIVE", isActive: true, hasPremium: true, isTrialExpired: false, limits: {} });
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

  it("blocks the Pro tax export for non-Pro plans before touching data", async () => {
    mockGetUserPlan.mockResolvedValue({ plan: "FREE_TRIAL", status: "FREE_ACCESS", isActive: true, hasPremium: false, isTrialExpired: false, limits: {} });

    const response = await POST(makeRequest({ type: "tax", format: "json" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("UPGRADE_REQUIRED");
    expect(mockPrisma.address.findMany).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "EXPORT_BLOCK",
      changes: expect.objectContaining({ code: "UPGRADE_REQUIRED", type: "tax" }),
    }));
  });

  it("returns a per-property tax summary with annualized cost for Pro users", async () => {
    mockPrisma.address.findMany.mockResolvedValue([
      {
        id: "addr-1",
        nickname: "Rental Condo",
        type: "RENTAL",
        street: "5 Oak",
        street2: null,
        city: "Austin",
        state: "TX",
        zip: "78701",
        ownership: "OWN",
        isPrimary: true,
        startDate: new Date("2025-01-01"),
        endDate: null,
      },
    ]);
    mockPrisma.service.findMany.mockResolvedValue([
      { addressId: "addr-1", providerName: "Con Edison", category: "UTILITY_ELECTRIC", monthlyCost: 50, billingCycle: "MONTHLY", isActive: true },
      { addressId: null, providerName: "Floating Service", category: "OTHER", monthlyCost: 10, billingCycle: "MONTHLY", isActive: true },
    ]);
    mockPrisma.movingPlan.findMany.mockResolvedValue([
      {
        moveDate: new Date("2025-01-01"),
        status: "COMPLETED",
        fromAddressId: "addr-0",
        toAddressId: "addr-1",
        fromAddress: { city: "Dallas", state: "TX" },
        toAddress: { city: "Austin", state: "TX" },
      },
    ]);

    const response = await POST(makeRequest({ type: "tax", format: "json" }));
    const data = JSON.parse(await response.text());

    expect(response.status).toBe(200);
    // Line items: one per service; recurring cost annualized to ×12.
    expect(data.tax).toHaveLength(2);
    const conEd = data.tax.find((li: any) => li.serviceProvider === "Con Edison");
    expect(conEd).toMatchObject({ property: "Rental Condo", propertyType: "RENTAL", ownership: "OWN", annualizedCost: 600 });
    // Unassigned service falls under a synthetic "Unassigned" property bucket.
    expect(data.tax.find((li: any) => li.serviceProvider === "Floating Service").property).toBe("Unassigned");
    // Grouped per-property totals + the move that touched the address.
    expect(data.taxByProperty).toHaveLength(1);
    expect(data.taxByProperty[0]).toMatchObject({ property: "Rental Condo", serviceCount: 1, totalAnnualizedCost: 600 });
    expect(data.taxByProperty[0].moves[0]).toMatchObject({ direction: "MOVED_IN", to: "Austin, TX" });
    expect(data.taxTotals).toMatchObject({ propertyCount: 1, serviceCount: 2, totalAnnualizedCost: 720 });
  });

  it("annualizes per billing cycle — YEARLY/QUARTERLY are not multiplied by 12, ONE_TIME counts once", async () => {
    mockPrisma.address.findMany.mockResolvedValue([
      { id: "addr-1", nickname: "Home", type: "HOME", street: "1 Main", street2: null, city: "Austin", state: "TX", zip: "78701", ownership: "OWN", isPrimary: true, startDate: null, endDate: null },
    ]);
    mockPrisma.service.findMany.mockResolvedValue([
      { addressId: "addr-1", providerName: "Yearly Policy", category: "INSURANCE", monthlyCost: 1200, billingCycle: "YEARLY", isActive: true },
      { addressId: "addr-1", providerName: "Quarterly Svc", category: "OTHER", monthlyCost: 300, billingCycle: "QUARTERLY", isActive: true },
      { addressId: "addr-1", providerName: "Setup Fee", category: "OTHER", monthlyCost: 500, billingCycle: "ONE_TIME", isActive: true },
      { addressId: "addr-1", providerName: "Monthly Svc", category: "OTHER", monthlyCost: 100, billingCycle: "MONTHLY", isActive: true },
    ]);
    mockPrisma.movingPlan.findMany.mockResolvedValue([]);

    const data = JSON.parse(await (await POST(makeRequest({ type: "tax", format: "json" }))).text());

    const byProvider = (name: string) => data.tax.find((li: any) => li.serviceProvider === name);
    // YEARLY 1200/yr → 1200 annual (NOT 14,400), 100 monthly-equivalent.
    expect(byProvider("Yearly Policy")).toMatchObject({ annualizedCost: 1200, monthlyEquivalent: 100, oneTime: false });
    // QUARTERLY 300/qtr → 1200 annual, 100 monthly-equivalent.
    expect(byProvider("Quarterly Svc")).toMatchObject({ annualizedCost: 1200, monthlyEquivalent: 100 });
    // ONE_TIME 500 → counted once, no monthly recurring.
    expect(byProvider("Setup Fee")).toMatchObject({ annualizedCost: 500, monthlyEquivalent: 0, oneTime: true });
    // MONTHLY 100 → 1200 annual.
    expect(byProvider("Monthly Svc")).toMatchObject({ annualizedCost: 1200, monthlyEquivalent: 100 });
    // Totals: 1200 + 1200 + 500 + 1200 = 4100 annualized; monthly-equiv 100*3 = 300.
    expect(data.taxTotals).toMatchObject({ totalAnnualizedCost: 4100, totalMonthlyEquivalent: 300 });
  });

  it("groups by address id so two properties with the same nickname don't double-count", async () => {
    mockPrisma.address.findMany.mockResolvedValue([
      { id: "addr-1", nickname: "Rental", type: "RENTAL", street: "1 A St", street2: null, city: "Austin", state: "TX", zip: "78701", ownership: "OWN", isPrimary: true, startDate: null, endDate: null },
      { id: "addr-2", nickname: "Rental", type: "RENTAL", street: "2 B St", street2: null, city: "Dallas", state: "TX", zip: "75201", ownership: "OWN", isPrimary: false, startDate: null, endDate: null },
    ]);
    mockPrisma.service.findMany.mockResolvedValue([
      { addressId: "addr-1", providerName: "Elec A", category: "UTILITY_ELECTRIC", monthlyCost: 100, billingCycle: "MONTHLY", isActive: true },
      { addressId: "addr-2", providerName: "Elec B", category: "UTILITY_ELECTRIC", monthlyCost: 50, billingCycle: "MONTHLY", isActive: true },
    ]);
    mockPrisma.movingPlan.findMany.mockResolvedValue([]);

    const data = JSON.parse(await (await POST(makeRequest({ type: "tax", format: "json" }))).text());

    expect(data.taxByProperty).toHaveLength(2);
    // Each same-named "Rental" property holds exactly its own service.
    for (const prop of data.taxByProperty) {
      expect(prop.serviceCount).toBe(1);
    }
    expect(data.taxByProperty.map((p: any) => p.totalAnnualizedCost).sort((a: number, b: number) => a - b)).toEqual([600, 1200]);
  });

  it("emits the tax line items as CSV with an annualizedCost column", async () => {
    mockPrisma.address.findMany.mockResolvedValue([
      { id: "addr-1", nickname: "Home", type: "HOME", street: "1 Main", street2: null, city: "Austin", state: "TX", zip: "78701", ownership: "RENT", isPrimary: true, startDate: null, endDate: null },
    ]);
    mockPrisma.service.findMany.mockResolvedValue([
      { addressId: "addr-1", providerName: "PSEG", category: "UTILITY_ELECTRIC", monthlyCost: 100, billingCycle: "MONTHLY", isActive: true },
    ]);
    mockPrisma.movingPlan.findMany.mockResolvedValue([]);

    const response = await POST(makeRequest({ type: "tax", format: "csv" }));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(csv).toContain("annualizedCost");
    expect(csv).toContain("1200");
    expect(csv).toContain("PSEG");
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
