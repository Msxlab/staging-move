"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Users } from "lucide-react";
import { BILLING_PLAN_DEFINITIONS } from "@/lib/shared-billing";

type Interval = "MONTH" | "YEAR";
const TIERS = ["INDIVIDUAL", "FAMILY", "PRO"] as const;
type Tier = (typeof TIERS)[number];
const RANK: Record<Tier, number> = { INDIVIDUAL: 1, FAMILY: 2, PRO: 3 };

function priceLabel(tier: Tier, interval: Interval): string {
  const def = BILLING_PLAN_DEFINITIONS[tier];
  if (interval === "YEAR") return def.yearlyPriceLabel ?? `$${def.yearlyPriceUsd ?? ""}/year`;
  return `${def.priceLabel}${def.periodLabel}`;
}

/**
 * In-settings plan switcher. Lets a member move between Individual / Family /
 * Pro (and billing interval). An active Stripe subscriber goes through
 * /api/subscription/change-plan (upgrade immediate, downgrade deferred to
 * period end — no data loss); anyone else starts checkout for the target plan.
 * Self-contained: fetches its own /api/profile snapshot. Family/Pro buttons
 * surface a graceful "not available yet" when the price IDs aren't configured.
 */
export function PlanChangeSection() {
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<string>("FREE_TRIAL");
  const [currentInterval, setCurrentInterval] = useState<Interval>("MONTH");
  const [hasStripeSub, setHasStripeSub] = useState(false);
  const [interval, setInterval] = useState<Interval>("MONTH");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = await res.json();
        const sub = data?.subscription || null;
        if (!active) return;
        const plan = String(sub?.plan || "FREE_TRIAL");
        const ivl: Interval = sub?.billingInterval === "YEAR" ? "YEAR" : "MONTH";
        setCurrentPlan(plan);
        setCurrentInterval(ivl);
        setInterval(ivl);
        setHasStripeSub(
          sub?.provider === "STRIPE" &&
            Boolean(sub?.stripeSubscriptionId) &&
            (sub?.status === "ACTIVE" || sub?.status === "CANCEL_AT_PERIOD_END"),
        );
      } catch {
        // Leave the section in its safe default (free/no-sub) on failure.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function changeTo(tier: Tier) {
    if (!accepted) {
      setMsg({ kind: "err", text: "Please accept the subscription terms first." });
      return;
    }
    setBusy(tier);
    setMsg(null);
    try {
      if (hasStripeSub) {
        const res = await fetch("/api/subscription/change-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetPlan: tier, targetInterval: interval, acceptedSubscriptionTerms: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMsg({ kind: "err", text: data?.error || "Couldn't change your plan. Please try again." });
          return;
        }
        setMsg({
          kind: "ok",
          text:
            data?.applied === "scheduled"
              ? `Scheduled — you keep ${currentPlan} until the end of your current period, then switch to ${tier}. Nothing changes today and no data is lost.`
              : `You're now on ${tier}.`,
        });
        setTimeout(() => window.location.reload(), 1800);
      } else {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: tier, billingInterval: interval, acceptedSubscriptionTerms: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.url) {
          window.location.assign(data.url);
          return;
        }
        setMsg({
          kind: "err",
          text: data?.error || "Checkout for this plan isn't available yet.",
        });
      }
    } catch {
      setMsg({ kind: "err", text: "Something went wrong. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-border bg-foreground/5 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-tone-sky-br bg-tone-sky-bg p-2.5">
          <Users className="h-5 w-5 text-tone-sky-fg" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">Change your plan</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upgrades apply right away. Downgrades take effect at the end of your current period — you keep
            everything you&apos;ve paid for until then, and nothing is ever deleted.
          </p>

          {/* Billing interval toggle */}
          <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-border bg-background/40 p-1">
            {(["MONTH", "YEAR"] as Interval[]).map((ivl) => (
              <button
                key={ivl}
                type="button"
                onClick={() => setInterval(ivl)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  interval === ivl ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ivl === "YEAR" ? "Annual" : "Monthly"}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {TIERS.map((tier) => {
              const isCurrent = tier === currentPlan && interval === currentInterval;
              const direction =
                RANK[tier] > (RANK[currentPlan as Tier] ?? 0) ? "Upgrade" : RANK[tier] < (RANK[currentPlan as Tier] ?? 0) ? "Downgrade" : "Switch";
              return (
                <div key={tier} className="rounded-xl border border-border bg-background/40 p-4">
                  <p className="text-sm font-semibold text-foreground">{BILLING_PLAN_DEFINITIONS[tier].displayName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{priceLabel(tier, interval)}</p>
                  {tier === "PRO" ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">Automatic connections require annual Pro.</p>
                  ) : null}
                  <div className="mt-3">
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-tone-emerald-fg">
                        <Check className="h-3.5 w-3.5" /> Current plan
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void changeTo(tier)}
                        disabled={Boolean(busy)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                      >
                        {busy === tier ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {direction} to {BILLING_PLAN_DEFINITIONS[tier].displayName}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <label className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            <input type="checkbox" className="mt-0.5" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>
              I understand the price, renewal, and that downgrades apply at period end. Subscription terms are shown
              before any charge.
            </span>
          </label>

          {msg ? (
            <p className={`mt-3 text-xs ${msg.kind === "ok" ? "text-tone-emerald-fg" : "text-destructive"}`}>{msg.text}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
