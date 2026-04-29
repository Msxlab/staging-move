import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { resolveMarketingCtaTarget } from "./marketing-cta";

const findUnique = (prisma.subscription as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique;

describe("resolveMarketingCtaTarget", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("routes anonymous users to the sign-up flow", async () => {
    await expect(resolveMarketingCtaTarget(null)).resolves.toEqual({
      href: "/sign-up",
      intent: "anonymous",
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("routes logged-in Free Access users to the subscription upgrade page", async () => {
    findUnique.mockResolvedValue({
      status: "ACTIVE",
      accessType: "FREE_ACCESS",
      freeAccessEndsAt: new Date(Date.now() + 30 * 86400_000),
    });
    const target = await resolveMarketingCtaTarget("user_1");
    expect(target.href).toBe("/settings/subscription");
    expect(target.intent).toBe("upgrade");
  });

  it("routes trialing users to subscription management, not sign-up or dashboard", async () => {
    findUnique.mockResolvedValue({
      status: "TRIALING",
      accessType: "FREE_TRIAL",
      trialEndsAt: new Date(Date.now() + 60 * 86400_000),
    });
    const target = await resolveMarketingCtaTarget("user_1");
    expect(target.href).toBe("/settings/subscription");
    expect(target.intent).toBe("manage");
  });

  it("routes active paid users to subscription management", async () => {
    findUnique.mockResolvedValue({
      status: "ACTIVE",
      accessType: "PAID",
      currentPeriodEndsAt: new Date(Date.now() + 365 * 86400_000),
    });
    const target = await resolveMarketingCtaTarget("user_1");
    expect(target.href).toBe("/settings/subscription");
    expect(target.intent).toBe("manage");
  });

  it("falls through to upgrade when subscription lookup returns nothing", async () => {
    findUnique.mockResolvedValue(null);
    const target = await resolveMarketingCtaTarget("user_1");
    expect(target.intent).toBe("upgrade");
  });
});
