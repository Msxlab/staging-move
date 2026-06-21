import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatchFindMany: vi.fn(),
  dispatchUpdate: vi.fn(),
  moverFindUnique: vi.fn(),
  partnerFindUnique: vi.fn(),
  sendLoggedEmail: vi.fn(),
  decrypt: vi.fn(),
  accruePartnerLeadCharge: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    leadDispatch: { findMany: mocks.dispatchFindMany, update: mocks.dispatchUpdate },
    moverApplication: { findUnique: mocks.moverFindUnique },
    partner: { findUnique: mocks.partnerFindUnique },
  },
}));
vi.mock("@/lib/shared-encryption", () => ({ decrypt: mocks.decrypt }));
vi.mock("@/lib/email-service", () => ({ sendLoggedEmail: mocks.sendLoggedEmail }));
vi.mock("@/lib/leads/billing", () => ({ accruePartnerLeadCharge: mocks.accruePartnerLeadCharge }));

import { drainLeadDispatches } from "./dispatch-leads";

const NOW = new Date("2026-07-01T00:00:00.000Z");

const dispatch = (over: Record<string, unknown> = {}) => ({
  id: "d1",
  leadId: "lead1",
  partnerKind: "mover_application",
  partnerId: "app1",
  idempotencyKey: "lead1:mover_application:app1",
  attemptCount: 0,
  lead: {
    fromZip: "90001",
    toZip: "78701",
    fromState: "CA",
    toState: "TX",
    moveDate: new Date("2026-08-01T00:00:00.000Z"),
    homeSize: "TWO_BR",
    payloadEncrypted: "enc",
  },
  ...over,
});

describe("drainLeadDispatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.decrypt.mockReturnValue(JSON.stringify({ contactName: "Pat", contactEmail: "pat@x.com" }));
    mocks.moverFindUnique.mockResolvedValue({ contactEmail: "mover@co.com", status: "APPROVED" });
    mocks.partnerFindUnique.mockResolvedValue({ contactEmail: "cleaner@co.com", status: "APPROVED" });
    mocks.dispatchUpdate.mockResolvedValue({});
    mocks.accruePartnerLeadCharge.mockResolvedValue({ accrued: false, amountCents: 0 });
  });

  it("emails the partner and marks the dispatch SENT (idempotent via dedupeKey)", async () => {
    mocks.dispatchFindMany.mockResolvedValue([dispatch()]);
    mocks.sendLoggedEmail.mockResolvedValue({ success: true, skipped: false });

    const res = await drainLeadDispatches({ now: NOW });

    expect(res).toMatchObject({ processed: 1, sent: 1, failed: 0, retried: 0 });
    expect(mocks.sendLoggedEmail.mock.calls[0][0]).toMatchObject({
      to: "mover@co.com",
      dedupeKey: "lead1:mover_application:app1",
    });
    // PII appears only in the email body, decrypted at send time.
    expect(mocks.sendLoggedEmail.mock.calls[0][0].html).toContain("Pat");
    expect(mocks.dispatchUpdate.mock.calls[0][0].data).toMatchObject({ status: "SENT" });
    // Movers are not billed via the partner CPL ledger.
    expect(mocks.accruePartnerLeadCharge).not.toHaveBeenCalled();
  });

  it("routes a generic Partner dispatch (R4) to the Partner's contactEmail", async () => {
    mocks.dispatchFindMany.mockResolvedValue([
      dispatch({ partnerKind: "partner", partnerId: "ptr1", idempotencyKey: "lead1:partner:ptr1" }),
    ]);
    mocks.sendLoggedEmail.mockResolvedValue({ success: true, skipped: false });

    const res = await drainLeadDispatches({ now: NOW });

    expect(res.sent).toBe(1);
    expect(mocks.partnerFindUnique).toHaveBeenCalledWith({ where: { id: "ptr1" }, select: { contactEmail: true, status: true } });
    expect(mocks.moverFindUnique).not.toHaveBeenCalled();
    expect(mocks.sendLoggedEmail.mock.calls[0][0].to).toBe("cleaner@co.com");
    // R5: a delivered Partner lead accrues a CPL charge.
    expect(mocks.accruePartnerLeadCharge).toHaveBeenCalledWith(
      expect.objectContaining({ leadDispatchId: "d1", partnerId: "ptr1" }),
    );
  });

  it("a deduped send still counts as delivered (SENT)", async () => {
    mocks.dispatchFindMany.mockResolvedValue([dispatch()]);
    mocks.sendLoggedEmail.mockResolvedValue({ success: false, skipped: true });
    const res = await drainLeadDispatches({ now: NOW });
    expect(res.sent).toBe(1);
    expect(mocks.dispatchUpdate.mock.calls[0][0].data.status).toBe("SENT");
  });

  it("marks NO_CONTACT FAILED (terminal) when the partner has no email", async () => {
    mocks.dispatchFindMany.mockResolvedValue([dispatch()]);
    mocks.moverFindUnique.mockResolvedValue({ contactEmail: null, status: "APPROVED" });
    const res = await drainLeadDispatches({ now: NOW });
    expect(res.failed).toBe(1);
    expect(mocks.dispatchUpdate.mock.calls[0][0].data).toMatchObject({ status: "FAILED", lastErrorCode: "NO_CONTACT" });
    expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
  });

  it("does NOT deliver PII (or accrue a CPL) to a partner de-authorized since the lead was queued", async () => {
    // A generic Partner whose dispatch sat QUEUED while an admin flipped them away
    // from APPROVED — re-checked at send time, terminal FAILED, no email, no charge.
    mocks.dispatchFindMany.mockResolvedValue([
      dispatch({ partnerKind: "partner", partnerId: "ptr1", idempotencyKey: "lead1:partner:ptr1" }),
    ]);
    mocks.partnerFindUnique.mockResolvedValue({ contactEmail: "cleaner@co.com", status: "REJECTED" });
    const res = await drainLeadDispatches({ now: NOW });
    expect(res.failed).toBe(1);
    expect(mocks.dispatchUpdate.mock.calls[0][0].data).toMatchObject({ status: "FAILED", lastErrorCode: "NOT_APPROVED" });
    expect(mocks.sendLoggedEmail).not.toHaveBeenCalled();
    expect(mocks.accruePartnerLeadCharge).not.toHaveBeenCalled();
  });

  it("retries with backoff on a send failure, then FAILS at max attempts", async () => {
    // attempt 0 -> retry (stays QUEUED with nextRetryAt)
    mocks.dispatchFindMany.mockResolvedValue([dispatch({ attemptCount: 0 })]);
    mocks.sendLoggedEmail.mockResolvedValue({ success: false, skipped: false });
    let res = await drainLeadDispatches({ now: NOW });
    expect(res.retried).toBe(1);
    const retryData = mocks.dispatchUpdate.mock.calls[0][0].data;
    expect(retryData.attemptCount).toBe(1);
    expect(retryData.nextRetryAt).toBeInstanceOf(Date);

    // attempt 4 (5th) -> terminal FAILED
    vi.clearAllMocks();
    mocks.decrypt.mockReturnValue("{}");
    mocks.moverFindUnique.mockResolvedValue({ contactEmail: "mover@co.com", status: "APPROVED" });
    mocks.dispatchUpdate.mockResolvedValue({});
    mocks.dispatchFindMany.mockResolvedValue([dispatch({ attemptCount: 4 })]);
    mocks.sendLoggedEmail.mockResolvedValue({ success: false, skipped: false });
    res = await drainLeadDispatches({ now: NOW });
    expect(res.failed).toBe(1);
    expect(mocks.dispatchUpdate.mock.calls[0][0].data).toMatchObject({ status: "FAILED" });
  });

  it("only claims QUEUED, due dispatches", async () => {
    mocks.dispatchFindMany.mockResolvedValue([]);
    await drainLeadDispatches({ now: NOW });
    const where = mocks.dispatchFindMany.mock.calls[0][0].where;
    expect(where.status).toBe("QUEUED");
    expect(where.OR).toEqual([{ nextRetryAt: null }, { nextRetryAt: { lte: NOW } }]);
  });
});
