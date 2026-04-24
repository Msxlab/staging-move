import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Zap,
  Truck,
  Bell,
  FileText,
  CheckCircle2,
  ArrowRight,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "See how LocateFlow keeps every provider tied to your address in sync — from first signup to moving day.",
  alternates: {
    canonical: "/how-it-works",
  },
};

const steps = [
  {
    step: "01",
    icon: MapPin,
    title: "Add your addresses",
    body: "Start with the home you live in today. Tie additional properties — rentals, parents' house, a second home — so every provider has a clear owner.",
    detail:
      "We keep each address as its own surface. Services attach to the address, not your account, so moving a single property doesn't disturb the rest.",
  },
  {
    step: "02",
    icon: Zap,
    title: "Log every service",
    body: "Utility, bank, insurance, streaming, gym, HOA — whatever shows up on a statement. Photo a bill and we'll pull the provider, plan, and billing cycle.",
    detail:
      "OCR + provider match means you log once and the record stays. No spreadsheets, no duplicate entries when a plan renews.",
  },
  {
    step: "03",
    icon: Bell,
    title: "Stay ahead of renewals",
    body: "LocateFlow watches due dates, auto-renew windows, and annual price changes. You get a gentle nudge before money leaves your account.",
    detail:
      "Reminders arrive in the app, by email, or push. Snooze, mark handled, or jump straight to the provider login — your choice.",
  },
  {
    step: "04",
    icon: Truck,
    title: "Move without the list",
    body: "When you relocate, the moving checklist generates itself from your services and your destination state's requirements.",
    detail:
      "51 US states with rule coverage. Transfer, cancel, or re-open — each service has the right action for the address it's tied to.",
  },
] as const;

const pillars = [
  {
    icon: Shield,
    title: "Private by default",
    body: "Your data stays yours. Encrypted at rest, never sold, and available for 30 days after cancellation.",
  },
  {
    icon: FileText,
    title: "Documents in one place",
    body: "Store contracts, receipts, and proof-of-address with the service they belong to. Search finds the file, not the folder.",
  },
  {
    icon: CheckCircle2,
    title: "Export anytime",
    body: "CSV, PDF, or per-address packet. No lock-in — if you leave, you leave with everything.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <PublicPageShell
      eyebrow="How it works"
      title="Every provider tied to your address, in sync."
      description="Most people keep their service list in memory, email threads, and three browser tabs. LocateFlow replaces all of that with one place that notices when something changes."
    >
      <PublicSection title="The four things you'll do">
        <div className="grid gap-6 md:grid-cols-2">
          {steps.map(({ step, icon: Icon, title, body, detail }) => (
            <div
              key={step}
              className="rounded-xl border bg-background/60 p-5 space-y-3"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  {step}
                </span>
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
              </div>
              <p className="text-sm text-foreground/90">{body}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection title="What makes it different">
        <div className="grid gap-4 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div key={title} className="space-y-2">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection title="A typical week">
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 mt-1 text-success shrink-0" />
            <span><strong className="text-foreground">Monday.</strong> Your internet bill is up for renewal in 6 days — tap to review the new plan, swap, or keep going.</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 mt-1 text-success shrink-0" />
            <span><strong className="text-foreground">Wednesday.</strong> Snapped a new HOA statement on the porch — log-a-service flow reads it and attaches the PDF to the right address.</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 mt-1 text-success shrink-0" />
            <span><strong className="text-foreground">Friday.</strong> Closing on a new place in 6 weeks — the move checklist already knows which services need a transfer and which need a fresh signup.</span>
          </li>
        </ul>
      </PublicSection>

      <PublicSection title="Ready to see your list in one place?">
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/sign-up">
            <Button size="lg">
              Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" size="lg">See pricing</Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          No credit card required · Cancel anytime · Your data stays available for 30 days after cancellation.
        </p>
      </PublicSection>
    </PublicPageShell>
  );
}
