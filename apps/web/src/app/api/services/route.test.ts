import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    service: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    address: { findUnique: vi.fn() },
    serviceProvider: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    userCustomProvider: { findFirst: vi.fn() },
    subscription: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
  requireVerifiedUser: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  extractRequestMeta: vi.fn(() => ({})),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/shared-encryption", () => ({
  decrypt: vi.fn((value: string) => value.replace(/^enc:/, "")),
  encrypt: vi.fn((value: string) => `enc:${value}`),
  isEncrypted: vi.fn((value: string) => typeof value === "string" && value.startsWith("enc:")),
}));

vi.mock("@/lib/plan-limits", () => ({
  canCreateService: vi.fn(() => Promise.resolve({ allowed: true })),
}));

vi.mock("@/lib/acquisition-campaigns", () => ({
  getPublicSubscriptionOffersViewModel: vi.fn(() =>
    Promise.resolve({
      annualTrial: {
        campaignCode: "SPRING90",
        accessType: "FREE_TRIAL",
        publicHeadline: "Start with 90 days free",
        publicSubheadline: "Individual Annual starts after your trial.",
        checkoutDisclosureCopy: null,
        displayPriceLabel: "$39.99/year",
        trialDays: 90,
        billingInterval: "YEAR",
        ctaText: "Start 90 days free",
        priceCopy: "$39.99/year after trial",
        trialLabel: "3 months",
      },
      monthlyPaid: {
        campaignCode: "MONTHLY",
        accessType: "PAID",
        publicHeadline: "Subscribe monthly",
        publicSubheadline: "Simple monthly billing.",
        checkoutDisclosureCopy: null,
        displayPriceLabel: "$3.99/month",
        trialDays: null,
        billingInterval: "MONTH",
        ctaText: "Subscribe monthly",
        priceCopy: "$3.99/month",
        trialLabel: null,
      },
    }),
  ),
}));

vi.mock("@/lib/move-task-sync", () => ({
  safeSyncMoveTasksForAddress: vi.fn(() => Promise.resolve({ attemptedPlans: 0, generatedCount: 0, skippedCount: 0, failedPlanIds: [] })),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId, requireVerifiedUser } from "@/lib/auth";
import { canCreateService } from "@/lib/plan-limits";
import { getPublicSubscriptionOffersViewModel } from "@/lib/acquisition-campaigns";
import { safeSyncMoveTasksForAddress } from "@/lib/move-task-sync";
import { GET, POST } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockRequireVerifiedUser = requireVerifiedUser as unknown as Mock;
const mockService = prisma.service as unknown as {
  findMany: Mock;
  count: Mock;
  create: Mock;
};
const mockAddress = prisma.address as unknown as { findUnique: Mock };
const mockServiceProvider = prisma.serviceProvider as unknown as { findUnique: Mock; findMany: Mock; update: Mock };
const mockCustomProvider = prisma.userCustomProvider as unknown as { findFirst: Mock };
const mockSubscription = prisma.subscription as unknown as { findUnique: Mock };
const mockCanCreateService = canCreateService as unknown as Mock;
const mockGetPublicSubscriptionOffersViewModel = getPublicSubscriptionOffersViewModel as unknown as Mock;
const mockSafeSyncMoveTasksForAddress = safeSyncMoveTasksForAddress as unknown as Mock;

function makeRequest(search = "") {
  return new Request(`http://localhost/api/services${search}`) as any;
}

describe("services route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockRequireVerifiedUser.mockResolvedValue("user-1");
    mockService.findMany.mockResolvedValue([]);
    mockService.count.mockResolvedValue(0);
    mockService.create.mockResolvedValue({ id: "service-new" });
    mockAddress.findUnique.mockResolvedValue({
      id: "address-1",
      userId: "user-1",
      deletedAt: null,
    });
    mockServiceProvider.findUnique.mockResolvedValue({
      id: "provider-1",
      deletedAt: null,
    });
    mockServiceProvider.findMany.mockResolvedValue([]);
    mockCustomProvider.findFirst.mockResolvedValue(null);
    mockCanCreateService.mockResolvedValue({ allowed: true });
    mockSubscription.findUnique.mockResolvedValue(null);
    mockGetPublicSubscriptionOffersViewModel.mockResolvedValue({
      annualTrial: {
        campaignCode: "SPRING90",
        accessType: "FREE_TRIAL",
        publicHeadline: "Start with 90 days free",
        publicSubheadline: "Individual Annual starts after your trial.",
        checkoutDisclosureCopy: null,
        displayPriceLabel: "$39.99/year",
        trialDays: 90,
        billingInterval: "YEAR",
        ctaText: "Start 90 days free",
        priceCopy: "$39.99/year after trial",
        trialLabel: "3 months",
      },
      monthlyPaid: {
        campaignCode: "MONTHLY",
        accessType: "PAID",
        publicHeadline: "Subscribe monthly",
        publicSubheadline: "Simple monthly billing.",
        checkoutDisclosureCopy: null,
        displayPriceLabel: "$3.99/month",
        trialDays: null,
        billingInterval: "MONTH",
        ctaText: "Subscribe monthly",
        priceCopy: "$3.99/month",
        trialLabel: null,
      },
    });
  });

  it("returns an empty service list for an authenticated new user", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services).toEqual([]);
    expect(mockService.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", deletedAt: null }),
      }),
    );
  });

  it("returns 401 instead of a server error when the session is invalid", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Please sign in again.");
  });

  it("blocks duplicate listed provider services for the same address and category", async () => {
    mockService.findMany.mockResolvedValueOnce([
      {
        id: "service-existing",
        providerName: "PSE&G",
        providerId: "provider-1",
        customProviderId: null,
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("DUPLICATE_ACTIVE_SERVICE");
    expect(body.existingServiceId).toBe("service-existing");
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("returns EMAIL_VERIFICATION_REQUIRED when a service mutation is blocked by the verified-user gate", async () => {
    mockRequireVerifiedUser.mockRejectedValueOnce(new Error("EMAIL_VERIFICATION_REQUIRED"));

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "EMAIL_VERIFICATION_REQUIRED",
      redirectTo: "/verify-email?redirect=%2Fservices",
    });
    expect(mockCanCreateService).not.toHaveBeenCalled();
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("returns UNAUTHORIZED for unauthenticated service creation", async () => {
    mockRequireVerifiedUser.mockRejectedValueOnce(new Error("UNAUTHORIZED"));

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("rejects services for soft-deleted addresses", async () => {
    mockAddress.findUnique.mockResolvedValueOnce({
      id: "address-1",
      userId: "user-1",
      deletedAt: new Date(),
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );

    expect(response.status).toBe(404);
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("encrypts service contact and account fields before creating", async () => {
    mockService.create.mockResolvedValueOnce({
      id: "service-new",
      accountNumber: "enc:acct-1234",
      username: "enc:user-1234",
      phone: "enc:1-800-436-7734",
      email: "enc:customer@example.com",
      notes: "enc:private note",
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
          accountNumber: "acct-1234",
          username: "user-1234",
          phone: "1-800-436-7734",
          email: "customer@example.com",
          notes: "private note",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.service).toMatchObject({
      accountNumber: "acct-1234",
      username: "user-1234",
      phone: "1-800-436-7734",
      email: "customer@example.com",
      notes: "private note",
    });
    expect(mockService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountNumber: "enc:acct-1234",
          username: "enc:user-1234",
          phone: "enc:1-800-436-7734",
          email: "enc:customer@example.com",
          notes: "enc:private note",
        }),
      }),
    );
  });

  it("does not fail service creation when move task sync reports a non-blocking failure", async () => {
    mockSafeSyncMoveTasksForAddress.mockResolvedValueOnce({
      attemptedPlans: 0,
      generatedCount: 0,
      skippedCount: 0,
      failedPlanIds: [],
      syncFailed: true,
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.moveTaskSync.syncFailed).toBe(true);
    expect(mockService.create).toHaveBeenCalled();
  });

  it("returns structured entitlement errors for expired complete users", async () => {
    mockCanCreateService.mockResolvedValueOnce({
      allowed: false,
      code: "TRIAL_EXPIRED",
      reason: "Your trial has ended. Upgrade to add more services.",
      upgradeRequired: true,
      current: 10,
      limit: 10,
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "SUBSCRIPTION_REQUIRED",
      entitlementCode: "TRIAL_EXPIRED",
      upgradeRequired: true,
      current: 10,
      limit: 10,
    });
    expect(mockAddress.findUnique).not.toHaveBeenCalled();
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("returns SERVICE_LIMIT_REACHED for active service cap failures", async () => {
    mockCanCreateService.mockResolvedValueOnce({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      reason: "Your FREE_TRIAL plan allows up to 10 services. Please upgrade.",
      upgradeRequired: true,
      current: 10,
      limit: 10,
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "SERVICE_LIMIT_REACHED",
      entitlementCode: "SERVICE_LIMIT_REACHED",
      current: 10,
      limit: 10,
    });
    expect(mockAddress.findUnique).not.toHaveBeenCalled();
    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("marks Free Access users as eligibleForTrial=true even when status is ACTIVE", async () => {
    mockCanCreateService.mockResolvedValueOnce({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      reason: "Your FREE_TRIAL plan allows up to 10 services. Please upgrade.",
      upgradeRequired: true,
      current: 10,
      limit: 10,
    });
    mockSubscription.findUnique.mockResolvedValueOnce({
      status: "ACTIVE",
      accessType: "FREE_ACCESS",
      plan: "FREE_TRIAL",
      provider: "ADMIN",
      stripeSubscriptionId: null,
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "SERVICE_LIMIT_REACHED",
      accessType: "FREE_ACCESS",
      eligibleForTrial: true,
      subscription: {
        accessType: "FREE_ACCESS",
        plan: "FREE_TRIAL",
        eligibleForTrial: true,
      },
      campaign: {
        code: "SPRING90",
        publicHeadline: "Start with 90 days free",
        displayPriceLabel: "$39.99/year",
        trialDays: 90,
      },
    });
  });

  it("returns campaign=null when no active public campaign is available", async () => {
    mockCanCreateService.mockResolvedValueOnce({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      reason: "Your FREE_ACCESS plan allows up to 10 services. Please upgrade.",
      upgradeRequired: true,
      current: 10,
      limit: 10,
    });
    mockSubscription.findUnique.mockResolvedValueOnce({
      status: "ACTIVE",
      accessType: "FREE_ACCESS",
      plan: "FREE_TRIAL",
      provider: "ADMIN",
      stripeSubscriptionId: null,
    });
    mockGetPublicSubscriptionOffersViewModel.mockResolvedValueOnce({
      annualTrial: null,
      monthlyPaid: null,
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.campaign).toBeNull();
    expect(body.monthlyOffer).toBeNull();
    expect(body.subscription).toMatchObject({ eligibleForTrial: true });
  });

  it("returns the monthly paid offer when no annual trial campaign is active", async () => {
    mockCanCreateService.mockResolvedValueOnce({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      reason: "Your FREE_ACCESS plan allows up to 10 services. Please upgrade.",
      upgradeRequired: true,
      current: 10,
      limit: 10,
    });
    mockSubscription.findUnique.mockResolvedValueOnce({
      status: "ACTIVE",
      accessType: "FREE_ACCESS",
      plan: "FREE_TRIAL",
      provider: "ADMIN",
      stripeSubscriptionId: null,
    });
    mockGetPublicSubscriptionOffersViewModel.mockResolvedValueOnce({
      annualTrial: null,
      monthlyPaid: {
        campaignCode: "MONTHLY",
        accessType: "PAID",
        publicHeadline: "Subscribe monthly",
        publicSubheadline: "Simple monthly billing.",
        checkoutDisclosureCopy: null,
        displayPriceLabel: "$3.99/month",
        trialDays: null,
        billingInterval: "MONTH",
        ctaText: "Subscribe monthly",
        priceCopy: "$3.99/month",
        trialLabel: null,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.campaign).toMatchObject({
      code: "MONTHLY",
      accessType: "PAID",
      billingInterval: "MONTH",
      trialDays: null,
    });
    expect(body.monthlyOffer).toMatchObject({ code: "MONTHLY" });
  });

  it("marks real Stripe-backed paid users as eligibleForTrial=false", async () => {
    mockCanCreateService.mockResolvedValueOnce({
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      reason: "Your INDIVIDUAL plan allows up to 100 services. Please upgrade.",
      upgradeRequired: true,
      current: 100,
      limit: 100,
    });
    mockSubscription.findUnique.mockResolvedValueOnce({
      status: "ACTIVE",
      accessType: "PAID",
      plan: "INDIVIDUAL",
      provider: "STRIPE",
      stripeSubscriptionId: "sub_paid_42",
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      accessType: "PAID",
      eligibleForTrial: false,
      subscription: {
        accessType: "PAID",
        plan: "INDIVIDUAL",
        eligibleForTrial: false,
      },
      campaign: null,
    });
    expect(mockGetPublicSubscriptionOffersViewModel).not.toHaveBeenCalled();
  });

  it("returns FORBIDDEN when creating a service for another user's address", async () => {
    mockAddress.findUnique.mockResolvedValueOnce({
      id: "address-1",
      userId: "user-2",
      deletedAt: null,
    });

    const response = await POST(
      new Request("http://localhost/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "address-1",
          providerId: "provider-1",
          category: "UTILITY_ELECTRIC",
          providerName: "PSE&G",
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
    expect(mockService.create).not.toHaveBeenCalled();
  });
});
