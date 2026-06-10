"use client";

import { useLocale, useTranslations } from "next-intl";
import { Check, Minus } from "lucide-react";
import { BILLING_PLAN_DEFINITIONS, planFeatures, type BillingPlan } from "@locateflow/shared";

/**
 * Honest "Compare plans" matrix rendered under the pricing cards.
 *
 * Every cell is DERIVED from the constants the app actually enforces — no
 * invented claims:
 *
 *   - packages/shared/src/billing.ts
 *       BILLING_PLAN_DEFINITIONS → prices, isPaid (the paid-tier gate), and
 *       the marketing feature lines (smart suggestions presence).
 *   - packages/shared/src/workspace-entitlements.ts
 *       FEATURES via planFeatures() → seatLimit, partnerHub, advancedExport,
 *       addressValidation, aiBriefing, homeDossier.
 *   - apps/web/src/lib/plan-limits.ts
 *       PLAN_LIMITS → address/service caps. That module is server-only (it
 *       imports prisma) and PLAN_LIMITS is not exported, so the caps are
 *       mirrored as literals below; plan-compare-table.test.tsx pins the
 *       mirrored values so drift fails CI instead of shipping a false cell.
 */

/** Column order mirrors BILLING_PLAN_ORDER (packages/shared/src/billing.ts). */
const COMPARE_PLANS: readonly BillingPlan[] = ["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"];

/**
 * Per-plan accent for the column header. Reuses the canonical .plan-free /
 * .plan-family / .plan-pro classes from globals.css (Free pink, Family teal,
 * Pro honey); Individual carries NO class — absent class = base Aurora cool,
 * the same convention AppShell uses for member tiers.
 */
const PLAN_HEADER: Record<BillingPlan, { nameKey: string; accentClass: string }> = {
  FREE_TRIAL: { nameKey: "compare.planFree", accentClass: "plan-free" },
  INDIVIDUAL: { nameKey: "compare.planIndividual", accentClass: "" },
  FAMILY: { nameKey: "compare.planFamily", accentClass: "plan-family" },
  PRO: { nameKey: "compare.planPro", accentClass: "plan-pro" },
};

// Source: PLAN_LIMITS[plan].maxAddresses — apps/web/src/lib/plan-limits.ts.
const MAX_ADDRESSES: Record<BillingPlan, number> = {
  FREE_TRIAL: 3,
  INDIVIDUAL: 10,
  FAMILY: 17,
  PRO: 25,
};

// Source: PLAN_LIMITS[plan].maxServices — apps/web/src/lib/plan-limits.ts.
// `null` mirrors the UNLIMITED sentinel on the Free tier.
const MAX_SERVICES: Record<BillingPlan, number | null> = {
  FREE_TRIAL: null,
  INDIVIDUAL: 100,
  FAMILY: 250,
  PRO: 1000,
};

// The exact marketing line shipped in BILLING_PLAN_DEFINITIONS[*].features
// (packages/shared/src/billing.ts). The cell derives from `features.includes`,
// so if the copy is ever removed from a tier the check honestly disappears.
const SMART_SUGGESTIONS_LINE = "Smart provider suggestions with FCC broadband & utility data";

export type CompareCell =
  | { kind: "included" }
  | { kind: "excluded" }
  | { kind: "value"; value: number }
  | { kind: "unlimited" };

export interface CompareRow {
  labelKey: string;
  cell: (plan: BillingPlan) => CompareCell;
}

export interface CompareGroup {
  labelKey: string;
  rows: CompareRow[];
}

const INCLUDED: CompareCell = { kind: "included" };
const EXCLUDED: CompareCell = { kind: "excluded" };
const onOff = (on: boolean): CompareCell => (on ? INCLUDED : EXCLUDED);

/** Exported for plan-compare-table.test.tsx, which pins every cell to ground truth. */
export const COMPARE_GROUPS: CompareGroup[] = [
  {
    labelKey: "groupEssentials",
    rows: [
      // Row source: PLAN_LIMITS[plan].maxAddresses (apps/web/src/lib/plan-limits.ts) — 3/10/17/25.
      { labelKey: "rowAddresses", cell: (plan) => ({ kind: "value", value: MAX_ADDRESSES[plan] }) },
      // Row source: PLAN_LIMITS[plan].maxServices (apps/web/src/lib/plan-limits.ts) — UNLIMITED/100/250/1000.
      {
        labelKey: "rowServices",
        cell: (plan) => {
          const max = MAX_SERVICES[plan];
          return max === null ? { kind: "unlimited" } : { kind: "value", value: max };
        },
      },
      // Row source: BILLING_PLAN_DEFINITIONS[*].features (packages/shared/src/billing.ts) — provider
      // tracking + bill/renewal reminders ship on every tier ("Bill & renewal reminders" on
      // Free/Individual, "Consolidated household reminders" on Family, "Everything in Family" on Pro).
      { labelKey: "rowProvidersReminders", cell: () => INCLUDED },
      // Row source: BILLING_PLAN_DEFINITIONS[plan].features contains SMART_SUGGESTIONS_LINE
      // (packages/shared/src/billing.ts) — on every tier, including Free.
      {
        labelKey: "rowSmartSuggestions",
        cell: (plan) => onOff(BILLING_PLAN_DEFINITIONS[plan].features.includes(SMART_SUGGESTIONS_LINE)),
      },
    ],
  },
  {
    labelKey: "groupMoving",
    rows: [
      // Row source: canCreateMovingPlan / canGenerateMoveTasks (apps/web/src/lib/plan-limits.ts)
      // gate the move plan on paid tiers only — mirrored via BILLING_PLAN_DEFINITIONS[plan].isPaid.
      { labelKey: "rowMovePlan", cell: (plan) => onOff(BILLING_PLAN_DEFINITIONS[plan].isPaid) },
      // Row source: FEATURES[plan].aiBriefing (packages/shared/src/workspace-entitlements.ts) — paid plans.
      { labelKey: "rowAiBriefing", cell: (plan) => onOff(planFeatures(plan).aiBriefing) },
      // Row source: FEATURES[plan].homeDossier (packages/shared/src/workspace-entitlements.ts) — paid plans.
      { labelKey: "rowHomeDossier", cell: (plan) => onOff(planFeatures(plan).homeDossier) },
    ],
  },
  {
    labelKey: "groupHousehold",
    rows: [
      // Row source: FEATURES[plan].seatLimit (packages/shared/src/workspace-entitlements.ts) — 1/1/6/10.
      { labelKey: "rowMembers", cell: (plan) => ({ kind: "value", value: planFeatures(plan).seatLimit }) },
      // Row source: FEATURES[plan].seatLimit > 1 (packages/shared/src/workspace-entitlements.ts) —
      // a shared household workspace is exactly "more than the owner seat", i.e. Family and up.
      { labelKey: "rowSharedWorkspace", cell: (plan) => onOff(planFeatures(plan).seatLimit > 1) },
      // Row source: child accounts ride the multi-seat workspace — BILLING_PLAN_DEFINITIONS Family/Pro
      // feature line "Child accounts (no financial visibility)" (packages/shared/src/billing.ts),
      // gated in practice by FEATURES[plan].seatLimit > 1.
      { labelKey: "rowChildAccounts", cell: (plan) => onOff(planFeatures(plan).seatLimit > 1) },
    ],
  },
  {
    labelKey: "groupPower",
    rows: [
      // Row source: "Export anytime (CSV, PDF)" ships on every paid tier — BILLING_PLAN_DEFINITIONS
      // features (packages/shared/src/billing.ts; Pro via "Everything in Family" + its tax-export
      // line) — keyed off BILLING_PLAN_DEFINITIONS[plan].isPaid.
      { labelKey: "rowExport", cell: (plan) => onOff(BILLING_PLAN_DEFINITIONS[plan].isPaid) },
      // Row source: FEATURES[plan].advancedExport (packages/shared/src/workspace-entitlements.ts) — Pro only.
      { labelKey: "rowTaxExport", cell: (plan) => onOff(planFeatures(plan).advancedExport) },
      // Row source: FEATURES[plan].partnerHub (packages/shared/src/workspace-entitlements.ts) — Pro only.
      { labelKey: "rowPartnerHub", cell: (plan) => onOff(planFeatures(plan).partnerHub) },
      // Row source: FEATURES[plan].addressValidation (packages/shared/src/workspace-entitlements.ts) — paid plans.
      { labelKey: "rowAddressValidation", cell: (plan) => onOff(planFeatures(plan).addressValidation) },
    ],
  },
];

function CellContent({
  cell,
  locale,
  includedLabel,
  notIncludedLabel,
  unlimitedLabel,
}: {
  cell: CompareCell;
  locale: string;
  includedLabel: string;
  notIncludedLabel: string;
  unlimitedLabel: string;
}) {
  if (cell.kind === "included") {
    return (
      <>
        <Check className="mx-auto h-4 w-4 text-tone-emerald-fg" aria-hidden />
        <span className="sr-only">{includedLabel}</span>
      </>
    );
  }
  if (cell.kind === "excluded") {
    return (
      <>
        <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-hidden />
        <span className="sr-only">{notIncludedLabel}</span>
      </>
    );
  }
  if (cell.kind === "unlimited") {
    return <span className="font-medium text-foreground">{unlimitedLabel}</span>;
  }
  return <span className="font-medium tabular-nums text-foreground">{cell.value.toLocaleString(locale)}</span>;
}

export function PlanCompareTable() {
  const t = useTranslations("pricing");
  const locale = useLocale();

  return (
    <div className="mx-auto mt-14 max-w-6xl">
      <div className="mx-auto mb-6 max-w-2xl text-center">
        <h3 className="text-2xl font-bold">{t("compare.title")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t("compare.subtitle")}</p>
      </div>

      {/* Mobile: the table keeps its natural min width and scrolls horizontally. */}
      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full min-w-[640px] border-collapse text-sm [&>tbody:last-child>tr:last-child]:border-b-0">
          <caption className="sr-only">{t("compare.title")}</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="w-[32%] px-4 py-4 text-left">
                <span className="sr-only">{t("compare.featureColumn")}</span>
              </th>
              {COMPARE_PLANS.map((plan) => {
                const def = BILLING_PLAN_DEFINITIONS[plan];
                const header = PLAN_HEADER[plan];
                return (
                  <th
                    key={plan}
                    scope="col"
                    /* .plan-* scopes --primary to the plan accent, so text-primary
                       and bg-primary/5 below pick up pink/teal/honey per column. */
                    className={`${header.accentClass} bg-primary/5 px-4 py-4 text-center align-top`}
                  >
                    <span className="block text-sm font-semibold text-primary">{t(header.nameKey)}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {/* Price source: BILLING_PLAN_DEFINITIONS[plan] — $0 for the free tier,
                          priceLabel + localized period for paid tiers. */}
                      {def.isPaid ? `${def.priceLabel}${t("perMonth")}` : "$0"}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          {COMPARE_GROUPS.map((group) => (
            <tbody key={group.labelKey}>
              <tr className="border-b bg-muted/40">
                <th
                  scope="colgroup"
                  colSpan={COMPARE_PLANS.length + 1}
                  className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {t(`compare.${group.labelKey}`)}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.labelKey} className="border-b">
                  <th scope="row" className="px-4 py-3 text-left text-sm font-medium text-foreground">
                    {t(`compare.${row.labelKey}`)}
                  </th>
                  {COMPARE_PLANS.map((plan) => (
                    <td key={plan} className="px-4 py-3 text-center">
                      <CellContent
                        cell={row.cell(plan)}
                        locale={locale}
                        includedLabel={t("compare.included")}
                        notIncludedLabel={t("compare.notIncluded")}
                        unlimitedLabel={t("compare.unlimited")}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <p className="mx-auto mt-3 max-w-3xl text-center text-[11px] leading-relaxed text-muted-foreground">
        {t("compare.footnote")}
      </p>
    </div>
  );
}
