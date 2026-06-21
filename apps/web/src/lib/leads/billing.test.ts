import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
  ledgerFindUnique: vi.fn(),
  ledgerCreate: vi.fn(),
  dispatchUpdate: vi.fn(),
}));

vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: mocks.getRuntimeConfigValue }));
vi.mock("@/lib/db", () => ({
  prisma: {
    partnerLedgerEntry: { findUnique: mocks.ledgerFindUnique, create: mocks.ledgerCreate },
    leadDispatch: { update: mocks.dispatchUpdate },
  },
}));

import { accruePartnerLeadCharge, resolveCplCents } from "./billing";

const NOW = new Date("2026-07-15T00:00:00.000Z");

describe("partner CPL billing accrual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ledgerFindUnique.mockResolvedValue(null);
    mocks.ledgerCreate.mockResolvedValue({});
    mocks.dispatchUpdate.mockResolvedValue({});
  });

  it("resolveCplCents reads the per-category rate; unset/invalid → 0", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValueOnce("1500");
    expect(await resolveCplCents("cleaning")).toBe(1500);
    expect(mocks.getRuntimeConfigValue).toHaveBeenCalledWith("CPL_CENTS_CLEANING");
    mocks.getRuntimeConfigValue.mockResolvedValueOnce(null);
    expect(await resolveCplCents("junk")).toBe(0);
    mocks.getRuntimeConfigValue.mockResolvedValueOnce("-5");
    expect(await resolveCplCents("junk")).toBe(0);
  });

  it("accrues a PENDING CPL ledger line + stamps the dispatch when a rate is set", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue("1500");
    const res = await accruePartnerLeadCharge({ leadDispatchId: "d1", partnerId: "p1", category: "cleaning", now: NOW });
    expect(res).toEqual({ accrued: true, amountCents: 1500 });
    expect(mocks.ledgerCreate.mock.calls[0][0].data).toMatchObject({
      partnerId: "p1",
      kind: "CPL",
      amountCents: 1500,
      leadDispatchId: "d1",
      periodKey: "2026-07",
      status: "PENDING",
    });
    expect(mocks.dispatchUpdate).toHaveBeenCalledWith({ where: { id: "d1" }, data: { cplCents: 1500 } });
  });

  it("no rate → no charge (fail-safe free)", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);
    const res = await accruePartnerLeadCharge({ leadDispatchId: "d1", partnerId: "p1", category: "cleaning", now: NOW });
    expect(res.accrued).toBe(false);
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
  });

  it("is idempotent — an existing ledger line for the delivery is not re-charged", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue("1500");
    mocks.ledgerFindUnique.mockResolvedValue({ id: "existing" });
    const res = await accruePartnerLeadCharge({ leadDispatchId: "d1", partnerId: "p1", category: "cleaning", now: NOW });
    expect(res.accrued).toBe(false);
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
  });

  it("never throws (a DB error returns no-charge so delivery is never blocked)", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue("1500");
    mocks.ledgerCreate.mockRejectedValue(new Error("db down"));
    const res = await accruePartnerLeadCharge({ leadDispatchId: "d1", partnerId: "p1", category: "cleaning", now: NOW });
    expect(res.accrued).toBe(false);
  });
});
