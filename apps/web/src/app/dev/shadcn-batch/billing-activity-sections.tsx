"use client";

import {
  SubscriptionCalendar,
  type SubscriptionDay,
} from "@/components/ui/subscription-calendar";
import {
  TransactionList,
  type MoveCharge,
} from "@/components/ui/transaction-list";
import {
  ActivitiesCard,
  type ActivityItemType,
} from "@/components/ui/activities-card";
import {
  Truck,
  Wifi,
  Home,
  Zap,
  MapPin,
  CalendarCheck,
  Repeat,
  BellRing,
  Activity,
  ShieldCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Billing + activity batch — three more registry components re-themed
 * onto our sapphire (no-gold) tokens and repurposed to LocateFlow:
 *   - subscription-calendar  -> recurring services & billing calendar
 *   - transaction-list       -> this-month move expenses & charges
 *   - activities-card        -> recent move activity feed
 * Rendered inside the shared /dev/shadcn-batch preview (a .light wrapper).
 * Preview only — not wired into production.
 * ------------------------------------------------------------------ */

/* ---------- subscription-calendar sample data ---------- */
const SUBS_DOT = <span className="block h-1 w-1 rounded-full bg-primary" />;

const CALENDAR_DAYS: SubscriptionDay[] = Array.from({ length: 35 }, (_, i) => {
  // Grid opens on the last 2 muted days of the prior month.
  const date = i < 2 ? 29 + i : i - 1;
  const isMuted = i < 2 || date > 30;
  return { date, isMuted };
});
// Seed real renewals onto specific cells.
CALENDAR_DAYS[5] = { date: 4, dayTotal: 79.99, indicators: [SUBS_DOT] }; // Comcast Internet
CALENDAR_DAYS[10] = { date: 9, dayTotal: 15.49, indicators: [SUBS_DOT] }; // Netflix
CALENDAR_DAYS[16] = { date: 15, dayTotal: 220.0, indicators: [SUBS_DOT] }; // Renters insurance
CALENDAR_DAYS[23] = { date: 22, dayTotal: 9.99, indicators: [SUBS_DOT] }; // Cloud storage
CALENDAR_DAYS[29] = { date: 28, dayTotal: 120.0, indicators: [SUBS_DOT] }; // City utilities

/* ---------- transaction-list sample data ---------- */
const MOVE_CHARGES: MoveCharge[] = [
  {
    id: "mc-1",
    icon: <Truck size={18} />,
    name: "Two Men & a Truck",
    category: "Movers",
    amount: "-$1,250.00",
    date: "Jun 21, 2026",
    time: "9:42 AM",
    reference: "MV-48201",
    paymentMethod: "Visa Credit",
    cardNumber: "4417",
    cardType: "visa",
  },
  {
    id: "mc-2",
    icon: <Zap size={18} />,
    name: "City Power & Light",
    category: "Utility setup",
    amount: "-$85.00",
    date: "Jun 18, 2026",
    time: "2:10 PM",
    reference: "UT-90233",
    paymentMethod: "Mastercard",
    cardNumber: "2092",
    cardType: "mastercard",
  },
  {
    id: "mc-3",
    icon: <Wifi size={18} />,
    name: "Comcast Internet",
    category: "Subscription",
    amount: "-$79.99",
    date: "Jun 14, 2026",
    time: "12:01 AM",
    reference: "SB-11874",
    paymentMethod: "Visa Credit",
    cardNumber: "4417",
    cardType: "visa",
  },
  {
    id: "mc-4",
    icon: <Home size={18} />,
    name: "Old apt deposit refund",
    category: "Deposit return",
    amount: "+$1,400.00",
    isCredit: true,
    date: "Jun 09, 2026",
    time: "4:33 PM",
    reference: "DP-30119",
    paymentMethod: "ACH transfer",
    cardNumber: "6651",
    cardType: "ach",
  },
];

/* ---------- activities-card sample data ---------- */
const MOVE_ACTIVITIES: ActivityItemType[] = [
  {
    icon: <MapPin size={18} />,
    title: "Address updated",
    desc: "Sarah set the new home address",
    time: "2h ago",
  },
  {
    icon: <CalendarCheck size={18} />,
    title: "Mover confirmed",
    desc: "Two Men & a Truck — Jun 28, 8 AM",
    time: "Yesterday",
  },
  {
    icon: <Repeat size={18} />,
    title: "Subscription transferred",
    desc: "James moved Comcast to new address",
    time: "2d ago",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "Renters insurance bound",
    desc: "Policy active at the new address",
    time: "3d ago",
  },
  {
    icon: <BellRing size={18} />,
    title: "Reminder due",
    desc: "Schedule utility shutoff at old place",
    time: "4d ago",
  },
];

export function BillingActivitySections() {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          subscription-calendar
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Recurring services & billing calendar
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Each day shows that day&apos;s renewals; the add form is now
          &quot;Add Recurring Service&quot; and the per-day amounts roll up into
          Monthly Spend, which feeds the budget card.
        </p>
        <div className="flex justify-center py-2">
          <SubscriptionCalendar
            month="June"
            year={2026}
            days={CALENDAR_DAYS}
            monthlyTotal={425.46}
            subscriptionsCount={5}
            newCount={2}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          transaction-list
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          This-month move expenses & charges
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Movers, utility setup fees, subscription renewals, and deposit
          refunds. Credits render in success green; tap a row for the full
          charge detail with the motion expand.
        </p>
        <div className="flex justify-center py-2">
          <TransactionList charges={MOVE_CHARGES} />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          activities-card
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Recent move activity feed
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          A collapsible timeline of relocation events — address changes, mover
          confirmations, subscription transfers, and reminders — each with an
          icon, the family member who acted, and a timestamp. Click the card to
          expand.
        </p>
        <div className="flex justify-center py-2">
          <ActivitiesCard
            headerIcon={<Activity size={24} />}
            title="Move Activity"
            subtitle="5 updates this week"
            activities={MOVE_ACTIVITIES}
          />
        </div>
      </section>
    </>
  );
}
