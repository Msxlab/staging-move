import type { Metadata } from "next";
import { Clock, CreditCard, RefreshCw, Store } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { TRIAL_DURATION_DAYS } from "@locateflow/shared";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "LocateFlow refund and cancellation terms for web, iOS, and Android.",
  alternates: { canonical: "/refund" },
};

const highlights = [
  {
    icon: Clock,
    title: "Free trial first",
    description: `Every new account starts with a ${TRIAL_DURATION_DAYS}-day free trial. No credit card is required during the trial, so nothing is charged unless you choose to upgrade.`,
  },
  {
    icon: CreditCard,
    title: "Cancel anytime",
    description: "You can cancel a paid plan at any time from Settings → Subscription. Access continues through the end of the current billing period.",
  },
  {
    icon: RefreshCw,
    title: "Prorated credits",
    description: "When a plan is downgraded, LocateFlow applies a prorated credit toward the new plan rather than issuing a partial cash refund.",
  },
  {
    icon: Store,
    title: "Store purchases",
    description: "Subscriptions purchased through the App Store or Google Play are governed by that store's refund rules — you must request refunds through Apple or Google directly.",
  },
] as const;

export default function RefundPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Refund Policy"
      description="This page summarizes how trials, cancellations, and refunds work across web, iOS, and Android subscriptions."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {highlights.map((item) => (
          <div key={item.title} className="rounded-2xl border bg-muted/30 p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>

      <PublicSection title="Free trial">
        <p>
          New LocateFlow accounts include a {TRIAL_DURATION_DAYS}-day free trial with no credit card required. You can use the full product during the trial. If you choose not to upgrade, access to paid features ends when the trial expires — no charges apply.
        </p>
      </PublicSection>

      <PublicSection title="Cancellation">
        <p>
          Paid subscribers can cancel at any time from <em>Settings → Subscription</em>. Cancellations take effect at the end of the current billing period; you retain paid access until that date. After cancellation, the account returns to the free tier and your data is retained for a reasonable recovery window (see <a href="/privacy" className="underline">Privacy Policy</a>).
        </p>
      </PublicSection>

      <PublicSection title="Refunds on the web (Stripe)">
        <p>
          LocateFlow does not automatically refund partial periods. If you were billed in error, charged twice, or experienced a service outage that materially affected you, contact <a href="/contact" className="underline">support</a> within 14 days of the charge and we will review the refund request in good faith.
        </p>
        <p>
          Annual plans are eligible for a pro-rated refund within the first 14 days of the initial purchase. After 14 days, annual plans are non-refundable but can be cancelled to prevent renewal.
        </p>
      </PublicSection>

      <PublicSection title="Refunds on iOS and Android">
        <p>
          Subscriptions purchased through the Apple App Store or Google Play are billed and refunded by Apple or Google — not by LocateFlow. To request a refund, use the refund process in your store account.
        </p>
        <p>
          If you need help identifying the correct billing provider for your account, contact <a href="/contact" className="underline">LocateFlow support</a>.
        </p>
      </PublicSection>

      <PublicSection title="Chargebacks">
        <p>
          Initiating a chargeback before contacting support may result in the associated account being suspended while the dispute is reviewed. We encourage you to reach out first — most billing issues can be resolved quickly.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
