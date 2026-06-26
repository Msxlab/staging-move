"use client";

import React, { useState } from "react";
import {
  CalendarCheck,
  Truck,
  PlugZap,
  Star,
  Wifi,
  Zap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { MonthlyBudgetCard } from "@/components/ui/credit-usage-card";
import {
  ProvidersDirectory,
  type ProviderItem,
} from "@/components/ui/integration-card";
import { ProviderProfileCard } from "@/components/ui/profile-card";
import { ContinuousTabs } from "@/components/ui/continuous-tabs";
import { AccordionApp } from "@/components/ui/card-split-accordion";
import { InlineAction } from "@/components/ui/inline-action";
import { StepPager } from "@/components/ui/step-pager";
import { FloatingInput } from "@/components/ui/floating-input";
import { LabeledProgressIndicator } from "@/components/ui/labeled-progress-indicator";
import { TaskWidget, type TaskData } from "@/components/ui/task-widget-disclosure";
import {
  FilterDisclosure,
  REMINDER_FILTERS,
  SUBSCRIPTION_FILTERS,
  PROVIDER_FILTERS,
} from "@/components/ui/filter-disclosure";
import { CommandSearch } from "@/components/ui/command-search";
import { SaveToggle } from "@/components/ui/save-toggle";
import { FeedbackAction } from "@/components/ui/feedback-action";
import { ViewOnMap } from "@/components/ui/view-on-map";
import { TimedUndoAction } from "@/components/ui/timed-undo-action";
import { EditableBatchSections } from "./_editable-batch-sections";
import { BillingActivitySections } from "./billing-activity-sections";
import { SwitchUploadNotifySections } from "./_switch-upload-notify-sections";
import { SyncMapUndoSections } from "./_sync-map-undo-sections";

// --- task-widget-disclosure sample data ---
// Repurposed as an expandable moving-plan task card: title = the move task,
// subtasks = steps, assignees = family members, priority + status = progress.
const INTERNET_TASK: TaskData = {
  title: "Transfer internet",
  progress: 60,
  completedCount: 3,
  totalCount: 5,
  priority: "High",
  status: "In progress",
  subtasks: [
    { id: "s1", title: "Confirm new-address service availability", completed: true },
    { id: "s2", title: "Book transfer with current ISP", completed: true },
    { id: "s3", title: "Schedule technician install (Jul 2)", completed: true },
    { id: "s4", title: "Return old router / equipment", completed: false },
    { id: "s5", title: "Test connection on move-in day", completed: false },
  ],
  assignees: [
    { name: "Mustafa A.", avatar: "https://i.pravatar.cc/80?img=12" },
    { name: "Layla A.", avatar: "https://i.pravatar.cc/80?img=45" },
  ],
};

const UTILITIES_TASK: TaskData = {
  title: "Set up utilities",
  progress: 25,
  completedCount: 1,
  totalCount: 4,
  priority: "Medium",
  status: "Not started",
  subtasks: [
    { id: "u1", title: "Open electricity account at new home", completed: true },
    { id: "u2", title: "Transfer gas service", completed: false },
    { id: "u3", title: "Set up water / sewer billing", completed: false },
    { id: "u4", title: "Schedule final meter readings", completed: false },
  ],
  assignees: [
    { name: "Mustafa A.", avatar: "https://i.pravatar.cc/80?img=12" },
  ],
};

// --- continuous-tabs sample data ---
// Repurposed from the demo Home/Interactions/Resources/Docs slider into
// entity-detail section tabs.
const PROVIDER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "reviews", label: "Reviews" },
  { id: "quotes", label: "Quotes" },
  { id: "contact", label: "Contact" },
];

const MOVE_TABS = [
  { id: "plan", label: "Plan" },
  { id: "checklist", label: "Checklist" },
  { id: "documents", label: "Documents" },
];

// --- inline-action helper ---
// Fake async confirm so the slide/tap-to-confirm demo runs end-to-end.
const fakeConfirm = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 1100));

// --- credit-usage-card -> Monthly Budget card sample data ---
// This-month expense + subscription line items (Date / Service / Category /
// Amount) replacing the original AI usage-history rows.
const BUDGET_LINE_ITEMS = [
  { date: "Jun 24", service: "Allied Van Lines", category: "Movers", amount: "$1,240.00" },
  { date: "Jun 22", service: "Comcast Xfinity", category: "Internet", amount: "$89.99" },
  { date: "Jun 19", service: "City Water & Power", category: "Utilities", amount: "$142.50" },
  { date: "Jun 17", service: "Lemonade Renters", category: "Insurance", amount: "$28.00" },
  { date: "Jun 13", service: "U-Haul Boxes & Tape", category: "Supplies", amount: "$64.30" },
  { date: "Jun 09", service: "TaskRabbit Assembly", category: "Labor", amount: "$120.00" },
];

// --- integration-card -> Providers directory sample data ---
// Provider/service cards (logo, name, rating, Add service) with category tags
// (Movers/Utilities/Internet/Insurance) and move-stage in the service line.
const PROVIDERS: ProviderItem[] = [
  {
    id: "allied",
    name: "Allied Van Lines",
    serviceLine: "MOVERS · PRE-MOVE",
    description:
      "Full-service interstate movers with packing, storage, and a dedicated move coordinator.",
    tags: ["Movers"],
    rating: 4.8,
    reviews: 312,
    available: true,
    added: true,
    icon: <Truck size={20} />,
  },
  {
    id: "xfinity",
    name: "Comcast Xfinity",
    serviceLine: "INTERNET · POST-MOVE",
    description:
      "Gigabit home internet with same-week installation and a no-contract intro plan.",
    tags: ["Internet"],
    rating: 3.9,
    reviews: 1280,
    available: true,
    icon: <Wifi size={20} />,
  },
  {
    id: "citypower",
    name: "City Water & Power",
    serviceLine: "UTILITIES · MOVE DAY",
    description:
      "Set up electricity, gas, and water transfer for your new address in one request.",
    tags: ["Utilities"],
    rating: 4.2,
    reviews: 540,
    available: true,
    icon: <Zap size={20} />,
  },
  {
    id: "lemonade",
    name: "Lemonade Renters",
    serviceLine: "INSURANCE · PRE-MOVE",
    description:
      "Renters and home insurance with instant quotes and AI-powered claims in minutes.",
    tags: ["Insurance"],
    rating: 4.6,
    reviews: 880,
    available: false,
    icon: <ShieldCheck size={20} />,
  },
  {
    id: "twomen",
    name: "Two Men and a Truck",
    serviceLine: "MOVERS · MOVE DAY",
    description:
      "Local move-day crews for apartments and small homes, billed by the hour.",
    tags: ["Movers"],
    rating: 4.5,
    reviews: 204,
    available: true,
    icon: <Truck size={20} />,
  },
  {
    id: "homeglow",
    name: "HomeGlow Cleaning",
    serviceLine: "UTILITIES · POST-MOVE",
    description:
      "Move-in deep cleans and recurring service to get your new place spotless on day one.",
    tags: ["Utilities"],
    rating: 4.7,
    reviews: 96,
    available: true,
    icon: <Sparkles size={20} />,
  },
  {
    id: "att",
    name: "AT&T Fiber",
    serviceLine: "INTERNET · POST-MOVE",
    description:
      "Symmetrical fiber plans with self-install kits available in select metros.",
    tags: ["Internet"],
    rating: 4.0,
    reviews: 760,
    available: true,
    icon: <Wifi size={20} />,
  },
];

/**
 * Dev-only, no-auth preview for the second shadcn install batch.
 *
 * Renders three third-party components from the registry after re-theming them
 * onto our sapphire (no-gold) design tokens and repurposing their demo content
 * to LocateFlow use-cases. The `.light` wrapper forces the light theme so the
 * lead can screenshot the sapphire treatment on a light canvas.
 *
 * URL: /dev/shadcn-batch
 * NOTE: preview only — not yet wired into production pages.
 */
export default function ShadcnBatchPage() {
  const [providerTab, setProviderTab] = useState("overview");
  const [moveTab, setMoveTab] = useState("plan");

  return (
    <div className="light min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            shadcn batch — re-themed to sapphire (no gold)
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            step-pager, floating-input, and labeled-progress-indicator, each
            re-themed onto our CSS-var tokens and repurposed for LocateFlow.
            Accents, surfaces, borders, and success states resolve through the
            theme — zero hardcoded hex, zero gold/amber.
          </p>
        </header>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            step-pager
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Move-plan stage stepper
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Onboarding gate + moving-plan progress header. Phases: Plan → Book →
            Pack → Move day → Settle in.
          </p>
          <div className="flex justify-center py-4">
            <StepPager initialStep={2} />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            floating-input
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Standard labeled form field
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Used across add-address, add-service, provider-contact, and budget
            forms. Label animates up on focus or when filled.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <FloatingInput label="Address line" defaultValue="221B Baker Street" />
            <FloatingInput label="City" />
            <FloatingInput label="Service name" defaultValue="Pickfords Removals" />
            <FloatingInput label="Monthly budget (£)" type="number" />
            <FloatingInput label="Provider contact" type="email" />
            <FloatingInput label="Move date" type="date" />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            labeled-progress-indicator
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Reusable labeled progress meter
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Backs the plan-progress header, the packing checklist, and the spend
            bar inside the budget card.
          </p>

          <div className="grid gap-10">
            <div>
              <div className="mb-4 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Plan-progress header (rotating states)
              </div>
              <LabeledProgressIndicator
                labels={[
                  "Move readiness 60%",
                  "Packing 8/20 boxes",
                  "Budget spent 72%",
                ]}
                progress="60%"
              />
            </div>

            <div>
              <div className="mb-4 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Budget card spend bar (static, success tone)
              </div>
              <LabeledProgressIndicator
                labels={["Budget spent 72%"]}
                progress="72%"
                tone="success"
                intervalMs={0}
              />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            task-widget-disclosure
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Expandable moving-plan task card
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Title is the move task, subtasks are the steps, assignees are family
            members, and Priority + Status track progress. Click a card to
            expand it and reveal the steps.
          </p>
          <div className="flex flex-col items-center gap-6">
            <TaskWidget data={INTERNET_TASK} />
            <TaskWidget data={UTILITIES_TASK} />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            filter-disclosure
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Collapsible list filters
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Tap the funnel to expand. Repurposed into LocateFlow filter groups:
            reminders by type, subscriptions by category, and providers by
            service area. Collapses to a single pill to save space on mobile.
          </p>
          <div className="flex flex-wrap items-start justify-around gap-10">
            <div className="flex flex-col items-center gap-3">
              <FilterDisclosure
                items={REMINDER_FILTERS}
                defaultActiveId="reminders"
              />
              <span className="text-xs font-medium text-muted-foreground">
                Reminders by type
              </span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <FilterDisclosure
                items={SUBSCRIPTION_FILTERS}
                defaultActiveId="streaming"
              />
              <span className="text-xs font-medium text-muted-foreground">
                Subscriptions by category
              </span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <FilterDisclosure
                items={PROVIDER_FILTERS}
                defaultActiveId="movers"
              />
              <span className="text-xs font-medium text-muted-foreground">
                Providers by service area
              </span>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            command-search
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Global ⌘K command palette
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Press ⌘K (or Ctrl+K) or click the field to open. Repurposed into
            LocateFlow navigation + quick actions: Add address, Add service, Open
            moving plan, View dossier, Set reminder, Invite family — grouped
            under Suggestions / Settings / Help.
          </p>
          <div className="flex min-h-[120px] items-start">
            <CommandSearch />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            save-toggle
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Save / bookmark button
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Click to animate idle → saving → saved (click again to reset).
            Repurposed as a save-provider / bookmark control and a form save
            button — sapphire pill while saving, success-green check on confirm.
          </p>
          <div className="flex flex-wrap items-center justify-around gap-6">
            <div className="flex flex-col items-center">
              <SaveToggle size="md" idleText="Save provider" savedText="Saved" />
              <span className="text-xs font-medium text-muted-foreground">
                Bookmark a provider
              </span>
            </div>
            <div className="flex flex-col items-center">
              <SaveToggle size="md" idleText="Save" savedText="Saved" />
              <span className="text-xs font-medium text-muted-foreground">
                Form save button
              </span>
            </div>
            <div className="flex flex-col items-center">
              <SaveToggle size="sm" idleText="Bookmark" savedText="Bookmarked" />
              <span className="text-xs font-medium text-muted-foreground">
                Bookmark a service (sm)
              </span>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            continuous-tabs
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Entity detail section tabs
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Animated sliding tabs for detail screens. The active sapphire pill
            slides between sections. Repurposed for provider detail
            (currently &ldquo;{providerTab}&rdquo;) and moving-plan detail
            (currently &ldquo;{moveTab}&rdquo;).
          </p>
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Provider detail
              </span>
              <ContinuousTabs
                tabs={PROVIDER_TABS}
                defaultActiveId="overview"
                onChange={setProviderTab}
              />
            </div>
            <div className="flex flex-col items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Moving-plan detail
              </span>
              <ContinuousTabs
                tabs={MOVE_TABS}
                defaultActiveId="plan"
                onChange={setMoveTab}
              />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            card-split-accordion
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Moving-checklist accordion
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Each row is a plan phase / task group (Before the move, Packing,
            Utilities, Address changes, After the move) that expands to its
            checklist details. The open row lifts out with rounded corners.
          </p>
          <div className="flex justify-center">
            <AccordionApp />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            inline-action
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Tap-to-confirm row control
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Compact confirm control for list rows. Tap the action to run idle →
            loading (sapphire bar) → success (brand success-green check, then
            auto-reset). Repurposed for reminders, bookings, and service
            transfers.
          </p>
          <div className="flex flex-col items-center gap-4">
            <InlineAction
              label="Pickup reminder"
              icon={<CalendarCheck className="size-5" />}
              actionText="Mark done"
              onAction={fakeConfirm}
            />
            <InlineAction
              label="Swift Movers Co."
              icon={<Truck className="size-5" />}
              actionText="Confirm booking"
              onAction={fakeConfirm}
            />
            <InlineAction
              label="Electricity transfer"
              icon={<PlugZap className="size-5" />}
              actionText="Mark transferred"
              onAction={fakeConfirm}
            />
            <InlineAction
              label="Leave a review"
              icon={<Star className="size-5" />}
              actionText="Submit"
              onAction={fakeConfirm}
            />
          </div>
        </section>

        {/* editable-chip · feature-tour · inline-table-control ----------- */}
        <EditableBatchSections />

        {/* subscription-calendar · transaction-list · activities-card ---- */}
        <BillingActivitySections />

        {/* switch-mode · file-upload-2 · notification-3 ------------------ */}
        <SwitchUploadNotifySections />

        {/* feedback-action · view-on-map · timed-undo-action ------------- */}
        <SyncMapUndoSections />

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            credit-usage-card → monthly budget card
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Dashboard monthly spend / budget card
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Repurposed from the AI-credit usage card. The credits ring is now a
            % of monthly-budget-spent bar, the day-range chips became This Month
            / Last Month / Quarter, and the usage table now lists this-month
            expense + subscription line items (Date / Service / Category /
            Amount). Export spend report, rollover toggle, and Manage budget CTA
            all run through the sapphire theme.
          </p>
          <div className="flex justify-center">
            <MonthlyBudgetCard
              spentPercent={56.4}
              monthlyBudgetLabel="$2,400 BUDGET"
              spentLabel="$1,354"
              remainingLabel="$1,046"
              lineItems={BUDGET_LINE_ITEMS}
            />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            integration-card → providers directory
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Providers / services marketplace + directory
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Repurposed from the app-marketplace grid into provider/service cards
            (logo, name, rating, Add service). The type filter maps to provider
            category (Movers / Utilities / Internet / Insurance), the use-case
            filter maps to move-stage (Pre-move / Move day / Post-move), the
            search box reads &ldquo;Search providers…&rdquo;, and the
            Marketplace/Internal/Third-party tabs became Recommended / My
            services / Local.
          </p>
          <div className="flex justify-center">
            <ProvidersDirectory
              title="Find providers for your move"
              items={PROVIDERS}
            />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="mb-12 rounded-xl border border-border bg-card p-8">
          <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
            profile-card → provider profile card
          </div>
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Provider / mover / service-contact profile
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            Repurposed from the company/lead profile. Website + Location +
            Categories are kept; the Monthly-visits / Heat-Score / ARR /
            Employees / Founders rows became provider-relevant facts (Rating,
            Avg quote, Response time, Service area, Years active, Contact). The
            header sparkline stays as a rating-trend line in success-green.
            Click the card to expand.
          </p>
          <div className="flex justify-center">
            <ProviderProfileCard
              name="Allied Van Lines"
              website="alliedvanlines.com"
              location="Austin, TX"
              serviceArea="Greater Austin, TX"
              categories={["Movers", "Storage", "Packing"]}
              rating={4.8}
              reviews={312}
              avgQuote="$1,200–$1,800"
              responseTime="~2 hrs"
              yearsActive="12 yrs"
              contact="(512) 555-0142"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
