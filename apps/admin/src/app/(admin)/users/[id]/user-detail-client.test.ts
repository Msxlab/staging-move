import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(resolve(here, "user-detail-client.tsx"), "utf8");

// Owner-flagged audit finding: the header plan <select> PATCHed only
// Subscription.plan, which the entitlement resolver ignores for free users
// and which silently desyncs Stripe payers. The header must stay read-only;
// the only plan-change flow is the Billing tab's Grant Premium panel.
describe("user detail header plan control", () => {
  it("has no plan-mutating select or confirmPlanChange plumbing left", () => {
    expect(clientSource).not.toContain("confirmPlanChange");
    expect(clientSource).not.toContain("pendingPlan");
    expect(clientSource).not.toContain("Change user plan");
    // No bare `plan: <state>` PATCH payload from the header — the only
    // payloads that carry `plan` are the grant/revoke ones, which also set
    // the entitlement fields the resolver reads.
    expect(clientSource).not.toMatch(/JSON\.stringify\(\{\s*plan:/);
  });

  it("renders a read-only effective-plan badge derived from the entitlement resolver", () => {
    expect(clientSource).toContain("getEffectiveEntitlement(user.subscription || null)");
    expect(clientSource).toContain("getBillingPlanDefinition(eff.effectivePlan).displayName");
    expect(clientSource).toContain("effectiveStatusLabel(eff.effectiveStatus)");
    // Status pill uses tone tokens, premium = sage, no access = honey.
    expect(clientSource).toContain("bg-tone-sage-bg text-tone-sage-fg");
    expect(clientSource).toContain("bg-tone-honey-bg text-tone-honey-fg");
  });

  it("badge jumps to the Billing tab's Grant Premium panel (the working flow)", () => {
    expect(clientSource).toContain("function goToGrantPremiumPanel()");
    expect(clientSource).toContain('onClick={goToGrantPremiumPanel}');
    expect(clientSource).toContain('setActiveTab("billing")');
    expect(clientSource).toContain('id="grant-premium-panel"');
    expect(clientSource).toContain('document.getElementById("grant-premium-panel")?.scrollIntoView');
  });

  it("rehydrates all header-bound state through applyUserData on load AND after grant/revoke", () => {
    expect(clientSource).toContain("function applyUserData(");
    // One definition + at least two call sites (initial load, post-grant refetch).
    const calls = clientSource.match(/applyUserData\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
    // The helper syncs the grant panel's plan select too.
    const helper = clientSource.slice(
      clientSource.indexOf("function applyUserData("),
      clientSource.indexOf("useEffect(() => {", clientSource.indexOf("function applyUserData(")),
    );
    expect(helper).toContain("setUser(data.user)");
    expect(helper).toContain("setPremiumForm(");
    expect(helper).toContain("setGrantPlan(");
    expect(helper).toContain("setEditForm(");
  });

  it("degrades gracefully when the post-write refetch fails (no silent stale data)", () => {
    expect(clientSource).toContain("Change saved, but the page failed to refresh");
  });
});
