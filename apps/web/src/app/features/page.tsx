import Link from "next/link";
import {
  Bell,
  Building2,
  CheckCircle2,
  FileText,
  Map,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPageShell, PublicSection } from "@/components/marketing/public-page-shell";
import { createPublicPageMetadata } from "@/lib/seo";

export const metadata = createPublicPageMetadata({
  title: "Features",
  description:
    "Move brings address records, provider tracking, moving tasks, reminders, budgets, dossiers, exports, and shared household workflows into one calm workspace.",
  path: "/features",
});

const featureGroups = [
  {
    title: "Plan the move",
    items: [
      { icon: Truck, title: "Move command center", body: "Create a move plan, connect origin and destination addresses, and see the next tasks that need attention." },
      { icon: CheckCircle2, title: "Guided task flow", body: "Track government, utility, insurance, school, vehicle, mail, and logistics steps without hiding the manual confirmation work." },
      { icon: Bell, title: "Reminders", body: "Surface overdue, this-week, and upcoming tasks across web and mobile so the move does not rely on memory." },
    ],
  },
  {
    title: "Track the home",
    items: [
      { icon: Building2, title: "Addresses and services", body: "Keep services attached to the right address, then see what is still tied to the old place when you move." },
      { icon: Wifi, title: "Provider discovery", body: "Compare available internet, utility, mover, insurance, and custom provider records where catalog data is present." },
      { icon: Map, title: "Dossier context", body: "Review flood, school, weather, hazard, route, and address context for the new home when data is available." },
    ],
  },
  {
    title: "Operate with confidence",
    items: [
      { icon: Search, title: "Global search", body: "Find services, tasks, addresses, providers, guides, budgets, and custom records from one mobile search surface." },
      { icon: FileText, title: "Exports", body: "Download supported records as CSV or PDF when you need a backup, household handoff, or practical moving packet." },
      { icon: Users, title: "Household workspace", body: "Invite family members, share selected workflows, and keep accountability visible for shared moves." },
    ],
  },
] as const;

export default function FeaturesPage() {
  return (
    <PublicPageShell
      eyebrow="Features"
      title="Everything tied to the move, finally in one place."
      description="The design bundle treats features as a first-class web page. This page maps that surface onto the live product areas: moving, services, addresses, providers, search, dossiers, budgets, reminders, exports, and household collaboration."
    >
      <div className="grid gap-5">
        {featureGroups.map((group) => (
          <PublicSection key={group.title} title={group.title}>
            <div className="grid gap-4 md:grid-cols-3">
              {group.items.map(({ icon: Icon, title, body }) => (
                <article key={title} className="rounded-2xl border border-border bg-background/60 p-5">
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="font-display text-base font-bold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </article>
              ))}
            </div>
          </PublicSection>
        ))}
      </div>

      <section className="rounded-[26px] border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden />
        <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-foreground">
          Start with your current address.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Move will organize the rest around it: services, providers, reminders, budgets, dossiers, and the checklist for what changes next.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Get the app</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/why-free">Why it is free</Link>
          </Button>
        </div>
      </section>

      <PublicSection title="Trust boundary">
        <div className="flex gap-3">
          <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p>
            Move tracks and reminds. It does not log into provider accounts, file government forms, transfer utilities, or change billing on your behalf. The product keeps the real-world action visible so users confirm each change through the official provider or agency.
          </p>
        </div>
      </PublicSection>
    </PublicPageShell>
  );
}
