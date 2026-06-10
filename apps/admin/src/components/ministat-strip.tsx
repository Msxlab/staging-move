"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * MinistatStrip — Faz 3 corporate list-page stat row.
 *
 * A row of compact stat cards (tinted icon tile + mono value + optional
 * delta/sublabel) rendered above admin list views. Visuals live in
 * aurora.css under the `.au-mini` / `.au-ministat` classes and read only
 * the `--au-*` variable system, so the strip follows the slate-light /
 * aurora-dark themes automatically.
 *
 * Items with an `onClick` render as buttons (with `aria-pressed` when used
 * as a filter toggle) — this keeps the Subscriptions "stat card doubles as
 * a status filter" behavior intact.
 */

export type MinistatTone =
  | "cool"
  | "mint"
  | "family"
  | "amber"
  | "coral"
  | "slate";

/** Tone → CSS color. Always `--au-*` vars — never raw hex in components. */
export const MINISTAT_TONE_COLOR: Record<MinistatTone, string> = {
  cool: "var(--au-cool-2)",
  mint: "var(--au-mint)",
  family: "var(--au-family)",
  amber: "var(--au-amber)",
  coral: "var(--au-coral)",
  slate: "var(--au-ink-3)",
};

export interface MinistatItem {
  /** Stable key for the card. */
  key: string;
  icon: LucideIcon;
  /** Mono uppercase label. Keep short — it truncates at narrow widths. */
  label: string;
  /** The big mono value. */
  value: ReactNode;
  /** Pre-formatted delta, e.g. "+6.2%". */
  delta?: string;
  /** Color sense of the delta: "up" = positive (green), "down" = negative. */
  deltaDir?: "up" | "down";
  /** Faint sublabel after the delta (or alone). */
  sub?: string;
  tone?: MinistatTone;
  /** When set the card renders as a button (e.g. a status-filter toggle). */
  onClick?: () => void;
  /** Pressed/filter state for clickable cards. */
  active?: boolean;
  /** Tooltip. */
  title?: string;
}

export function MinistatStrip({
  items,
  columns,
  className,
}: {
  items: MinistatItem[];
  /** Grid column count — defaults to the number of items (one row). */
  columns?: number;
  className?: string;
}) {
  if (items.length === 0) return null;
  const cols = columns ?? items.length;
  return (
    <div
      className={cn("au-mini", cols >= 5 && "au-mini--wrap", className)}
      style={{ "--mini-cols": cols } as CSSProperties}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const style = {
          "--c": MINISTAT_TONE_COLOR[item.tone ?? "cool"],
        } as CSSProperties;
        const body = (
          <>
            <div className="kr">
              <span className="ti">
                <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
              </span>
              <span className="k">{item.label}</span>
            </div>
            <div className="v">{item.value}</div>
            {item.delta || item.sub ? (
              <div
                className={cn(
                  "d",
                  item.delta && (item.deltaDir === "down" ? "down" : "up"),
                )}
              >
                {item.delta}
                {item.sub ? <span>{item.delta ? " " : ""}{item.sub}</span> : null}
              </div>
            ) : null}
          </>
        );
        if (item.onClick) {
          return (
            <button
              key={item.key}
              type="button"
              className={cn("au-ministat", item.active && "on")}
              style={style}
              onClick={item.onClick}
              aria-pressed={Boolean(item.active)}
              title={item.title}
            >
              {body}
            </button>
          );
        }
        return (
          <div
            key={item.key}
            className="au-ministat"
            style={style}
            title={item.title}
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}
