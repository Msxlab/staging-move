import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  partnerUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { partner: { update: mocks.partnerUpdate } } }));
vi.mock("@/lib/partner-portal-auth", () => ({ getPartnerPortalSession: mocks.getSession }));

import { POST } from "./route";

function req(optIn: string | null) {
  const body = new FormData();
  if (optIn !== null) body.set("optIn", optIn);
  return new Request("https://app.locateflow.com/api/partners/portal/leads-optin", { method: "POST", body });
}

describe("POST /api/partners/portal/leads-optin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.partnerUpdate.mockResolvedValue({});
  });

  it("requires a portal session — no session redirects without updating", async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await POST(req("true") as never);
    expect(res.status).toBe(303);
    expect(mocks.partnerUpdate).not.toHaveBeenCalled();
  });

  it("opts the session partner IN (optIn=true)", async () => {
    mocks.getSession.mockResolvedValue({ partnerId: "ptr1", email: "a@b.com" });
    const res = await POST(req("true") as never);
    expect(res.status).toBe(303);
    expect(mocks.partnerUpdate).toHaveBeenCalledWith({ where: { id: "ptr1" }, data: { leadsOptIn: true } });
  });

  it("opts the session partner OUT (optIn=false)", async () => {
    mocks.getSession.mockResolvedValue({ partnerId: "ptr1", email: "a@b.com" });
    await POST(req("false") as never);
    expect(mocks.partnerUpdate).toHaveBeenCalledWith({ where: { id: "ptr1" }, data: { leadsOptIn: false } });
  });

  it("treats a missing/garbage value as opt-out (fail-closed)", async () => {
    mocks.getSession.mockResolvedValue({ partnerId: "ptr1", email: "a@b.com" });
    await POST(req(null) as never);
    expect(mocks.partnerUpdate).toHaveBeenCalledWith({ where: { id: "ptr1" }, data: { leadsOptIn: false } });
  });
});
