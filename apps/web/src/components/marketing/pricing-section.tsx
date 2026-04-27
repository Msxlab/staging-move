"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Lock, Shield, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BILLING_PLAN_DEFINITIONS } from "@locateflow/shared";

type Cycle = "monthly" | "yearly";
type TierId = "INDIVIDUAL" | "FAMILY" | "PRO";

interface PricingSectionProps {
  ctaHref: string;
  ctaLabelLoggedIn: boolean;
}

// Yearly savings label is computed from INDIVIDUAL — the only live plan.
const YEARLY_SAVINGS_PCT = Math.round(
  (1 -
    BILLING_PLAN_DEFINITIONS.INDIVIDUAL.yearlyPriceUsd! /
      (BILLING_PLAN_DEFINITIONS.INDIVIDUAL.monthlyPriceUsd * 12)) *
    100,
);

interface PreviewTier {
  id: TierId;
  monthly: string;
  yearly: string;
  yearlyTotal: string;
  available: boolean;
  flagship: boolean;
  featureKeys: string[];
}

const TIERS: PreviewTier[] = [
  {
    id: "INDIVIDUAL",
    monthly: BILLING_PLAN_DEFINITIONS.INDIVIDUAL.priceLabel,
    yearly: BILLING_PLAN_DEFINITIONS.INDIVIDUAL.yearlyPriceLabel?.split("/")[0] ?? "$79",
    yearlyTotal: BILLING_PLAN_DEFINITIONS.INDIVIDUAL.yearlyPriceLabel ?? "$79/year",
    available: true,
    flagship: false,
    featureKeys: [
      "individualFeature1",
      "individualFeature2",
      "individualFeature3",
      "individualFeature4",
      "individualFeature5",
    ],
  },
  {
    id: "FAMILY",
    monthly: "$14.99",
    yearly: "$149",
    yearlyTotal: "$149/year",
    available: false,
    flagship: false,
    featureKeys: [
      "familyFeature1",
      "familyFeature2",
      "familyFeature3",
      "familyFeature4",
      "familyFeature5",
    ],
  },
  {
    id: "PRO",
    monthly: "$24.99",
    yearly: "$249",
    yearlyTotal: "$249/year",
    available: false,
    flagship: true,
    featureKeys: [
      "proFeature1",
      "proFeature2",
      "proFeature3",
      "proFeature4",
      "proFeature5",
      "proFeature6",
      "proFeature7",
    ],
  },
];

type CellKind = "no" | "value";
interface ComparisonCell {
  kind: CellKind;
  /** Translation key under `pricing.*`, or a literal string for prices/numbers. */
  value?: string;
  /** When true, the cell value is a translation key; otherwise a literal. */
  i18n?: boolean;
}

interface ComparisonRow {
  labelKey: string;
  individual: ComparisonCell;
  family: ComparisonCell;
  pro: ComparisonCell;
}

const ROWS: ComparisonRow[] = [
  {
    labelKey: "compareRow_userType",
    individual: { kind: "value", value: "compare_individual_user", i18n: true },
    family: { kind: "value", value: "compare_family_user", i18n: true },
    pro: { kind: "value", value: "compare_pro_user", i18n: true },
  },
  {
    labelKey: "compareRow_addressLimit",
    individual: { kind: "value", value: "10" },
    family: { kind: "value", value: "compare_family_addresses", i18n: true },
    pro: { kind: "value", value: "compare_unlimited", i18n: true },
  },
  {
    labelKey: "compareRow_serviceLimit",
    individual: { kind: "value", value: "100" },
    family: { kind: "value", value: "compare_family_services", i18n: true },
    pro: { kind: "value", value: "compare_unlimited", i18n: true },
  },
  {
    labelKey: "compareRow_householdMembers",
    individual: { kind: "no" },
    family: { kind: "value", value: "5" },
    pro: { kind: "value", value: "compare_pro_household", i18n: true },
  },
  {
    labelKey: "compareRow_sharedWorkspace",
    individual: { kind: "no" },
    family: { kind: "value", value: "compare_yes_shared", i18n: true },
    pro: { kind: "value", value: "compare_yes_shared", i18n: true },
  },
  {
    labelKey: "compareRow_kyc",
    individual: { kind: "no" },
    family: { kind: "value", value: "compare_optional", i18n: true },
    pro: { kind: "value", value: "compare_required", i18n: true },
  },
  {
    labelKey: "compareRow_plaid",
    individual: { kind: "no" },
    family: { kind: "value", value: "compare_later", i18n: true },
    pro: { kind: "value", value: "compare_yes", i18n: true },
  },
  {
    labelKey: "compareRow_utility",
    individual: { kind: "no" },
    family: { kind: "value", value: "compare_later", i18n: true },
    pro: { kind: "value", value: "compare_yes", i18n: true },
  },
  {
    labelKey: "compareRow_verifiedBadge",
    individual: { kind: "no" },
    family: { kind: "no" },
    pro: { kind: "value", value: "compare_yes", i18n: true },
  },
  {
    labelKey: "compareRow_actionCenter",
    individual: { kind: "value", value: "compare_basic", i18n: true },
    family: { kind: "value", value: "compare_shared", i18n: true },
    pro: { kind: "value", value: "compare_advanced", i18n: true },
  },
  {
    labelKey: "compareRow_emailTemplates",
    individual: { kind: "value", value: "compare_basic", i18n: true },
    family: { kind: "value", value: "compare_shared", i18n: true },
    pro: { kind: "value", value: "compare_advanced", i18n: true },
  },
  {
    labelKey: "compareRow_auditPdf",
    individual: { kind: "no" },
    family: { kind: "no" },
    pro: { kind: "value", value: "compare_yes", i18n: true },
  },
  {
    labelKey: "compareRow_prioritySupport",
    individual: { kind: "no" },
    family: { kind: "no" },
    pro: { kind: "value", value: "compare_yes", i18n: true },
  },
  {
    labelKey: "compareRow_partnerApi",
    individual: { kind: "no" },
    family: { kind: "no" },
    pro: { kind: "value", value: "compare_pro_partner", i18n: true },
  },
  {
    labelKey: "compareRow_autoConnector",
    individual: { kind: "no" },
    family: { kind: "no" },
    pro: { kind: "value", value: "compare_pro_connector", i18n: true },
  },
];

export function PricingSection({ ctaHref, ctaLabelLoggedIn }: PricingSectionProps) {
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const tPricing = useTranslations("pricing");
  const tBilling = useTranslations("billing");
  const tLanding = useTranslations("landing");
  const tErrors = useTranslations("errors");

  return (
    <section id="pricing" className="container py-20">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-4">{tPricing("title")}</h2>
        <p className="text-muted-foreground text-lg">
          {tPricing("subtitle")} {tLanding("noCreditCard")}.
        </p>
      </div>

      {/* Monthly/Yearly toggle */}
      <div className="flex justify-center mb-12">
        <div
          role="tablist"
          aria-label="Billing cycle"
          className="inline-flex items-center rounded-full border bg-card p-1 shadow-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={cycle === "monthly"}
            onClick={() => setCycle("monthly")}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              cycle === "monthly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tBilling("cycle_monthly")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={cycle === "yearly"}
            onClick={() => setCycle("yearly")}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              cycle === "yearly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tBilling("cycle_yearly")}
            <span className="ml-2 inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              -{YEARLY_SAVINGS_PCT}%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
        {TIERS.map((tier) => {
          const nameKey = `${tier.id.toLowerCase()}Name` as const;
          const descKey = `${tier.id.toLowerCase()}Description` as const;
          const eyebrowKey = tier.available
            ? "availableNow"
            : tier.flagship
              ? "flagshipBadge"
              : "comingSoon";

          const price = cycle === "yearly" ? tier.yearly : tier.monthly;
          const periodLabel =
            cycle === "yearly"
              ? tPricing("perYear")
              : tPricing("perMonth");

          return (
            <div
              key={tier.id}
              className={
                tier.flagship
                  ? "relative rounded-2xl border border-orange-500/40 bg-gradient-to-b from-orange-500/[0.06] to-transparent p-7 space-y-6 shadow-[0_0_40px_-12px_rgba(249,115,22,0.45)] ring-1 ring-orange-500/20"
                  : tier.available
                    ? "relative rounded-2xl border-2 border-primary p-7 space-y-6 bg-card shadow-lg"
                    : "relative rounded-2xl border border-border/70 p-7 space-y-6 bg-card/60 backdrop-blur-sm"
              }
              aria-disabled={!tier.available}
            >
              <div
                className={
                  tier.flagship
                    ? "absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold tracking-wide uppercase px-3 py-1 shadow-lg"
                    : tier.available
                      ? "absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[11px] font-bold tracking-wide uppercase px-3 py-1 rounded-full"
                      : "absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-background text-orange-500 dark:text-orange-300 text-[11px] font-semibold tracking-wide uppercase px-3 py-1"
                }
              >
                {tier.flagship && <Sparkles className="h-3 w-3" aria-hidden="true" />}
                {!tier.available && !tier.flagship && (
                  <Lock className="h-3 w-3" aria-hidden="true" />
                )}
                {tPricing(eyebrowKey)}
              </div>

              <div>
                <h3 className="text-xl font-semibold">{tPricing(nameKey)}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {tPricing(descKey)}
                </p>
              </div>

              <div>
                <div
                  className={`flex items-baseline gap-1 ${
                    !tier.available ? "opacity-90" : ""
                  }`}
                >
                  <span
                    className={`text-5xl font-bold tracking-tight ${
                      tier.flagship
                        ? "bg-gradient-to-br from-orange-500 to-amber-500 bg-clip-text text-transparent"
                        : ""
                    }`}
                  >
                    {price}
                  </span>
                  <span className="text-muted-foreground">{periodLabel}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {cycle === "yearly"
                    ? `${tPricing("billedAnnually")} · ${tier.yearlyTotal}`
                    : tPricing("billedMonthly")}
                </p>
              </div>

              <ul className="space-y-2.5 text-sm">
                {tier.featureKeys.map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <Check
                      className={`h-4 w-4 mt-0.5 shrink-0 ${
                        tier.flagship
                          ? "text-orange-500 dark:text-orange-300"
                          : tier.available
                            ? "text-success"
                            : "text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={tier.available ? "" : "text-muted-foreground"}
                    >
                      {tPricing(key)}
                    </span>
                  </li>
                ))}
              </ul>

              {tier.available ? (
                <>
                  <Link
                    href={`${ctaHref}${ctaHref.includes("?") ? "&" : "?"}cycle=${cycle}`}
                    className="block"
                  >
                    <Button className="w-full">
                      {ctaLabelLoggedIn
                        ? tErrors("goToDashboard")
                        : tPricing("cta_trial")}
                    </Button>
                  </Link>
                  <p className="text-[11px] text-center text-muted-foreground">
                    {tLanding("noCreditCard")} · {tLanding("cancelAnytime")}
                  </p>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full cursor-not-allowed border-dashed"
                    disabled
                    aria-label={`${tPricing(nameKey)} — ${tPricing("comingSoon")}`}
                  >
                    <Lock className="h-3.5 w-3.5 mr-2" aria-hidden="true" />
                    {tPricing("comingSoonCta")}
                  </Button>
                  <p className="text-[11px] text-center text-muted-foreground">
                    {tier.flagship
                      ? tPricing("proHint")
                      : tPricing("familyHint")}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="max-w-3xl mx-auto mt-6 mb-2">
        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center justify-center gap-2 font-medium text-foreground">
            <Shield className="h-3.5 w-3.5" />
            {tPricing("scopeNoteTitle")}
          </div>
          {tPricing("scopeNoteBody")}
        </div>
      </div>

      {/* Comparison table */}
      <div className="mt-16 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold">{tPricing("compareTitle")}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {tPricing("compareSubtitle")}
          </p>
        </div>

        <div className="rounded-2xl border bg-card/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30">
                  <th
                    scope="col"
                    className="text-left font-semibold text-muted-foreground px-5 py-4 uppercase text-[11px] tracking-wider"
                  >
                    {tPricing("compareCol_feature")}
                  </th>
                  {TIERS.map((tier) => (
                    <th
                      key={tier.id}
                      scope="col"
                      className={`text-right px-5 py-4 ${
                        tier.flagship ? "bg-orange-500/[0.04]" : ""
                      }`}
                    >
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-semibold text-foreground">
                          {tPricing(`${tier.id.toLowerCase()}Name` as const)}
                        </span>
                        {tier.available ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            {tPricing("availableNow")}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${
                              tier.flagship
                                ? "text-orange-500 dark:text-orange-300"
                                : "text-muted-foreground"
                            }`}
                          >
                            {tier.flagship ? (
                              <Sparkles className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <Lock className="h-3 w-3" aria-hidden="true" />
                            )}
                            {tPricing("comingSoon")}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border/70">
                  <th
                    scope="row"
                    className="text-left font-medium text-muted-foreground px-5 py-3"
                  >
                    {tPricing("compareRow_monthly")}
                  </th>
                  {TIERS.map((tier) => (
                    <td
                      key={tier.id}
                      className={`text-right px-5 py-3 font-semibold ${
                        tier.flagship
                          ? "bg-orange-500/[0.04] text-orange-500 dark:text-orange-300"
                          : "text-foreground"
                      }`}
                    >
                      {tier.monthly}
                      <span className="text-muted-foreground font-normal">
                        {tPricing("perMonthShort")}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/70">
                  <th
                    scope="row"
                    className="text-left font-medium text-muted-foreground px-5 py-3"
                  >
                    {tPricing("compareRow_yearly")}
                  </th>
                  {TIERS.map((tier) => (
                    <td
                      key={tier.id}
                      className={`text-right px-5 py-3 ${
                        tier.flagship ? "bg-orange-500/[0.04]" : ""
                      }`}
                    >
                      {tier.yearly}
                      <span className="text-muted-foreground">
                        {tPricing("perYearShort")}
                      </span>
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, idx) => (
                  <tr
                    key={row.labelKey}
                    className={
                      idx === ROWS.length - 1
                        ? ""
                        : "border-b border-border/40"
                    }
                  >
                    <th
                      scope="row"
                      className="text-left font-medium px-5 py-3 text-foreground/80"
                    >
                      {tPricing(row.labelKey)}
                    </th>
                    {(["individual", "family", "pro"] as const).map((col) => {
                      const cell = row[col];
                      const tier = TIERS.find(
                        (t) => t.id.toLowerCase() === col,
                      )!;
                      return (
                        <td
                          key={col}
                          className={`text-right px-5 py-3 ${
                            tier.flagship ? "bg-orange-500/[0.04]" : ""
                          }`}
                        >
                          {cell.kind === "no" ? (
                            <span
                              className="inline-flex items-center justify-end gap-1 text-muted-foreground/60"
                              aria-label={tPricing("compare_none")}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                          ) : (
                            <span
                              className={
                                tier.flagship
                                  ? "text-orange-500 dark:text-orange-300 font-medium"
                                  : "text-foreground"
                              }
                            >
                              {cell.i18n
                                ? tPricing(cell.value as string)
                                : cell.value}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          {tPricing("compareDisclaimer")}
        </p>
      </div>
    </section>
  );
}
