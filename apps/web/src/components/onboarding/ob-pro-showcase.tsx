"use client";

import type { ReactNode } from "react";
import { Sparkles, Truck, Home, GraduationCap, FileText, Bot } from "lucide-react";
import { ObCta } from "./ob-cta";

/**
 * Onboarding Pro showcase — neighborhood-pro-wave.
 *
 * A final-moment, aspirational "what Pro unlocks for YOUR move" card shown at
 * the END of onboarding (Step 3, once the user has entered an origin +
 * destination move), BEFORE the finish CTA. It is a SHOWCASE, not a paywall:
 *  - copy is personalized from the user's REAL entered context (origin →
 *    destination state + household) so the value is concrete, not generic;
 *  - the only outbound action is a quiet "See Pro" ghost link to /pricing —
 *    there is NO plan-purchase / payment step in onboarding (owner decision);
 *  - the page's existing primary "Finish setup" CTA stays untouched below.
 *
 * The card is purely presentational. All motion (the staggered feature-row
 * reveal) lives in globals.css under the onboarding section and is gated by
 * prefers-reduced-motion; with reduced motion the rows simply appear.
 */

/** A household signal we can name a concrete Pro benefit around. Real data only. */
export interface ProShowcaseContext {
  /** Origin state code from the user's primary address (Step 1). */
  fromState: string | null;
  /** Destination state code being entered on Step 3. */
  toState: string | null;
  hasChildren: boolean;
  hasPets: boolean;
}

/** Stable identifiers for each Pro value row — drives copy keys + icons. */
export type ProShowcaseFeatureId = "movers" | "neighborhood" | "schools" | "dossier" | "ai";

export interface ProShowcaseFeature {
  id: ProShowcaseFeatureId;
}

/**
 * Pick which concrete Pro value rows to surface for this move. Pure + sorted by
 * a fixed priority so the list is deterministic (and the colocated test can
 * assert it). "schools" only appears when the household actually has children —
 * we never name a benefit the user can't use. The remaining rows are universal
 * to a move, so they always show. Capped so the card stays a glanceable teaser.
 */
export function selectProShowcaseFeatures(
  ctx: ProShowcaseContext,
  max = 4,
): ProShowcaseFeature[] {
  const ordered: ProShowcaseFeatureId[] = ["movers", "neighborhood"];
  if (ctx.hasChildren) ordered.push("schools");
  ordered.push("dossier", "ai");
  return ordered.slice(0, Math.max(1, max)).map((id) => ({ id }));
}

/**
 * True when we have enough REAL context to make the showcase concrete. Without
 * at least a destination state the personalized headline would be generic, so
 * the page can choose to skip rendering entirely.
 */
export function hasProShowcaseContext(ctx: ProShowcaseContext): boolean {
  return Boolean(ctx.toState && ctx.toState.trim());
}

const FEATURE_ICON: Record<ProShowcaseFeatureId, typeof Truck> = {
  movers: Truck,
  neighborhood: Home,
  schools: GraduationCap,
  dossier: FileText,
  ai: Bot,
};

export interface ObProShowcaseProps {
  /** Mono eyebrow, e.g. "With Pro". */
  eyebrow: string;
  /** Personalized headline embedding the origin → destination move. */
  headline: ReactNode;
  /** Ordered Pro value rows (from selectProShowcaseFeatures). */
  features: ProShowcaseFeature[];
  /** Localized label for each feature row, keyed by feature id. */
  featureLabel: (id: ProShowcaseFeatureId) => ReactNode;
  /** "It's a showcase, not a paywall" reassurance line. */
  footnote: ReactNode;
  /** Label for the quiet ghost link to /pricing. */
  seeProLabel: ReactNode;
  /** Click handler for the See Pro link (deep-links to /pricing). */
  onSeePro: () => void;
  className?: string;
}

export function ObProShowcase({
  eyebrow,
  headline,
  features,
  featureLabel,
  footnote,
  seeProLabel,
  onSeePro,
  className = "",
}: ObProShowcaseProps) {
  return (
    <div
      className={`ob-pro-showcase relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-foreground/[0.03] to-transparent p-5 ${className}`}
    >
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">
          {eyebrow}
        </p>
      </div>

      <h3 className="mt-2 text-base font-semibold leading-snug text-foreground">
        {headline}
      </h3>

      <ul className="mt-4 space-y-2">
        {features.map((feature, i) => {
          const Icon = FEATURE_ICON[feature.id];
          return (
            <li
              key={feature.id}
              className="ob-pro-showcase-row flex items-center gap-3"
              style={{ ["--ob-pro-i" as string]: String(i) }}
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[13px] leading-snug text-muted-foreground">
                {featureLabel(feature.id)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] leading-relaxed text-foreground/45">{footnote}</p>
        <ObCta
          variant="skip"
          onClick={onSeePro}
          className="shrink-0"
          aria-label={typeof seeProLabel === "string" ? seeProLabel : undefined}
        >
          {seeProLabel}
        </ObCta>
      </div>
    </div>
  );
}
