import Link from "next/link";
import { CalendarClock, CreditCard, ReceiptText, Store } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { LEGAL_CONTACTS, STORE_PURCHASE_DISTINCTION, mailto, policyLastUpdatedLabel } from "@/lib/legal-info";
import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "Billing Policy",
  description: "Move subscription billing, trials, renewals, cancellation, failed payments, taxes, and store-purchase terms.",
  path: "/billing-policy",
});

const highlights = [
  {
    icon: CalendarClock,
    title: "Trial and offer terms",
    description: "Trial length, price, renewal date, and today's due amount are shown at checkout before purchase.",
  },
  {
    icon: CreditCard,
    title: "Stripe web billing",
    description: "Web subscriptions are created and managed through Stripe checkout and the in-app billing portal.",
  },
  {
    icon: Store,
    title: "Mobile stores",
    description: "iOS and Android subscriptions are managed by Apple App Store or Google Play when purchased there.",
  },
  {
    icon: ReceiptText,
    title: "Cancellation and refunds",
    description: "Cancellation stops future renewal where supported, but it does not automatically refund past charges.",
  },
] as const;

export default function BillingPolicyPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Billing Policy"
      description="How Move billing, trials, subscriptions, auto-renewal, cancellation, failed payments, taxes, and store purchases work."
    >
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{policyLastUpdatedLabel()}</p>

      <div className="grid gap-5 md:grid-cols-2">
        {highlights.map((item) => (
          <div
            key={item.title}
            className="space-y-3 rounded-2xl border border-border bg-card p-7 transition hover:border-primary/40"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <h2 className="font-display text-base font-bold tracking-tight text-foreground">{item.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>

      <PublicSection title="Free Access, trials, and promotions">
        <p>
          Free Access is a cardless access mode when offered. It does not require a payment method and does not create an automatic charge. Free Access may end, convert to limited access, or require an upgrade on the date shown in your account or offer screen.
        </p>
        <p>
          Free Trial and promotional subscription offers may require a payment method. The checkout page shows the trial length, price, first charge date, renewal interval, cancellation instructions, and policy links before you agree. Do not rely on marketing summaries if the checkout screen shows different offer terms.
        </p>
      </PublicSection>

      <PublicSection title="Web subscriptions through Stripe">
        <p>
          Web subscriptions are processed by Stripe. Move does not store full payment card numbers. Stripe may collect billing details, tax details, and payment information under Stripe's own terms and privacy policy.
        </p>
        <p>
          Individual Annual subscriptions renew yearly unless canceled before renewal. Individual Monthly subscriptions, when offered, start when purchased and renew monthly unless canceled before renewal.
        </p>
      </PublicSection>

      <PublicSection title="App Store and Google Play subscriptions">
        <p>{STORE_PURCHASE_DISTINCTION}</p>
        <p>
          Store-managed subscriptions should be canceled or managed through the applicable store account settings. Move may show subscription status in the app, but Apple or Google may control cancellation timing, billing history, receipts, and refund handling for purchases made through their stores.
        </p>
      </PublicSection>

      <PublicSection title="Auto-renewal and cancellation">
        <p>
          Paid subscriptions renew automatically unless canceled. Canceling a trial or renewal stops future billing where supported, but access may continue through the current trial or paid period. Cancellation does not automatically create a refund for prior charges.
        </p>
        <p>
          You can cancel supported web subscriptions from Settings or the Stripe billing portal. If the subscription was purchased through Apple App Store or Google Play, use the store's subscription management tools.
        </p>
      </PublicSection>

      <PublicSection title="Failed payments, taxes, and plan changes">
        <p>
          If a payment fails, Move or its payment processor may retry the charge, send account notices, limit paid features, or suspend paid access after a grace period. Taxes, exchange-rate effects, and payment processor fees may depend on your location and payment method.
        </p>
        <p>
          Plan changes, promotions, coupons, campaign codes, and beta offers may change the price, trial period, renewal date, or billing interval shown at checkout. The final checkout or store confirmation controls the purchase.
        </p>
      </PublicSection>

      <PublicSection title="Billing questions">
        <p>
          For billing support, email <a href={mailto(LEGAL_CONTACTS.billing, "LocateFlow billing request")} className="text-primary underline">{LEGAL_CONTACTS.billing}</a>. See the <Link href="/refund" className="text-primary underline">Refund Policy</Link> for refund request windows and exclusions.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
