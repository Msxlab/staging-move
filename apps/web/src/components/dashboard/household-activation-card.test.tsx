import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// The card module imports lucide-react, next/link, and next-intl at module
// scope; stub them so importing the pure visibility helpers never depends on
// renderer internals (same pattern as move-briefing-card.test.tsx).
vi.mock("lucide-react", () => {
  const icon = (name: string) => {
    const Stub = (props: { className?: string }) => <svg data-lucide={name} className={props.className} />;
    Stub.displayName = name;
    return Stub;
  };
  return {
    ArrowRight: icon("arrow-right"),
    Check: icon("check"),
    Loader2: icon("loader-2"),
    Plus: icon("plus"),
    Users: icon("users"),
    X: icon("x"),
  };
});
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href?: string; children?: unknown; className?: string }) => (
    <a href={href} className={className}>
      {children as never}
    </a>
  ),
}));
vi.mock("next-intl", async () => {
  const en = (await import("@/i18n/messages/en.json")).default as unknown as Record<
    string,
    Record<string, string>
  >;
  const resolve = (key: string): string => {
    const raw = en.dashboard?.[key];
    if (typeof raw !== "string") throw new Error(`Missing dashboard.${key} in en.json`);
    return raw;
  };
  const useTranslations = () => {
    const t = (key: string, vars?: Record<string, unknown>) =>
      resolve(key).replace(/\{(\w+)\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
    return t;
  };
  return { useTranslations, useLocale: () => "en-US" };
});

import {
  eligibleActivationWorkspace,
  householdSetupInitialFocusTarget,
  isHouseholdPlan,
  shouldShowHouseholdActivation,
  type ActivationWorkspace,
} from "./household-activation-card";

function ws(overrides: Partial<ActivationWorkspace> = {}): ActivationWorkspace {
  return {
    id: "ws1",
    name: "My Workspace",
    role: "OWNER",
    status: "ACTIVE",
    seatLimit: 6,
    memberCount: 1,
    deletedAt: null,
    ...overrides,
  };
}

describe("isHouseholdPlan", () => {
  it("is true only for Family and Pro (case-insensitive)", () => {
    expect(isHouseholdPlan("FAMILY")).toBe(true);
    expect(isHouseholdPlan("PRO")).toBe(true);
    expect(isHouseholdPlan("pro")).toBe(true);
    expect(isHouseholdPlan("INDIVIDUAL")).toBe(false);
    expect(isHouseholdPlan("FREE_TRIAL")).toBe(false);
    expect(isHouseholdPlan("")).toBe(false);
    expect(isHouseholdPlan(null)).toBe(false);
    expect(isHouseholdPlan(undefined)).toBe(false);
  });
});

describe("eligibleActivationWorkspace", () => {
  it("returns the owned, active, member-empty, multi-seat workspace", () => {
    const target = ws();
    expect(eligibleActivationWorkspace("FAMILY", [target])).toBe(target);
  });

  it("returns null for non-household plans even with a matching workspace", () => {
    expect(eligibleActivationWorkspace("INDIVIDUAL", [ws()])).toBeNull();
    expect(eligibleActivationWorkspace(null, [ws()])).toBeNull();
  });

  it("skips workspaces the user does not own", () => {
    expect(eligibleActivationWorkspace("FAMILY", [ws({ role: "MEMBER" })])).toBeNull();
    expect(eligibleActivationWorkspace("FAMILY", [ws({ role: "ADMIN" })])).toBeNull();
  });

  it("skips workspaces that already have other members", () => {
    expect(eligibleActivationWorkspace("FAMILY", [ws({ memberCount: 2 })])).toBeNull();
  });

  it("skips deleted, suspended, and single-seat (personal-solo) workspaces", () => {
    expect(eligibleActivationWorkspace("FAMILY", [ws({ deletedAt: "2026-01-01T00:00:00Z" })])).toBeNull();
    expect(eligibleActivationWorkspace("FAMILY", [ws({ status: "SUSPENDED" })])).toBeNull();
    expect(eligibleActivationWorkspace("FAMILY", [ws({ seatLimit: 1 })])).toBeNull();
  });

  it("finds the eligible workspace among other memberships", () => {
    const target = ws({ id: "ws2" });
    const list = [ws({ id: "shared", role: "MEMBER", memberCount: 3 }), target];
    expect(eligibleActivationWorkspace("PRO", list)).toBe(target);
  });
});

describe("shouldShowHouseholdActivation", () => {
  const base = {
    plan: "FAMILY",
    workspaces: [ws()],
    pendingInvitationCount: 0,
    dismissed: false,
  };

  it("shows for a Family/Pro owner with an empty household and no pending invites", () => {
    expect(shouldShowHouseholdActivation(base)).toBe(true);
    expect(shouldShowHouseholdActivation({ ...base, plan: "PRO", workspaces: [ws({ seatLimit: 10 })] })).toBe(true);
  });

  it("hides once dismissed", () => {
    expect(shouldShowHouseholdActivation({ ...base, dismissed: true })).toBe(false);
  });

  it("hides for non-household plans", () => {
    expect(shouldShowHouseholdActivation({ ...base, plan: "INDIVIDUAL" })).toBe(false);
    expect(shouldShowHouseholdActivation({ ...base, plan: "FREE_TRIAL" })).toBe(false);
  });

  it("hides when invitations are already pending", () => {
    expect(shouldShowHouseholdActivation({ ...base, pendingInvitationCount: 1 })).toBe(false);
  });

  it("fails closed when the pending count is unknown", () => {
    expect(shouldShowHouseholdActivation({ ...base, pendingInvitationCount: null })).toBe(false);
  });

  it("hides when the household already has members", () => {
    expect(shouldShowHouseholdActivation({ ...base, workspaces: [ws({ memberCount: 2 })] })).toBe(false);
  });

  it("hides for a member of someone else's household", () => {
    expect(
      shouldShowHouseholdActivation({ ...base, workspaces: [ws({ role: "MEMBER", memberCount: 3 })] }),
    ).toBe(false);
  });

  it("still shows when the user has no workspace yet (provisioning is best-effort)", () => {
    expect(shouldShowHouseholdActivation({ ...base, workspaces: [] })).toBe(true);
    // ...but not on a non-household plan.
    expect(shouldShowHouseholdActivation({ ...base, plan: "INDIVIDUAL", workspaces: [] })).toBe(false);
  });
});

describe("householdSetupInitialFocusTarget", () => {
  it("starts on email so the invite action never types into the household name field", () => {
    expect(householdSetupInitialFocusTarget()).toBe("email");
  });
});

describe("household catalog parity (en/es)", () => {
  const cwd = process.cwd();
  const webRoot = cwd.endsWith(`${path.sep}apps${path.sep}web`) ? cwd : path.join(cwd, "apps", "web");
  const read = (file: string) =>
    JSON.parse(readFileSync(path.join(webRoot, "src", "i18n", "messages", file), "utf8")) as Record<
      string,
      Record<string, string>
    >;

  it("keeps the en/es household_* keys in parity and covers every key the card uses", () => {
    const en = read("en.json");
    const es = read("es.json");
    const householdKeys = (cat: Record<string, Record<string, string>>) =>
      Object.keys(cat.dashboard).filter((k) => k.startsWith("household_"));
    expect(householdKeys(en).sort()).toEqual(householdKeys(es).sort());

    // Every dashboard.* key referenced by the card source must exist in BOTH
    // catalogs — a renamed/removed key fails here, not at runtime.
    const source = readFileSync(
      path.join(webRoot, "src", "components", "dashboard", "household-activation-card.tsx"),
      "utf8",
    );
    const used = [...source.matchAll(/td\("(household_[A-Za-z_]+)"/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const key of used) {
      expect(en.dashboard[key], `en.json dashboard.${key}`).toBeTypeOf("string");
      expect(es.dashboard[key], `es.json dashboard.${key}`).toBeTypeOf("string");
    }
  });

  it("ships the checkout-handoff reveal CTA in both catalogs", () => {
    const en = read("en.json");
    const es = read("es.json");
    expect(en.premiumReveal.primaryHousehold).toBe("Next: invite your household");
    expect(es.premiumReveal.primaryHousehold).toBeTypeOf("string");
  });
});
