"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";

const OPTIONS: Array<{ value: "system" | "light" | "dark"; label: string; icon: LucideIcon }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function AppearanceCard() {
  const { preference, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = mounted ? preference : "system";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider">Appearance</h2>
      </div>
      <div className="px-5 pb-5 space-y-3">
        <p className="text-xs text-white/40">Choose how LocateFlow looks. System matches your device setting.</p>
        <div
          role="radiogroup"
          aria-label="Theme preference"
          className="grid grid-cols-3 gap-2"
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = active === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 py-3 px-2 rounded-xl border transition ${
                  selected
                    ? "border-orange-500/60 bg-orange-500/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
