import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    userCustomProvider: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    serviceProvider: {
      findMany: vi.fn(),
    },
    userEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  extractRequestMeta: vi.fn(() => ({})),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/plan-limits", () => ({
  canCreateCustomProvider: vi.fn(() => Promise.resolve({ allowed: true })),
  canCreateService: vi.fn(() => Promise.resolve({ allowed: true })),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { canCreateService } from "@/lib/plan-limits";
import { POST } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockCustomProvider = prisma.userCustomProvider as unknown as {
  findMany: Mock;
  create: Mock;
};
const mockServiceProvider = prisma.serviceProvider as unknown as {
  findMany: Mock;
};
const mockUserEvent = prisma.userEvent as unknown as {
  create: Mock;
};
const mockCanCreateService = canCreateService as unknown as Mock;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/custom-providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("custom providers route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockCustomProvider.findMany.mockResolvedValue([]);
    mockCustomProvider.create.mockResolvedValue({
      id: "custom-new",
      name: "Corner Gym",
      category: "FITNESS_GYM",
      providerType: "GYM",
    });
    mockServiceProvider.findMany.mockResolvedValue([]);
    mockUserEvent.create.mockResolvedValue({});
  });

  it("blocks duplicate custom providers for the same user and category", async () => {
    mockCustomProvider.findMany.mockResolvedValueOnce([
      { id: "custom-existing", name: "Corner Gym" },
    ]);

    const response = await POST(
      makeRequest({
        name: "corner-gym",
        category: "FITNESS_GYM",
        providerType: "GYM",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.existingProviderId).toBe("custom-existing");
    expect(mockCustomProvider.create).not.toHaveBeenCalled();
  });

  it("blocks private custom providers that shadow a listed provider", async () => {
    mockServiceProvider.findMany.mockResolvedValueOnce([
      { id: "provider-1", name: "PSE&G", slug: "pseg" },
    ]);

    const response = await POST(
      makeRequest({
        name: "PSE G",
        category: "UTILITY_ELECTRIC",
        providerType: "OTHER",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.listedProviderSlug).toBe("pseg");
    expect(mockCustomProvider.create).not.toHaveBeenCalled();
  });

  it("does not check service quota for custom-provider-only creation", async () => {
    mockCanCreateService.mockResolvedValue({ allowed: false, code: "SERVICE_LIMIT_REACHED" });

    const response = await POST(
      makeRequest({
        name: "Private Tutor",
        category: "EDUCATION",
        providerType: "PROFESSIONAL_SERVICE",
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCanCreateService).not.toHaveBeenCalled();
    expect(mockCustomProvider.create).toHaveBeenCalled();
  });
});
