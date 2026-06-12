import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  refreshPartnerConsentById: vi.fn(),
}));

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: (...args: unknown[]) => mocks.guardCronRequest(...args),
}));

vi.mock("@/lib/partner-consent-refresh", () => ({
  refreshPartnerConsentById: (...args: unknown[]) => mocks.refreshPartnerConsentById(...args),
}));

import { GET, POST } from "./route";

const context = { params: Promise.resolve({ id: "consent-1" }) };

describe("partner consent refresh cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardCronRequest.mockResolvedValue({ ok: true });
    mocks.refreshPartnerConsentById.mockResolvedValue(Response.json({ refreshed: true }));
  });

  it("refreshes the consent through the scheduler-safe GET route", async () => {
    const response = await GET(new Request("https://locateflow.com/api/cron/partner-consents/consent-1/refresh") as any, context);

    expect(response.status).toBe(200);
    expect(mocks.guardCronRequest).toHaveBeenCalledWith(expect.any(Request), "partner-consent-refresh", {
      limit: 60,
    });
    expect(mocks.refreshPartnerConsentById).toHaveBeenCalledWith("consent-1");
  });

  it("keeps POST compatible for scheduler clients that use POST", async () => {
    await POST(new Request("https://locateflow.com/api/cron/partner-consents/consent-1/refresh") as any, context);

    expect(mocks.refreshPartnerConsentById).toHaveBeenCalledWith("consent-1");
  });

  it("does not refresh when the cron guard rejects the request", async () => {
    mocks.guardCronRequest.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(new Request("https://locateflow.com/api/cron/partner-consents/consent-1/refresh") as any, context);

    expect(response.status).toBe(401);
    expect(mocks.refreshPartnerConsentById).not.toHaveBeenCalled();
  });
});
