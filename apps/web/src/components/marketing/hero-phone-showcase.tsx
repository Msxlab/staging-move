"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  Home,
  MapPin,
  ShieldCheck,
  Sparkles,
  Truck,
  Wifi,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATES = [
  {
    key: "rough",
    label: "Current home",
    name: "Alex Rivera",
    days: "48",
    from: "Austin, TX",
    to: "Denver, CO",
    date: "Aug 12, 2026",
    next: "AT&T internet expires Jul 28",
    risk: "3 critical",
  },
  {
    key: "dream",
    label: "Dream home",
    name: "Maya Chen",
    days: "21",
    from: "Seattle, WA",
    to: "Portland, OR",
    date: "Jul 13, 2026",
    next: "Utilities ready before arrival",
    risk: "all clear",
  },
] as const;

const services = [
  { label: "Electric", Icon: Zap, status: "transfer", done: true },
  { label: "Internet", Icon: Wifi, status: "schedule", done: false },
  { label: "Insurance", Icon: ShieldCheck, status: "update", done: true },
] as const;

export function HeroPhoneShowcase({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [active, setActive] = React.useState(0);
  const state = STATES[active];

  React.useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setActive((value) => (value + 1) % STATES.length);
    }, 3600);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div aria-hidden="true" className={cn("relative mx-auto w-full max-w-[520px]", className)}>
      <motion.div
        className="relative mx-auto w-full max-w-[390px]"
        animate={reduce ? undefined : { y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute -inset-8 rounded-[64px] bg-primary/20 blur-3xl" />
        <div className="absolute -right-8 top-10 h-28 w-28 rounded-full bg-success/15 blur-2xl" />

        <div className="relative mb-4 ml-auto flex w-fit rounded-full border border-primary/20 bg-card/80 p-1 shadow-xl backdrop-blur">
          {STATES.map((item, index) => (
            <div
              key={item.key}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                index === active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="relative rounded-[46px] border border-primary/25 bg-background p-2 shadow-2xl">
          <div className="overflow-hidden rounded-[38px] border border-border/70 bg-card">
            <div className="relative flex items-center justify-between px-6 pb-2 pt-3 text-[10px] font-semibold text-foreground/80">
              <span>9:41</span>
              <span className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-background" />
              <div className="flex items-center gap-2">
                <Wifi className="h-3 w-3" />
                <Bell className="h-3 w-3" />
              </div>
            </div>

            <motion.div
              key={state.key}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="px-5 pb-5 pt-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                    Good morning
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold leading-none text-foreground">
                    {state.name}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Monday, June 22</p>
                </div>
                <div className="rounded-full border border-primary/25 bg-primary/10 p-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-primary/20 bg-background/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                    <Home className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
                        AI briefing
                      </p>
                      <p className="text-[10px] text-muted-foreground">Updated now</p>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-5 text-foreground">
                      Route looks good. {state.next}. Costs run close to your target for {state.to}.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{state.days} days out</span>
                  <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning">{state.risk}</span>
                  <span className="rounded-full bg-success/10 px-2.5 py-1 text-success">{state.to}</span>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Moving countdown
                  </p>
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div className="font-display text-6xl font-bold leading-none text-primary tabular-nums">
                    {state.days}
                    <span className="ml-1 font-sans text-sm font-semibold text-muted-foreground">days</span>
                  </div>
                  <div className="min-w-0 text-right text-[11px] font-medium text-muted-foreground">
                    <p>{state.from}</p>
                    <p className="mt-1 text-foreground">{state.to}</p>
                    <p>{state.date}</p>
                  </div>
                </div>
                <svg className="mt-4 h-16 w-full overflow-visible" viewBox="0 0 320 72" fill="none">
                  <motion.path
                    d="M18 56 C84 10 142 70 198 30 C240 0 272 24 306 10"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="9 9"
                    animate={reduce ? undefined : { strokeDashoffset: [0, -36] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                  <circle cx="18" cy="56" r="6" fill="hsl(var(--primary))" />
                  <circle cx="306" cy="10" r="6" fill="var(--sage)" />
                </svg>
              </div>

              <div className="mt-5 space-y-2">
                {services.map(({ label, Icon, status, done }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/80 px-3 py-2.5"
                  >
                    <span className="rounded-xl bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{status}</p>
                    </div>
                    <CheckCircle2 className={cn("h-4 w-4", done ? "text-success" : "text-muted-foreground/50")} />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        <motion.div
          className="absolute -right-12 bottom-20 hidden rounded-2xl border border-primary/20 bg-card/90 px-4 py-3 shadow-xl backdrop-blur sm:block"
          animate={reduce ? undefined : { y: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Truck className="h-4 w-4 text-primary" />
            Every account tracked
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default HeroPhoneShowcase;
