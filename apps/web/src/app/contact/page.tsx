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
  description: "Legal, privacy, billing, security, and support contact paths for Move.",
  path: "/contact",
});

const contactPaths = [
  {
    icon: HelpCircle,
    title: "General support",
    description: "Product questions, account access, onboarding, and non-urgent support.",
    email: LEGAL_CONTACTS.support,
    subject: "Move support request",
  },
  {
    icon: CreditCard,
    title: "Billing support",
    description: "Subscription, checkout, cancellation, renewal, invoice, or refund questions.",
    email: LEGAL_CONTACTS.billing,
    subject: "Move billing request",
  },
  {
    icon: ShieldCheck,
    title: "Privacy requests",
    description: "Access, correction, export, deletion, California privacy, or data rights requests.",
    email: LEGAL_CONTACTS.privacy,
    subject: "Move privacy request",
  },
  {
    icon: Scale,
    title: "Legal notices",
    description: "Formal legal notices, terms questions, or policy questions.",
    email: LEGAL_CONTACTS.legal,
    subject: "Move legal notice",
  },
  {
    icon: ShieldAlert,
    title: "Security disclosure",
    description: "Vulnerability reports, responsible disclosure, or account security concerns.",
    email: LEGAL_CONTACTS.security,
    subject: "Move security disclosure",
  },
  {
    icon: FileSignature,
    title: "DPA and subprocessors",
    description: "Data Processing Addendum, subprocessor, or business-customer privacy inquiries.",
    email: LEGAL_CONTACTS.dpa,
    subject: "Move DPA inquiry",
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
      title="Contact Move"
      description="Use the contact path that matches your request. Do not send passwords, payment card numbers, private keys, or other sensitive secrets by email."
    >
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{policyLastUpdatedLabel()}</p>

      <div className="grid gap-5 md:grid-cols-2">
        {contactPaths.map((item) => (
          <div
            key={item.title}
            className="space-y-3 rounded-[22px] border border-border bg-background/60 p-6 transition hover:border-primary/40"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <h2 className="font-display text-base font-bold tracking-tight text-foreground">{item.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            <a
              href={mailto(item.email, item.subject)}
              className="inline-flex items-center gap-2 font-mono text-sm font-medium text-primary hover:underline"
            >
              <Mail className="h-4 w-4" />
              {item.email}
            </a>
          </div>
        ))}
      </div>

      <PublicSection title="Mailing address">
        <div className="flex items-start gap-3 rounded-[22px] border border-border bg-background/60 p-6">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="space-y-1">
            <p className="font-display text-base font-bold tracking-tight text-foreground">{displayLegalEntityName()}</p>
            {publicCompanyAddress ? (
              <p className="text-[15px] leading-relaxed text-foreground/90">{publicCompanyAddress}</p>
            ) : (
              <p className="text-[15px] leading-relaxed text-foreground/90">Formal legal, billing, and privacy correspondence can use the contact paths above until the public mailing address is finalized.</p>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">{CONTACT_CONFIGURATION_NOTE}</p>
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

      <section className="overflow-hidden rounded-[26px] border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 text-center shadow-sm sm:p-12">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Need account-specific help?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-foreground/90">
          Sign in when your request involves saved addresses, services, subscriptions, exports, deletion, or support tickets tied to your account.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline" size="lg">
            <Link href="/faq">FAQ</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/sign-in">
              Sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </PublicPageShell>
  );
}
