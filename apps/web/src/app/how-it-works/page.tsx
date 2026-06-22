import Link from "next/link";
import {
  MapPin,
  Zap,
  Truck,
  Bell,
  CheckCircle2,
  ArrowRight,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { JsonLd, howToSchema } from "@/components/seo/json-ld";
import { absoluteUrl, createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "How It Works",
  description:
    "See how LocateFlow helps organize providers, addresses, reminders, and moving tasks without replacing provider confirmation.",
  path: "/how-it-works",
});

const steps = [
  {
    step: "01",
    icon: MapPin,
    title: "Add your addresses",
    body: "Start with the home you live in today. Add rentals, a family address, or a second home when you have permission to manage those records.",
    detail:
      "We keep each address as its own surface. Services attach to the address, not your account, so moving a single property doesn't disturb the rest.",
  },
  {
    step: "02",
    icon: Zap,
    title: "Log every service",
    body: "Utility, bank, insurance, streaming, gym, HOA - whatever shows up on a statement. Add the provider details you want to track.",
    detail:
      "Provider matching may assist entry when available, but you should confirm provider, plan, billing, and contract details before relying on them.",
  },
  {
    step: "03",
    icon: Bell,
    title: "Stay ahead of renewals",
    body: "LocateFlow helps track due dates, auto-renew windows, and price notes you enter. You can get reminders before a date you saved becomes urgent.",
    detail:
      "Reminders arrive in the app and by email. Snooze, mark handled, or jump straight to the provider login - your choice.",
  },
  {
    step: "04",
    icon: Truck,
    title: "Organize without the list",
    body: "When you relocate, the moving checklist uses your saved services and destination context to suggest tasks.",
    detail:
      "Guidance may include US state and DC context, but requirements and provider processes change. Verify each task with the provider or agency before acting.",
  },
] as const;

const pillars = [
  {
    icon: Shield,
    title: "Private by default",
    body: "Your account data is scoped to your account. LocateFlow uses access controls and privacy tools and does not sell user-entered relocation data.",
  },
  {
    icon: Bell,
    title: "Reminders that reach you",
    body: "Renewal windows, contract end dates, and bill due dates you save become reminders in the app and by email - before they turn into late fees.",
  },
  {
    icon: CheckCircle2,
    title: "Export anytime",
    body: "Export tools help you download supported account records. Some backups, billing, audit, legal, and security records may be retained when needed.",
  },
] as const;

export default function HowItWorksPage() {
  // HowTo structured data, built from the SAME `steps` array rendered below so
  // the rich result can never describe a procedure the reader can't see. Each
  // step deep-links to the page so a HowToStep `url` resolves to real content.
  const howTo = howToSchema({
    name: "How to organize your providers, addresses, and moving tasks with LocateFlow",
    description:
      "Four steps to set up LocateFlow: add your addresses, log every service, stay ahead of renewals, and turn a move into a checklist.",
    steps: steps.map((s) => ({
      name: s.title,
      text: s.body,
      url: `${absoluteUrl("/how-it-works")}#step-${s.step}`,
    })),
  });

  return (
    <PublicPageShell
      eyebrow="How it works"
      title="Providers, addresses, and moving tasks in one place."
      description="Most people keep their service list in memory, email threads, and three browser tabs. LocateFlow gives you one place to organize the records and reminders you need to verify."
    >
      <JsonLd id="ld-howto" data={howTo} />
      <PublicSection title="The four things you'll do">
        <div className="grid gap-5 md:grid-cols-2">
          {steps.map(({ step, icon: Icon, title, body, detail }) => (
            <div
              key={step}
              id={`step-${step}`}
              className="scroll-mt-24 space-y-4 rounded-[22px] border border-border bg-background/60 p-7 transition hover:border-primary/40"
            >
              <div className="flex items-center gap-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {step}
                </span>
              </div>
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">{title}</h3>
              <p className="text-[15px] leading-relaxed text-foreground/90">{body}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection title="What makes it different">
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="space-y-3 rounded-[22px] border border-border bg-background/60 p-6 transition hover:border-primary/40"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-display text-base font-bold tracking-tight text-foreground">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection title="A typical week">
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success" />
            <span><strong className="text-foreground">Monday.</strong> Your internet bill renewal date is in 6 days - tap to review your saved record and decide what to confirm with the provider.</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success" />
            <span><strong className="text-foreground">Wednesday.</strong> Add a new HOA statement to the right address so the cost and renewal are easy to find later.</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success" />
            <span><strong className="text-foreground">Friday.</strong> Closing on a new place in 6 weeks - your checklist suggests which services may need transfer, cancellation, or new setup.</span>
          </li>
        </ul>
      </PublicSection>

      <section className="overflow-hidden rounded-[26px] border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 text-center shadow-sm sm:p-12">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Ready to see your list in one place?
        </h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-xs text-muted-foreground">
          Trial length, renewal date, price, and payment method requirements are shown at checkout. See the{" "}
          <Link href="/billing-policy" className="underline">Billing Policy</Link>{" "}
          and <Link href="/disclaimer" className="underline">Disclaimer</Link> before relying on provider or moving guidance.
        </p>
      </section>
    </PublicPageShell>
  );
}
