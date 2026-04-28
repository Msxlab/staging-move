import type { Metadata } from "next";
import { CalendarClock, CreditCard, FileText, RotateCcw } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";

export const metadata: Metadata = {
  title: "Billing Policy",
  description: "LocateFlow billing, subscription, cancellation, and refund terms for Individual access.",
  alternates: { canonical: "/refund" },
};

const highlights = [
  {
    icon: CreditCard,
    title: "Free Access",
    description: "No payment method is required and no automatic charge occurs. Access ends on the date shown in your account.",
  },
  {
    icon: CalendarClock,
    title: "Free Trial",
    description: "A payment method is required. The Individual Annual plan starts after the trial unless you cancel before the first charge date.",
  },
  {
    icon: RotateCcw,
    title: "Cancel online",
    description: "You can cancel a trial or turn off annual renewal from Settings. Access continues through the applicable trial or paid period.",
  },
  {
    icon: FileText,
    title: "Policy details",
    description: "Refund windows and exceptions are listed here so normal product screens can stay calm and uncluttered.",
  },
] as const;

export default function BillingPolicyPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Billing Policy"
      description="How Free Access, Free Trial, annual billing, cancellation, and refund requests work for LocateFlow Individual."
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

      <PublicSection title="Free Access">
        <p>
          Free Access is a cardless access mode. It does not require a credit card, does not create an automatic charge, and does not create a Stripe subscription unless an internal entitlement record is needed to track access.
        </p>
        <p>
          When Free Access ends, the account moves to the limited, paywall, or read-only state supported by the current product. You may choose an annual plan from Settings.
        </p>
      </PublicSection>

      <PublicSection title="Free Trial">
        <p>
          Free Trial is attached to Individual Annual. A payment method is required at checkout, and the checkout screen shows today's due amount, the trial length, the annual plan start date, the first charge amount and date, renewal interval, cancellation instructions, and policy links before you agree.
        </p>
        <p>
          If you cancel before the trial ends, no first annual charge is made. Trial access continues until the trial end date unless support or an admin action changes the account.
        </p>
      </PublicSection>

      <PublicSection title="Paid Individual Annual">
        <p>
          Paid Individual Annual subscriptions renew yearly unless renewal is canceled. You can cancel renewal online in Settings. Paid access continues through the current paid period after cancellation.
        </p>
      </PublicSection>

      <PublicSection title="Refund request windows">
        <p>
          First annual charge after a trial: a full refund is available within 14 days if requested through support or a supported self-service refund request flow.
        </p>
        <p>
          Annual renewal charge: a full refund is available within 7 days. After those windows, charges are generally non-refundable except for duplicate charges, unauthorized charges, major service outages, legal requirements, or support-approved exceptions.
        </p>
      </PublicSection>

      <PublicSection title="Data access after cancellation">
        <p>
          Export and data deletion tools remain available according to LocateFlow's Privacy Policy and current product capabilities. Export important records before a retention period ends.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
