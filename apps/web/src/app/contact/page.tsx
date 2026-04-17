import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HelpCircle, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the right LocateFlow support path.",
  alternates: {
    canonical: "/contact",
  },
};

const contactPaths = [
  {
    icon: HelpCircle,
    title: "Product help",
    description: "Browse guides and FAQs for onboarding, services, addresses, and moving workflows.",
    href: "/help",
    label: "Open Help Center",
  },
  {
    icon: KeyRound,
    title: "Existing account support",
    description: "Sign in to manage your account, update settings, or continue your relocation workflow.",
    href: "/sign-in",
    label: "Sign In",
  },
  {
    icon: ShieldCheck,
    title: "Privacy and data requests",
    description: "Review privacy expectations and use in-app account controls when you need account or data-management help.",
    href: "/privacy",
    label: "Review Privacy Policy",
  },
  {
    icon: Sparkles,
    title: "New to LocateFlow",
    description: "Open onboarding to explore the product and start organizing your move, addresses, and services.",
    href: "/onboarding",
    label: "Open App",
  },
] as const;

export default function ContactPage() {
  return (
    <PublicPageShell
      eyebrow="Support"
      title="Contact LocateFlow"
      description="Use the path below that best matches your request so it reaches the right product workflow as quickly as possible."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {contactPaths.map((item) => (
          <div key={item.title} className="rounded-2xl border bg-muted/30 p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            <Link href={item.href} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              {item.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>

      <PublicSection title="Fastest support routes">
        <p>
          The fastest way to get help is usually through the Help Center for guidance, or by signing in if your request is tied to your specific account, subscription, or saved relocation data.
        </p>
      </PublicSection>

      <PublicSection title="What to include when asking for help">
        <p>
          Include the part of the product you were using, the type of address or service workflow involved, the page where the issue happened, and what result you expected. That makes it easier to route the request correctly.
        </p>
      </PublicSection>

      <div className="rounded-2xl border bg-background p-6">
        <h2 className="text-xl font-semibold text-foreground">Need to jump in right now?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Start with Help Center articles or open the app directly to continue onboarding and manage your move.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/help">
            <Button variant="outline">Help Center</Button>
          </Link>
          <Link href="/onboarding">
            <Button>
              Open LocateFlow
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </PublicPageShell>
  );
}
