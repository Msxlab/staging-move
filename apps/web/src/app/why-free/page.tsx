import Link from "next/link";
import { ArrowRight, BadgeDollarSign, CheckCircle2, Handshake, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "Why Free",
  description:
    "Move can be free for consumers because optional provider, partner, and future concierge or business offers support the product without forcing a subscription.",
  path: "/why-free",
});

const principles = [
  {
    icon: BadgeDollarSign,
    title: "$0 for the core move",
    body: "The consumer product is positioned around a free move workflow: address organization, provider tracking, reminders, checklists, and guides.",
  },
  {
    icon: Handshake,
    title: "Optional partner economics",
    body: "If a user chooses an eligible provider or future partner offer, Move may earn a referral. The user can still complete the move without taking an offer.",
  },
  {
    icon: ShieldCheck,
    title: "No hidden account action",
    body: "Move does not secretly update accounts, sell a completed action, or pretend to be a provider. The user confirms every real account change.",
  },
] as const;

const checks = [
  "No credit card required for the free consumer workflow.",
  "Provider suggestions are optional and should be confirmed on the provider site.",
  "Guides and reminders are organizational help, not legal, tax, insurance, or government advice.",
  "Future concierge or business products can exist without locking the core move behind a paywall.",
] as const;

export default function WhyFreePage() {
  return (
    <PublicPageShell
      eyebrow="Why it is free"
      title="Free because the move should start before the checkout page."
      description="Consumers can organize a move at no cost, while optional partner, concierge, and business surfaces can support the platform without locking the core workflow behind a paywall."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {principles.map(({ icon: Icon, title, body }) => (
          <article key={title} className="rounded-2xl border border-border bg-card p-6">
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
          </article>
        ))}
      </div>

      <PublicSection title="What users should know">
        <ul className="grid gap-3">
          {checks.map((check) => (
            <li key={check} className="flex gap-3">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />
              <span>{check}</span>
            </li>
          ))}
        </ul>
      </PublicSection>

      <section className="rounded-[26px] border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden />
        <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-foreground">
          Start your move free.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Add the current address, the new address, and the move date. The checklist, reminders, provider records, and guide surfaces build from there.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">
              Get the app <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/features">See features</Link>
          </Button>
        </div>
      </section>
    </PublicPageShell>
  );
}
