import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    address: { findMany: vi.fn() },
    service: { findMany: vi.fn() },
    budget: { findMany: vi.fn() },
    movingPlan: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/shared-encryption", () => ({
  decrypt: vi.fn((value: string) => `decrypted:${value}`),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { GET } from "./route";

const mockPrisma = {
  address: { findMany: prisma.address.findMany as Mock },
  service: { findMany: prisma.service.findMany as Mock },
  budget: { findMany: prisma.budget.findMany as Mock },
  movingPlan: { findMany: prisma.movingPlan.findMany as Mock },
};
const mockRequireDbUserId = requireDbUserId as any;

function makeRequest(search: string) {
  return new Request(`http://localhost/api/export${search}`) as any;
}

describe("export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockPrisma.address.findMany.mockResolvedValue([]);
    mockPrisma.service.findMany.mockResolvedValue([]);
    mockPrisma.budget.findMany.mockResolvedValue([]);
    mockPrisma.movingPlan.findMany.mockResolvedValue([]);
  });

  it("masks sensitive service fields in JSON exports", async () => {
    mockPrisma.service.findMany.mockResolvedValue([
      {
        category: "UTILITY",
        providerName: "Austin Energy",
        accountNumber: "acct-1234",
        website: "https://example.com",
        phone: "5551234567",
        email: "customer@example.com",
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

    const response = await GET(makeRequest("?type=services&format=json"));
    const text = await response.text();
    const data = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(data.services).toHaveLength(1);
    expect(data.services[0].accountNumber).toBe("****1234");
    expect(data.services[0].email).toBe("cu****@example.com");
    expect(data.services[0].phone).toBe("****4567");
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

    const withoutNotes = await GET(makeRequest("?type=services&format=json"));
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
    const withNotes = await GET(
      makeRequest("?type=services&format=json&includeNotes=true"),
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
        email: "customer@example.com",
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

    const response = await GET(makeRequest("?type=services&format=csv"));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).toContain("****1234");
  });
});
