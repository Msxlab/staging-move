import Link from "next/link";
import { CreditCard, FileText, RotateCcw, Store } from "lucide-react";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { LEGAL_CONTACTS, STORE_PURCHASE_DISTINCTION, mailto, policyLastUpdatedLabel } from "@/lib/legal-info";
import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "Refund Policy",
  description: "LocateFlow refund eligibility, refund request windows, and store-purchase refund handling.",
  path: "/refund",
});

const highlights = [
  {
    icon: RotateCcw,
    title: "Cancellation is not always a refund",
    description: "Cancellation stops future renewal where supported. Refund eligibility is evaluated separately under this policy.",
  },
  {
    icon: CreditCard,
    title: "Web purchases",
    description: "Stripe web purchases are reviewed by LocateFlow support under the request windows below.",
  },
  {
    icon: Store,
    title: "Mobile store purchases",
    description: "Apple App Store and Google Play purchases may require refund requests through the applicable store.",
  },
  {
    icon: FileText,
    title: "Offer terms control",
    description: "Promotional terms shown at checkout may set additional eligibility rules or deadlines.",
  },
] as const;

export default function RefundPolicyPage() {
  return (
    <PublicPageShell
      eyebrow="Legal"
      title="Refund Policy"
      description="This policy explains how refund requests are handled for LocateFlow subscriptions. It does not replace the final offer terms shown at checkout or mobile store rules."
    >
      <p className="text-sm text-muted-foreground">{policyLastUpdatedLabel()}</p>

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

      <PublicSection title="Web subscription refunds">
        <p>
          For Stripe web purchases, a first annual charge after a trial may be eligible for a refund if you contact billing support within 14 days after that first annual charge.
        </p>
        <p>
          Annual renewal charges may be eligible for a refund if you contact billing support within 7 days after the renewal charge. Monthly charges are generally non-refundable once the paid month begins, except where required by law or approved by support for a billing error or service issue.
        </p>
      </PublicSection>

      <PublicSection title="Mobile store refunds">
        <p>{STORE_PURCHASE_DISTINCTION}</p>
        <p>
          If you subscribed through Apple App Store or Google Play, refund requests may need to be submitted directly to Apple or Google. LocateFlow may not be able to issue a direct refund for store-managed purchases.
        </p>
      </PublicSection>

      <PublicSection title="Refunds are not guaranteed">
        <p>
          Refunds are generally not available after the applicable request window, after substantial use of a paid period, or when access was suspended for violation of the Terms or Acceptable Use Policy. Duplicate charges, unauthorized charges, major service outages, legal requirements, or support-approved exceptions may be reviewed case by case.
        </p>
        <p>
          Promotional, campaign, beta, or discounted offers may have different terms. The checkout page or store purchase screen controls if it states a different trial length, renewal date, price, or refund condition.
        </p>
      </PublicSection>

      <PublicSection title="How to request a refund">
        <p>
          Email <a href={mailto(LEGAL_CONTACTS.billing, "LocateFlow refund request")} className="underline">{LEGAL_CONTACTS.billing}</a> with the account email, purchase platform, charge date, and a short description. Do not send payment card numbers or sensitive secrets.
        </p>
        <p>
          See the <Link href="/billing-policy" className="underline">Billing Policy</Link> for subscription, renewal, failed payment, tax, and cancellation terms.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
