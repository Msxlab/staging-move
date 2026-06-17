import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  FileSignature,
  HelpCircle,
  Mail,
  MapPin,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { createPublicPageMetadata } from "@/lib/seo";
import {
  CONTACT_CONFIGURATION_NOTE,
  displayCompanyAddress,
  displayLegalEntityName,
  LEGAL_CONTACTS,
  mailto,
  policyLastUpdatedLabel,
} from "@/lib/legal-info";

export const metadata = createPublicPageMetadata({
  title: "Contact",
  description: "Legal, privacy, billing, security, and support contact paths for LocateFlow.",
  path: "/contact",
});

const contactPaths = [
  {
    icon: HelpCircle,
    title: "General support",
    description: "Product questions, account access, onboarding, and non-urgent support.",
    email: LEGAL_CONTACTS.support,
    subject: "LocateFlow support request",
  },
  {
    icon: CreditCard,
    title: "Billing support",
    description: "Subscription, checkout, cancellation, renewal, invoice, or refund questions.",
    email: LEGAL_CONTACTS.billing,
    subject: "LocateFlow billing request",
  },
  {
    icon: ShieldCheck,
    title: "Privacy requests",
    description: "Access, correction, export, deletion, California privacy, or data rights requests.",
    email: LEGAL_CONTACTS.privacy,
    subject: "LocateFlow privacy request",
  },
  {
    icon: Scale,
    title: "Legal notices",
    description: "Formal legal notices, terms questions, or policy questions.",
    email: LEGAL_CONTACTS.legal,
    subject: "LocateFlow legal notice",
  },
  {
    icon: ShieldAlert,
    title: "Security disclosure",
    description: "Vulnerability reports, responsible disclosure, or account security concerns.",
    email: LEGAL_CONTACTS.security,
    subject: "LocateFlow security disclosure",
  },
  {
    icon: FileSignature,
    title: "DPA and subprocessors",
    description: "Data Processing Addendum, subprocessor, or business-customer privacy inquiries.",
    email: LEGAL_CONTACTS.dpa,
    subject: "LocateFlow DPA inquiry",
  },
] as const;

const policyLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Billing Policy", href: "/billing-policy" },
  { label: "Refund Policy", href: "/refund" },
  { label: "Security", href: "/security" },
  { label: "DPA", href: "/dpa" },
] as const;

const publicCompanyAddress = displayCompanyAddress();

export default function ContactPage() {
  return (
    <PublicPageShell
      eyebrow="Support"
      title="Contact LocateFlow"
      description="Use the contact path that matches your request. Do not send passwords, payment card numbers, private keys, or other sensitive secrets by email."
    >
      <p className="text-sm text-muted-foreground">{policyLastUpdatedLabel()}</p>

      <div className="grid gap-4 md:grid-cols-2">
        {contactPaths.map((item) => (
          <div key={item.title} className="rounded-2xl border bg-muted/30 p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            <a
              href={mailto(item.email, item.subject)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Mail className="h-4 w-4" />
              {item.email}
            </a>
          </div>
        ))}
      </div>

      <PublicSection title="Mailing address">
        <div className="flex items-start gap-3">
          <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium text-foreground">{displayLegalEntityName()}</p>
            {publicCompanyAddress ? (
              <p>{publicCompanyAddress}</p>
            ) : (
              <p>Formal legal, billing, and privacy correspondence can use the contact paths above until the public mailing address is finalized.</p>
            )}
            <p className="text-xs">{CONTACT_CONFIGURATION_NOTE}</p>
          </div>
        </div>
      </PublicSection>

      <PublicSection title="Policy links">
        <div className="flex flex-wrap gap-3">
          {policyLinks.map((link) => (
            <Button key={link.href} asChild variant="outline" size="sm">
              <Link href={link.href}>
                {link.label}
              </Link>
            </Button>
          ))}
        </div>
      </PublicSection>

      <div className="rounded-2xl border bg-background p-6">
        <h2 className="text-xl font-semibold text-foreground">Need account-specific help?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in when your request involves saved addresses, services, subscriptions, exports, deletion, or support tickets tied to your account.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/faq">FAQ</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-in">
              Sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </PublicPageShell>
  );
}
