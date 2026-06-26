"use client";

import { useState } from "react";
import { Wallet, CalendarClock, Truck, Users, MapPin } from "lucide-react";

import { EditableChip } from "@/components/ui/editable-chip";
import { FeatureTour, type TourStep } from "@/components/ui/feature-tour";
import {
  InlineTableControl,
  type TableItem,
} from "@/components/ui/inline-table-control";

/* ──────────────────────────────────────────────────────────────────────────
   Preview sections for the third batch of re-themed shadcn components:
   editable-chip, feature-tour, inline-table-control. Each is re-themed onto
   our sapphire (no-gold) tokens and repurposed to its LocateFlow use-case.
   Kept in a child module so the shared /dev/shadcn-batch page can compose it
   alongside the other batches without merge churn.
─────────────────────────────────────────────────────────────────────────── */

/* editable-chip — inline-editable address / service / family labels */
const ADDRESS_LABELS = ["Home", "Office", "Storage unit"];
const SERVICE_LABELS = ["Streaming", "Utilities", "Insurance"];
const FAMILY_LABELS = ["Mom", "Partner", "Roommate"];

/* feature-tour — LocateFlow dashboard walkthrough steps */
const TOUR_STEPS: TourStep[] = [
  {
    id: "monthly-spend",
    title: "Monthly Spend",
    description:
      "See every recurring charge in one place and track your budget for the month at a glance.",
    icon: <Wallet size={56} strokeWidth={1.6} />,
    target: "#monthly-spend-card",
  },
  {
    id: "subscriptions",
    title: "Subscriptions calendar",
    description:
      "Know exactly when each subscription renews so a charge never catches you off guard.",
    icon: <CalendarClock size={56} strokeWidth={1.6} />,
    target: "#subscriptions-calendar",
  },
  {
    id: "moving-plan",
    title: "Your moving plan",
    description:
      "A step-by-step checklist that keeps your move on schedule from packing to keys.",
    icon: <Truck size={56} strokeWidth={1.6} />,
    target: "#moving-plan",
  },
  {
    id: "providers",
    title: "Providers",
    description:
      "Compare internet, utility, and insurance providers available at your new address.",
    icon: <MapPin size={56} strokeWidth={1.6} />,
    target: "#providers",
  },
  {
    id: "family-sharing",
    title: "Family sharing",
    description:
      "Invite household members so everyone stays in sync on the move and shared bills.",
    icon: <Users size={56} strokeWidth={1.6} />,
    target: "#family-sharing",
  },
];

/* inline-table-control — subscriptions / services line-items */
const SUBSCRIPTIONS: TableItem[] = [
  { id: "1", service: "Netflix", amount: "15.99", renewal: "Jul 14", category: "Streaming" },
  { id: "2", service: "Spotify", amount: "10.99", renewal: "Jul 03", category: "Streaming" },
  { id: "3", service: "City Power & Light", amount: "84.20", renewal: "Jul 28", category: "Utilities" },
  { id: "4", service: "Fiber Internet", amount: "59.00", renewal: "Jul 09", category: "Utilities" },
  { id: "5", service: "Renters Insurance", amount: "22.50", renewal: "Aug 01", category: "Insurance" },
];

/* inline-table-control (second instance) — editable addresses table */
const ADDRESSES: TableItem[] = [
  { id: "a1", service: "Home", amount: "—", renewal: "Current", category: "Primary" },
  { id: "a2", service: "Old apartment", amount: "—", renewal: "Until Jul 31", category: "Moving out" },
  { id: "a3", service: "Storage unit", amount: "—", renewal: "Monthly", category: "Storage" },
];

export function EditableBatchSections() {
  const [tourOpen, setTourOpen] = useState(true);

  return (
    <>
      {/* ── editable-chip ───────────────────────────────────────────── */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          editable-chip
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Inline-editable labels
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Rename addresses, tag services by category, or label family members.
          Click the pencil, edit, then commit on Enter or the confirm button.
          The chip surface, focus ring, and confirm button all resolve through
          the sapphire theme.
        </p>
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Address nicknames
            </p>
            <div className="flex flex-wrap gap-3">
              {ADDRESS_LABELS.map((label) => (
                <EditableChip key={label} defaultLabel={label} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Service categories
            </p>
            <div className="flex flex-wrap gap-3">
              {SERVICE_LABELS.map((label) => (
                <EditableChip key={label} defaultLabel={label} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Family members
            </p>
            <div className="flex flex-wrap gap-3">
              {FAMILY_LABELS.map((label) => (
                <EditableChip key={label} defaultLabel={label} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── feature-tour ────────────────────────────────────────────── */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          feature-tour
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          First-run dashboard walkthrough
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          A guided tour over the real dashboard targets (Monthly Spend,
          Subscriptions calendar, Moving plan, Providers, Family sharing).
          Keyboard nav is wired: ArrowRight / ArrowLeft to move, Escape to
          close. The card, icon chip, dots, and CTA all use sapphire tokens.
        </p>
        {tourOpen ? (
          <div className="flex justify-center">
            <FeatureTour
              steps={TOUR_STEPS}
              onClose={() => setTourOpen(false)}
              onLearnMore={(step) => console.log("learn more:", step.id)}
              loop
            />
          </div>
        ) : (
          <button
            onClick={() => setTourOpen(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Restart tour
          </button>
        )}
      </section>

      {/* ── inline-table-control: subscriptions ─────────────────────── */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          inline-table-control
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Subscriptions &amp; services table
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          An inline-editable table for recurring services: service name, amount,
          renewal date, and category. Click the pencil on a row to edit names
          and amounts in place, then Done to commit. Surfaces, borders, focus
          ring, and the primary action all use sapphire tokens.
        </p>
        <div className="rounded-2xl border border-border bg-card/30">
          <InlineTableControl
            data={SUBSCRIPTIONS}
            onUpdate={(item) => console.log("subscription updated:", item)}
          />
        </div>
      </section>

      {/* ── inline-table-control: addresses (same control) ──────────── */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          inline-table-control
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Addresses table (same control)
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          The same inline-editable control backing an addresses table: nickname,
          status, and type. Demonstrates the component repurposed for a second
          LocateFlow data set.
        </p>
        <div className="rounded-2xl border border-border bg-card/30">
          <InlineTableControl
            data={ADDRESSES}
            onUpdate={(item) => console.log("address updated:", item)}
          />
        </div>
      </section>
    </>
  );
}
