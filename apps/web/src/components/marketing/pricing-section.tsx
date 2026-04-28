"use client";

import Link from "next/link";
import { Check, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BILLING_PLAN_DEFINITIONS } from "@locateflow/shared";

interface PricingSectionProps {
  ctaHref: string;
  ctaLabelLoggedIn: boolean;
  showComparison?: boolean;
}

export function PricingSection({
  ctaHref,
  ctaLabelLoggedIn,
}: PricingSectionProps) {
  const plan = BILLING_PLAN_DEFINITIONS.INDIVIDUAL;
  const yearlyPrice = plan.yearlyPriceLabel || "$79/year";

  return (
    <section id="pricing" className="container py-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Individual Annual
        </div>
        <h2 className="text-3xl font-bold mb-4">Start with 3 months free</h2>
        <p className="text-muted-foreground text-lg">
          One calm place to track addresses, services, renewal dates, moving tasks, and exports.
        </p>
      </div>

      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border-2 border-primary bg-card p-7 shadow-lg">
          <div className="mb-5">
            <p className="text-sm font-medium text-primary">3 months free, then annual billing</p>
            <h3 className="mt-2 text-2xl font-semibold">{plan.displayName}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Built for one person keeping household services and moving details organized.
            </p>
          </div>

          <div className="mb-6">
            <span className="text-5xl font-bold tracking-tight">{yearlyPrice.split("/")[0]}</span>
            <span className="text-muted-foreground">/year after trial</span>
            <p className="mt-1 text-xs text-muted-foreground">Today: $0</p>
          </div>

          <ul className="space-y-2.5 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Link href={ctaHref} className="mt-7 block">
            <Button className="w-full">
              {ctaLabelLoggedIn ? "Manage subscription" : "Start with 3 months free"}
            </Button>
          </Link>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Full checkout terms are shown before you agree to the trial.
          </p>
        </div>

        <div className="rounded-2xl border bg-muted/30 p-7">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Clear subscription terms</h3>
          </div>
          <div className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>Free Access and Free Trial are separate. Free Access does not require a payment method and does not auto-charge.</p>
            <p>The Individual Annual trial requires a payment method. Checkout shows today&apos;s due amount, trial length, first charge date, and annual renewal terms.</p>
            <p>You can cancel trial or renewal online from Settings.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
            <Link href="/billing-policy" className="underline hover:text-foreground">Billing Policy</Link>
            <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
