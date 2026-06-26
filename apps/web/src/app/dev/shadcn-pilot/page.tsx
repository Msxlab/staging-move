"use client";

import { MonthlyBudgetCard } from "@/components/ui/credit-usage-card";

const SAMPLE_LINE_ITEMS = [
  { date: "Jun 24", service: "Allied Van Lines", category: "Movers", amount: "$1,240.00" },
  { date: "Jun 22", service: "Comcast Xfinity", category: "Internet", amount: "$89.99" },
  { date: "Jun 19", service: "City Water & Power", category: "Utilities", amount: "$142.50" },
  { date: "Jun 15", service: "Lemonade Renters", category: "Insurance", amount: "$28.00" },
  { date: "Jun 11", service: "U-Haul Boxes", category: "Supplies", amount: "$64.30" },
];

/**
 * Dev-only, no-auth preview for the shadcn install pilot.
 * Renders the watermelon `credit-usage-card`, now re-themed onto our sapphire
 * (no-gold) tokens AND repurposed into the LocateFlow Monthly Budget card.
 * The `.light` wrapper forces the light theme so the lead can screenshot the
 * sapphire treatment on a light canvas.
 * URL: /dev/shadcn-pilot
 */
export default function ShadcnPilotPage() {
  return (
    <div className="light min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            shadcn pilot — monthly budget card (sapphire)
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Third-party component from the watermelon registry, installed via the
            shadcn CLI, re-themed onto our sapphire tokens (no gold) and
            repurposed into the dashboard Monthly Budget card. The accent,
            surfaces, borders, and success states all resolve through our
            CSS-var theme.
          </p>
        </header>

        <MonthlyBudgetCard
          spentPercent={56.4}
          monthlyBudgetLabel="$2,400 BUDGET"
          spentLabel="$1,354"
          remainingLabel="$1,046"
          lineItems={SAMPLE_LINE_ITEMS}
        />
      </div>
    </div>
  );
}
