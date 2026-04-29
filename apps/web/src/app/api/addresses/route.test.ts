import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    address: {
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    userEvent: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
  requireVerifiedUser: vi.fn(),
}));

vi.mock("@/lib/api-gates", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-gates")>("@/lib/api-gates");
  return {
    ...actual,
    requireAppMutationUser: vi.fn(),
  };
});

vi.mock("@/lib/plan-limits", async () => {
  const actual = await vi.importActual<typeof import("@/lib/plan-limits")>("@/lib/plan-limits");
  return {
    ...actual,
    canCreateAddress: vi.fn(),
  };
});

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "address-rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/shared-encryption", () => ({
  encrypt: vi.fn((value: string) => `enc:${value}`),
  decrypt: vi.fn((value: string) => value.replace(/^enc:/, "")),
}));

import { prisma } from "@/lib/db";
import { requireAppMutationUser } from "@/lib/api-gates";
import { canCreateAddress } from "@/lib/plan-limits";
import { POST } from "./route";

const requireAppMutationUserMock = requireAppMutationUser as unknown as Mock;
const canCreateAddressMock = canCreateAddress as unknown as Mock;
const addressMock = prisma.address as unknown as {
  create: Mock;
  updateMany: Mock;
};

function postAddress() {
  return POST(
    new Request("http://localhost/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "HOME",
        nickname: "Home",
        street: "123 Main St",
        city: "Austin",
        state: "TX",
        zip: "78701",
        country: "USA",
        ownership: "OWNER",
        startDate: "2026-05-01",
      }),
    }) as any,
  );
}

describe("address mutation gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppMutationUserMock.mockResolvedValue("user-1");
    canCreateAddressMock.mockResolvedValue({ allowed: true });
    addressMock.create.mockImplementation(({ data }) => Promise.resolve({ id: "addr-1", ...data }));
    addressMock.updateMany.mockResolvedValue({ count: 0 });
  });

  it.each([
    ["UNAUTHORIZED", 401],
    ["EMAIL_VERIFICATION_REQUIRED", 403],
    ["LEGAL_ACCEPTANCE_REQUIRED", 403],
  ])("returns a structured %s response before creating an address", async (code, status) => {
    requireAppMutationUserMock.mockRejectedValueOnce(new Error(code));

    const response = await postAddress();
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body.code).toBe(code);
    expect(addressMock.create).not.toHaveBeenCalled();
  });

  it("normalizes inactive-plan address failures to SUBSCRIPTION_REQUIRED", async () => {
    canCreateAddressMock.mockResolvedValueOnce({
      allowed: false,
      code: "SUBSCRIPTION_INACTIVE",
      reason: "Your subscription is not active.",
      upgradeRequired: true,
    });

    const response = await postAddress();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("SUBSCRIPTION_REQUIRED");
    expect(body.entitlementCode).toBe("SUBSCRIPTION_INACTIVE");
    expect(addressMock.create).not.toHaveBeenCalled();
  });
});
