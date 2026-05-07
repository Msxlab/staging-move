"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { Ring } from "./ring";
import { useCountUp } from "./use-count-up";
import { useReflex } from "./use-reflex";

type Format = "int" | "currency" | "currency2" | "pct" | "k" | "raw";

interface AuroraStatCardProps {
  /** Small uppercase label above the value. */
  label: string;
  /** Numeric value — animated in via count-up unless `formatted` is supplied. */
  value: number;
  /** When set, displayed instead of formatting `value` — for pre-formatted strings. */
  formatted?: string;
  format?: Format;
  /** Tiny secondary line under the value. */
  sub?: string;
  /** Delta line ("+12%", "-3.2pp", etc). */
  delta?: string;
  deltaDir?: "up" | "down";
  /** When set, renders a small percentage ring in the corner. */
  ring?: number;
  /** Optional icon shown on the right. */
  icon?: LucideIcon;
  /** Optional href turns the card into a link. */
  href?: string;
}

function fmt(v: number, kind: Format): string {
  if (kind === "currency")
    return "$" + Math.round(v).toLocaleString("en-US");
  if (kind === "currency2")
    return (
      "$" +
      v.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  if (kind === "pct") return v.toFixed(1) + "%";
  if (kind === "k") {
    if (v >= 1000) return (v / 1000).toFixed(1) + "k";
    return Math.round(v).toString();
  }
  if (kind === "raw") return String(v);
  return Math.round(v).toLocaleString("en-US");
}

/**
 * Glass KPI card with reflex highlight + count-up. The structural style
 * comes from the `.au-card` selector in aurora.css; this component owns
 * the slot layout and animations.
 */
export function AuroraStatCard({
  label,
  value,
  formatted,
  format = "int",
  sub,
  delta,
  deltaDir,
  ring,
  icon: Icon,
  href,
}: AuroraStatCardProps) {
  const ref = useReflex<HTMLDivElement>();
  const v = useCountUp(value);
  const pos = deltaDir === "up";

  const inner = (
    <div ref={ref} className="au-card au-card--reflex" style={{ padding: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className="au-eyebrow">{label}</span>
        {ring != null ? (
          <Ring pct={ring} />
        ) : Icon ? (
          <Icon
            className="h-5 w-5"
            style={{ color: "var(--au-cool)" }}
            aria-hidden
          />
        ) : null}
      </div>
      <div
        className="au-num"
        style={{
          font: "600 28px/1.05 var(--font-sans, system-ui, sans-serif)",
          letterSpacing: "-0.02em",
          marginTop: 14,
          color: "var(--au-ink)",
        }}
      >
        {formatted ?? fmt(v, format)}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 8,
        }}
      >
        {delta != null && (
          <span
            className="au-num"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              font:
                "500 11px/1 var(--font-mono, ui-monospace, monospace)",
              color: pos ? "var(--au-mint)" : "var(--au-coral)",
            }}
          >
            {pos ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {delta}
          </span>
        )}
        {sub && (
          <span
            style={{
              font: "400 12px/1 var(--font-sans, system-ui, sans-serif)",
              color: "var(--au-ink-3)",
            }}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
