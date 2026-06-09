import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  ticketFindMany: vi.fn(),
  ticketCount: vi.fn(),
  adminFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    supportTicket: {
      findMany: (...args: unknown[]) => mocks.ticketFindMany(...args),
      count: (...args: unknown[]) => mocks.ticketCount(...args),
    },
    adminUser: {
      findMany: (...args: unknown[]) => mocks.adminFindMany(...args),
    },
  },
}));

import { GET } from "./route";

const now = new Date("2026-06-09T00:00:00.000Z");

function hydrated(id: string, priority: string) {
  return {
    id,
    priority,
    status: "OPEN",
    category: "BILLING",
    subject: `S-${id}`,
    assignedTo: null,
    createdAt: now,
    updatedAt: now,
    user: { id: "u", firstName: "A", lastName: "B", email: "a@b.com" },
    messages: [],
    _count: { messages: 0 },
  };
}

describe("GET /api/tickets priority ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.ticketCount.mockResolvedValue(0);
    mocks.adminFindMany.mockResolvedValue([]);
    mocks.ticketFindMany.mockImplementation((args: any) => {
      // First call = lightweight ordering scan (has `select`); return rows in a
      // deliberately wrong order so only correct ranking produces the expected output.
      if (args?.select) {
        return Promise.resolve([
          { id: "low", priority: "LOW", updatedAt: now },
          { id: "high", priority: "HIGH", updatedAt: now },
          { id: "urgent", priority: "URGENT", updatedAt: now },
          { id: "medium", priority: "MEDIUM", updatedAt: now },
        ]);
      }
      // Second call = hydrate page by id (has `include`); `in` order is not guaranteed.
      const ids: string[] = args.where.id.in;
      return Promise.resolve(ids.map((id) => hydrated(id, id.toUpperCase())));
    });
  });

  it("ranks HIGH above LOW (not alphabetical) — order is URGENT > HIGH > MEDIUM > LOW", async () => {
    const res = await GET(new NextRequest("https://admin.locateflow.com/api/tickets"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tickets.map((t: { id: string }) => t.id)).toEqual(["urgent", "high", "medium", "low"]);
    // The alphabetical-desc bug would have produced URGENT, MEDIUM, LOW, HIGH.
    const highIdx = body.tickets.findIndex((t: { id: string }) => t.id === "high");
    const lowIdx = body.tickets.findIndex((t: { id: string }) => t.id === "low");
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it("preserves the ranked order when hydrate returns ids in a different order", async () => {
    mocks.ticketFindMany.mockImplementation((args: any) => {
      if (args?.select) {
        return Promise.resolve([
          { id: "medium", priority: "MEDIUM", updatedAt: now },
          { id: "urgent", priority: "URGENT", updatedAt: now },
          { id: "high", priority: "HIGH", updatedAt: now },
        ]);
      }
      // Return hydrated rows in REVERSE of the requested order to prove re-sorting.
      const ids: string[] = [...args.where.id.in].reverse();
      return Promise.resolve(ids.map((id) => hydrated(id, id.toUpperCase())));
    });

    const res = await GET(new NextRequest("https://admin.locateflow.com/api/tickets"));
    const body = await res.json();

    expect(body.tickets.map((t: { id: string }) => t.id)).toEqual(["urgent", "high", "medium"]);
  });
});
