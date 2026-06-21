import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@locateflow/db";

const mocks = vi.hoisted(() => ({
  leadFindUnique: vi.fn(),
  leadCreate: vi.fn(),
  encrypt: vi.fn(),
  matchPartnersForLead: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { lead: { findUnique: mocks.leadFindUnique, create: mocks.leadCreate } },
}));
vi.mock("@/lib/shared-encryption", () => ({ encrypt: mocks.encrypt }));
vi.mock("@/lib/leads/match-partners", () => ({ matchPartnersForLead: mocks.matchPartnersForLead }));

import { createLead } from "./create-lead";

const baseInput = () => ({
  userId: "u1",
  category: "cleaning",
  toState: "tx",
  contactName: "Pat Mover",
  contactEmail: "pat@x.com",
  contactPhone: "+15125550000",
  notes: "3rd floor, no elevator",
  consentAcceptedAt: new Date("2026-07-01T00:00:00.000Z"),
  idempotencyKey: "key-1",
});

describe("createLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.leadFindUnique.mockResolvedValue(null);
    mocks.encrypt.mockImplementation((s: string) => `ENC(${s.length})`);
    mocks.matchPartnersForLead.mockResolvedValue([]);
    mocks.leadCreate.mockResolvedValue({ id: "lead_new" });
  });

  it("encrypts PII into payloadEncrypted and stores NO raw contact in the clear", async () => {
    await createLead(baseInput());
    // encrypt is fed the PII JSON...
    const encArg = mocks.encrypt.mock.calls[0][0] as string;
    expect(encArg).toContain("Pat Mover");
    expect(encArg).toContain("pat@x.com");
    // ...and ONLY the encrypted output is persisted. No clear-text PII column.
    const data = mocks.leadCreate.mock.calls[0][0].data;
    expect(data.payloadEncrypted).toBe(`ENC(${encArg.length})`);
    const clearText = JSON.stringify({ ...data, payloadEncrypted: undefined });
    expect(clearText).not.toContain("Pat Mover");
    expect(clearText).not.toContain("pat@x.com");
    expect(clearText).not.toContain("+15125550000");
    expect(clearText).not.toContain("no elevator");
  });

  it("normalizes state and persists the immutable consent snapshot", async () => {
    await createLead({ ...baseInput(), termsVersion: "2026-06", consentIpHash: "ip", consentUserAgentHash: "ua" });
    const data = mocks.leadCreate.mock.calls[0][0].data;
    expect(data.toState).toBe("TX");
    expect(data.consentAcceptedAt).toEqual(new Date("2026-07-01T00:00:00.000Z"));
    expect(data.termsVersion).toBe("2026-06");
    expect(data.consentIpHash).toBe("ip");
  });

  it("fans out one QUEUED dispatch per match (status MATCHED) with a per-partner key", async () => {
    mocks.matchPartnersForLead.mockResolvedValue([
      { partnerKind: "partner", partnerId: "p1" },
      { partnerKind: "partner", partnerId: "p2" },
    ]);
    const res = await createLead(baseInput());
    expect(res.matchedCount).toBe(2);
    const data = mocks.leadCreate.mock.calls[0][0].data;
    expect(data.status).toBe("MATCHED");
    expect(data.dispatches.create).toEqual([
      { partnerKind: "partner", partnerId: "p1", status: "QUEUED", idempotencyKey: "key-1:partner:p1" },
      { partnerKind: "partner", partnerId: "p2", status: "QUEUED", idempotencyKey: "key-1:partner:p2" },
    ]);
  });

  it("status NEW when there are zero matches (captured for later)", async () => {
    const res = await createLead(baseInput());
    expect(res.matchedCount).toBe(0);
    expect(mocks.leadCreate.mock.calls[0][0].data.status).toBe("NEW");
  });

  it("dedupes a repeat submit (existing idempotencyKey) without creating", async () => {
    mocks.leadFindUnique.mockResolvedValue({ id: "lead_old", matchedCount: 3 });
    const res = await createLead(baseInput());
    expect(res).toEqual({ leadId: "lead_old", matchedCount: 3, deduped: true });
    expect(mocks.leadCreate).not.toHaveBeenCalled();
  });

  it("survives a concurrent create race (P2002) → returns the winner as a dedupe", async () => {
    mocks.leadFindUnique.mockResolvedValueOnce(null); // initial check: not yet present
    mocks.leadCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }),
    );
    mocks.leadFindUnique.mockResolvedValueOnce({ id: "lead_winner", matchedCount: 1 }); // re-query
    const res = await createLead(baseInput());
    expect(res).toEqual({ leadId: "lead_winner", matchedCount: 1, deduped: true });
  });
});
