import { describe, expect, it } from "vitest";
import { resolveAddressCreateError } from "./address-create-error";
import { buildServiceLimitCopy } from "@/components/shared/service-limit-upsell";

describe("resolveAddressCreateError", () => {
  it("maps ADDRESS_LIMIT_REACHED onto the upsell modal with /pricing as the CTA target", () => {
    const resolution = resolveAddressCreateError(
      403,
      {
        code: "ADDRESS_LIMIT_REACHED",
        error: "Your FREE_TRIAL plan allows up to 3 address(es). Please upgrade to add more.",
        upgradeRequired: true,
        current: 3,
        limit: 3,
      },
      "Failed to create address",
    );
    expect(resolution.kind).toBe("limit");
    if (resolution.kind !== "limit") return;
    expect(resolution.details.code).toBe("ADDRESS_LIMIT_REACHED");
    expect(resolution.details.limit).toBe(3);
    expect(resolution.details.current).toBe(3);
    expect(resolution.details.upgradePath).toBe("/pricing");
  });

  it("maps SETUP_ADDRESS_LIMIT_REACHED onto the upsell modal", () => {
    const resolution = resolveAddressCreateError(
      403,
      { code: "SETUP_ADDRESS_LIMIT_REACHED", upgradeRequired: true, current: 3, limit: 3 },
      "Failed to create address",
    );
    expect(resolution.kind).toBe("limit");
    if (resolution.kind !== "limit") return;
    expect(resolution.details.code).toBe("SETUP_ADDRESS_LIMIT_REACHED");
  });

  it("funnels unknown upgrade-required 403s onto the generic address-limit copy", () => {
    // SUBSCRIPTION_REQUIRED / TRIAL_EXPIRED normalizations from the
    // entitlement gate must not leak service-flavored copy or raw enums.
    const resolution = resolveAddressCreateError(
      403,
      { code: "SUBSCRIPTION_REQUIRED", error: "An active subscription is required to continue.", upgradeRequired: true },
      "Failed to create address",
    );
    expect(resolution.kind).toBe("limit");
    if (resolution.kind !== "limit") return;
    expect(resolution.details.code).toBe("ADDRESS_LIMIT_REACHED");
    expect(resolution.details.limit).toBeNull();
    const copy = buildServiceLimitCopy(resolution.details);
    expect(copy.body).not.toContain("active services");
    expect(copy.body).toContain("address limit");
  });

  it("does NOT hijack non-upgrade 403 gates (email verification, legal acceptance)", () => {
    const resolution = resolveAddressCreateError(
      403,
      { code: "EMAIL_VERIFICATION_REQUIRED", error: "Please verify your email before continuing." },
      "Failed to create address",
    );
    expect(resolution).toEqual({
      kind: "message",
      message: "Please verify your email before continuing.",
    });
  });

  it("falls back to friendly copy when the server message is a bare enum", () => {
    const resolution = resolveAddressCreateError(
      400,
      { error: "ADDRESS_LIMIT_REACHED" },
      "Failed to create address",
    );
    expect(resolution).toEqual({ kind: "message", message: "Failed to create address" });
  });

  it("falls back to friendly copy when the body is missing or malformed", () => {
    expect(resolveAddressCreateError(500, null, "Failed to create address")).toEqual({
      kind: "message",
      message: "Failed to create address",
    });
    expect(resolveAddressCreateError(500, "oops", "Failed to create address")).toEqual({
      kind: "message",
      message: "Failed to create address",
    });
  });

  it("passes through human-readable server messages for ordinary errors", () => {
    const resolution = resolveAddressCreateError(
      400,
      { error: "Validation failed" },
      "Failed to create address",
    );
    expect(resolution).toEqual({ kind: "message", message: "Validation failed" });
  });
});

describe("buildServiceLimitCopy — address limit branch", () => {
  it("renders plan-aware address copy with the real Pro cap (never 'unlimited')", () => {
    const copy = buildServiceLimitCopy({ code: "ADDRESS_LIMIT_REACHED", limit: 3, current: 3 });
    expect(copy.title).toBe("You've reached your address limit");
    expect(copy.body).toContain("up to 3 saved addresses");
    expect(copy.body).toContain("up to 25 on Pro");
    expect(copy.body).not.toContain("active services");
    expect(copy.body.toLowerCase()).not.toContain("unlimited");
    expect(copy.primary).toBe("Upgrade");
  });

  it("uses singular 'address' when the limit is 1", () => {
    const copy = buildServiceLimitCopy({ code: "ADDRESS_LIMIT_REACHED", limit: 1 });
    expect(copy.body).toContain("up to 1 saved address.");
  });

  it("switches to contact-support copy at the top-tier cap instead of a dead-end upsell", () => {
    const copy = buildServiceLimitCopy({ code: "ADDRESS_LIMIT_REACHED", limit: 25, current: 25 });
    expect(copy.body).toContain("highest cap");
    expect(copy.body).toContain("Contact support");
    expect(copy.body).not.toContain("up to 25 on Pro");
  });

  it("stays generic and friendly when the API sends no numbers", () => {
    const copy = buildServiceLimitCopy({ code: "ADDRESS_LIMIT_REACHED" });
    expect(copy.title).toBe("You've reached your address limit");
    expect(copy.body).toContain("address limit for your current plan");
  });
});
