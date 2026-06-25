"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Battery,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  HelpCircle,
  Home,
  Map,
  MapPin,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ModeKey = "rough" | "dream";
type TabKey = "home" | "moving" | "services" | "addresses" | "more";

type MobileMockupProps = {
  className?: string;
  variant?: "default" | "hero";
};

const modes: Record<
  ModeKey,
  {
    label: string;
    days: string;
    route: string;
    date: string;
    brief: string;
    risk: string;
    cost: string;
    homeScore: string;
  }
> = {
  rough: {
    label: "Rough home",
    days: "48",
    route: "Austin to New York",
    date: "Aug 12",
    brief: "Internet renewal and renters insurance need attention before your transfer window closes.",
    risk: "3 critical",
    cost: "$284/mo",
    homeScore: "Needs prep",
  },
  dream: {
    label: "Dream home",
    days: "21",
    route: "Seattle to Portland",
    date: "Jul 13",
    brief: "Utilities are ready, address changes are queued, and the home dossier looks clear.",
    risk: "All clear",
    cost: "$241/mo",
    homeScore: "Move-ready",
  },
};

const tabs: Array<{ key: TabKey; label: string; Icon: LucideIcon }> = [
  { key: "home", label: "Home", Icon: Home },
  { key: "moving", label: "Moving", Icon: Truck },
  { key: "services", label: "Services", Icon: Zap },
  { key: "addresses", label: "Addresses", Icon: MapPin },
  { key: "more", label: "More", Icon: MoreHorizontal },
];

const dossierCards = [
  { label: "Weather", value: "Mild", Icon: Gauge, tone: "text-info", bg: "bg-info/10" },
  { label: "Air", value: "Good", Icon: ShieldCheck, tone: "text-success", bg: "bg-success/10" },
  { label: "Water", value: "Checked", Icon: ClipboardCheck, tone: "text-primary", bg: "bg-primary/10" },
  { label: "Transit", value: "18 min", Icon: Map, tone: "text-info", bg: "bg-info/10" },
];

const services = [
  { label: "Electric", provider: "ConEd", status: "Transfer", due: "4 days", Icon: Zap },
  { label: "Internet", provider: "Spectrum", status: "Schedule", due: "12 days", Icon: Wifi },
  { label: "Renters", provider: "Lemonade", status: "Update", due: "Ready", Icon: ShieldCheck },
];

const moveSteps = [
  { label: "Old home", body: "Cancel or transfer old services", done: true },
  { label: "New home", body: "Connect utilities and internet", done: false },
  { label: "Paperwork", body: "Mail, DMV, bank and payroll", done: false },
];

function ModePills({
  active,
  onChange,
}: {
  active: ModeKey;
  onChange: (mode: ModeKey) => void;
}) {
  return (
    <div className="mb-4 inline-flex rounded-full border border-border bg-card p-1 shadow-lg">
      {(Object.keys(modes) as ModeKey[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
            active === key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {modes[key].label}
        </button>
      ))}
    </div>
  );
}

function StatusBar() {
  return (
    <div className="relative flex items-center justify-between px-6 pb-2 pt-3 text-[10px] font-semibold text-foreground/80">
      <span>9:41</span>
      <span className="absolute left-1/2 top-[7px] h-5 w-[88px] -translate-x-1/2 rounded-full bg-[#0b0b14] shadow-[inset_0_1px_2px_rgba(255,255,255,0.12)]" />
      <div className="flex items-center gap-1.5">
        <Wifi className="h-3 w-3" />
        <Battery className="h-3 w-3" />
      </div>
    </div>
  );
}

function AppHeader({ mode }: { mode: (typeof modes)[ModeKey] }) {
  return (
    <div className="px-5 pb-3 pt-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Good morning
          </p>
          <p className="mt-1 truncate font-display text-2xl font-black leading-none text-foreground">
            Liam Kutay
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{mode.route} - {mode.date}</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-primary/25 bg-primary/10 p-2 text-primary transition hover:bg-primary/15"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BriefingCard({ mode }: { mode: (typeof modes)[ModeKey] }) {
  return (
    <div className="rounded-[22px] border border-primary/20 bg-background/80 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary/10 p-2 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground">
              AI briefing
            </p>
            <p className="text-[10px] text-muted-foreground">Updated now</p>
          </div>
          <p className="mt-2 text-sm font-medium leading-5 text-foreground/90">{mode.brief}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{mode.days} days out</span>
        <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">{mode.risk}</span>
        <span className="rounded-full bg-success/10 px-2.5 py-1 text-success">{mode.homeScore}</span>
      </div>
    </div>
  );
}

function CountdownCard({ mode, reduce }: { mode: (typeof modes)[ModeKey]; reduce: boolean }) {
  return (
    <div className="rounded-[22px] border border-border/70 bg-background/80 p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Move countdown
        </p>
        <MapPin className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="font-display text-6xl font-black leading-none text-primary tabular-nums">
          {mode.days}
          <span className="ml-1 font-sans text-sm font-bold text-muted-foreground">days</span>
        </div>
        <div className="min-w-0 text-right text-[11px] font-medium text-muted-foreground">
          <p>{mode.route}</p>
          <p className="mt-1 text-foreground">{mode.date}</p>
          <p>{mode.cost}</p>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-primary/70"
          initial={false}
          animate={reduce ? undefined : { width: mode.days === "48" ? "42%" : "72%" }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          style={{ width: mode.days === "48" ? "42%" : "72%" }}
        />
      </div>
    </div>
  );
}

function HomeScreen({ mode, reduce }: { mode: (typeof modes)[ModeKey]; reduce: boolean }) {
  return (
    <div className="space-y-3">
      <BriefingCard mode={mode} />
      <CountdownCard mode={mode} reduce={reduce} />
      <div className="grid grid-cols-2 gap-2">
        {dossierCards.map(({ label, value, Icon, tone, bg }) => (
          <button
            key={label}
            type="button"
            className="rounded-2xl border border-border/70 bg-background/75 p-3 text-left transition hover:border-primary/30"
          >
            <div className={cn("mb-3 inline-flex rounded-xl p-2", bg, tone)}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 font-display text-xl font-black leading-none text-foreground">{value}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function MovingScreen() {
  return (
    <div className="space-y-3">
      <div className="rounded-[22px] border border-primary/20 bg-primary/10 p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          Next best action
        </p>
        <p className="mt-2 text-sm font-bold leading-5 text-foreground">
          Confirm your internet install window before the cancellation deadline.
        </p>
      </div>
      {moveSteps.map((step, index) => (
        <button
          key={step.label}
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-background/80 p-3 text-left transition hover:border-primary/30"
        >
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black",
              step.done ? "border-success/40 bg-success/15 text-success" : "border-primary/30 bg-primary/10 text-primary",
            )}
          >
            {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">{step.label}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{step.body}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function ServicesScreen() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        <span>Search services, providers, renewals</span>
      </div>
      {services.map(({ label, provider, status, due, Icon }) => (
        <button
          key={label}
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-background/80 p-3 text-left transition hover:border-primary/30"
        >
          <span className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-foreground">{label}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{provider} - {status}</span>
          </span>
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">{due}</span>
        </button>
      ))}
    </div>
  );
}

function AddressesScreen() {
  return (
    <div className="space-y-3">
      <div className="relative h-44 overflow-hidden rounded-[22px] border border-primary/25 bg-gradient-to-br from-card via-background to-card">
        <div className="absolute left-6 top-7 h-3 w-3 rounded-full border-2 border-success bg-background" />
        <div className="absolute bottom-8 right-7 h-3 w-3 rounded-full border-2 border-primary bg-background" />
        <div className="absolute left-9 top-11 h-28 w-[76%] rounded-[46%] border-t-2 border-dashed border-primary/70" />
        <div className="absolute left-3 top-3 rounded-full border border-border bg-background/80 px-3 py-1 text-[10px] font-bold text-success">
          Old home
        </div>
        <div className="absolute bottom-3 right-3 rounded-full border border-primary/25 bg-background/80 px-3 py-1 text-[10px] font-bold text-primary">
          New home
        </div>
      </div>
      {["Home", "Work", "Temporary stay"].map((label, index) => (
        <button
          key={label}
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-background/80 p-3 text-left"
        >
          <MapPin className={cn("h-4 w-4", index === 0 ? "text-success" : "text-primary")} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{label}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {index === 0 ? "Current address" : index === 1 ? "Payroll and mail" : "Short-term delivery"}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function MoreScreen() {
  const items = [
    { label: "Blog guides", Icon: FileText },
    { label: "Invite family", Icon: Users },
    { label: "Budget", Icon: CreditCard },
    { label: "Help", Icon: HelpCircle },
    { label: "Settings", Icon: Settings },
  ];

  return (
    <div className="space-y-2.5">
      {items.map(({ label, Icon }) => (
        <button
          key={label}
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-background/80 p-3 text-left transition hover:border-primary/30"
        >
          <span className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm font-bold text-foreground">{label}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function Screen({ tab, mode, reduce }: { tab: TabKey; mode: (typeof modes)[ModeKey]; reduce: boolean }) {
  if (tab === "moving") return <MovingScreen />;
  if (tab === "services") return <ServicesScreen />;
  if (tab === "addresses") return <AddressesScreen />;
  if (tab === "more") return <MoreScreen />;
  return <HomeScreen mode={mode} reduce={reduce} />;
}

export function MobileMockup({ className, variant = "default" }: MobileMockupProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const [modeKey, setModeKey] = React.useState<ModeKey>("rough");
  const [activeTab, setActiveTab] = React.useState<TabKey>("home");
  const mode = modes[modeKey];

  return (
    <div className={cn("relative mx-auto w-full max-w-[340px]", variant === "hero" && "max-w-[390px]", className)}>
      <div
        aria-hidden="true"
        className="absolute -inset-8 rounded-[64px] bg-gradient-to-br from-primary/25 via-transparent to-info/10 blur-3xl"
      />
      <motion.div
        className="relative"
        animate={reduceMotion || variant !== "hero" ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        {variant === "hero" ? (
          <div className="text-center">
            <ModePills active={modeKey} onChange={setModeKey} />
          </div>
        ) : null}

        <div className="relative rounded-[46px] border border-primary/25 bg-background p-2 shadow-2xl ring-1 ring-inset ring-white/10">
          <div className="relative overflow-hidden rounded-[38px] border border-border/70 bg-card after:pointer-events-none after:absolute after:inset-0 after:z-30 after:bg-gradient-to-br after:from-white/[0.07] after:via-transparent after:to-transparent after:content-['']">
            <StatusBar />
            <AppHeader mode={mode} />
            <motion.div
              key={`${activeTab}-${modeKey}`}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="h-[430px] overflow-hidden px-4 pb-4"
            >
              <Screen tab={activeTab} mode={mode} reduce={reduceMotion} />
            </motion.div>
            <div className="grid grid-cols-5 border-t border-border bg-card px-1 py-2.5">
              {tabs.map(({ key, label, Icon }) => {
                const active = key === activeTab;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-bold transition-colors",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60",
                    )}
                    aria-pressed={active}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
