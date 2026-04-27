import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    address: { findMany: vi.fn() },
    service: { findMany: vi.fn() },
    userCustomProvider: { findMany: vi.fn() },
    moveTask: { findMany: vi.fn() },
    userEvent: { findMany: vi.fn() },
    budget: { findMany: vi.fn() },
    movingPlan: { findMany: vi.fn() },
    subscription: { findUnique: vi.fn() },
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
  userCustomProvider: { findMany: prisma.userCustomProvider.findMany as Mock },
  moveTask: { findMany: prisma.moveTask.findMany as Mock },
  userEvent: { findMany: prisma.userEvent.findMany as Mock },
  budget: { findMany: prisma.budget.findMany as Mock },
  movingPlan: { findMany: prisma.movingPlan.findMany as Mock },
  subscription: { findUnique: (prisma as any).subscription.findUnique as Mock },
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
    mockPrisma.userCustomProvider.findMany.mockResolvedValue([]);
    mockPrisma.moveTask.findMany.mockResolvedValue([]);
    mockPrisma.userEvent.findMany.mockResolvedValue([]);
    mockPrisma.budget.findMany.mockResolvedValue([]);
    mockPrisma.movingPlan.findMany.mockResolvedValue([]);
    mockPrisma.subscription.findUnique.mockRejectedValue(new Error("subscription gate should not run"));
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

    const response = await GET(makeRequest("?type=full&format=json"));
    const data = JSON.parse(await response.text());

    expect(response.status).toBe(200);
    expect(data.customProviders).toHaveLength(1);
    expect(data.moveTasks).toHaveLength(1);
    expect(data.customProviders[0].notes).toBeNull();
    expect(data.moveTasks[0].notes).toBeNull();
  });

  it("exports custom provider and move task notes only with includeNotes=true", async () => {
    mockPrisma.userCustomProvider.findMany.mockResolvedValue([
      { name: "Local Gym", category: "FITNESS_GYM", notes: "membership note" },
    ]);
    mockPrisma.moveTask.findMany.mockResolvedValue([
      { title: "Cancel gym", actionType: "CANCEL_OR_CLOSE", status: "ACCEPTED", notes: "task note" },
    ]);

    const response = await GET(makeRequest("?type=full&format=json&includeNotes=true"));
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

    const response = await GET(makeRequest("?type=full&format=json"));
    const data = JSON.parse(await response.text());

    expect(response.status).toBe(200);
    expect(data.legalConsents).toHaveLength(1);
    expect(data.legalConsents[0].metadata.termsAccepted).toBe(true);
    expect(data.legalConsents[0].metadata.source).toBe("email_signup");
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

    const response = await GET(makeRequest("?type=addresses&format=json"));
    const data = JSON.parse(await response.text());

    expect(response.status).toBe(200);
    expect(data.addresses).toHaveLength(1);
    expect(mockPrisma.subscription.findUnique).not.toHaveBeenCalled();
  });
});
