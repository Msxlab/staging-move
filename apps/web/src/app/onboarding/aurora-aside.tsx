"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, Sparkles } from "lucide-react";
import { RaccoonHero } from "@/components/illustrations/RaccoonHero";
import { RaccoonReading } from "@/components/illustrations/RaccoonReading";

/**
 * Edition VII "Aurora" onboarding brand aside — the left panel of the ≥lg
 * split-screen wizard. Purely presentational: the wizard's step state drives
 * it, it never mutates anything.
 *
 *  - Aurora blobs reuse the marketing-hero `.aurora-blob` motion (globals.css
 *    already pauses them under prefers-reduced-motion).
 *  - Mascot swaps per step: RaccoonHero (profile/address), RaccoonReading
 *    (providers), and RaccoonHero with sparkle accents for the finish step —
 *    all token-themed, so the per-plan `--primary` and light/dark themes flow
 *    through automatically.
 *  - The display-serif quote uses the `.h1` helper so the italic <em> renders
 *    the cool gradient by decree (honey/foil stays reserved for Pro moments).
 *  - DELIBERATE deviation from the design prototype: there is NO plan-picker
 *    step in onboarding — billing stays post-onboarding. The footnote below
 *    the rail says so out loud.
 *
 * Hidden below lg: the existing wizard header + step chips remain the slim
 * mobile presentation.
 */
export function AuroraAside({ step }: { step: number }) {
  const t = useTranslations("onboarding");
  const em = { em: (chunks: ReactNode) => <em>{chunks}</em> };
  const stepLabels = [
    t("aurora_stepProfile"),
    t("aurora_stepAddress"),
    t("aurora_stepServices"),
    t("aurora_stepMoving"),
  ];

  const mascot =
    step === 2 ? (
      <RaccoonReading size={190} className="drop-shadow-2xl" />
    ) : step === 3 ? (
      <div className="relative">
        <RaccoonHero size={190} className="drop-shadow-2xl" />
        <Sparkles
          aria-hidden="true"
          className="absolute -right-6 -top-3 h-5 w-5 text-primary animate-pulse motion-reduce:animate-none"
        />
        <Sparkles
          aria-hidden="true"
          className="absolute -left-7 top-7 h-4 w-4 text-tone-emerald-fg animate-pulse motion-reduce:animate-none [animation-delay:300ms]"
        />
        <Sparkles
          aria-hidden="true"
          className="absolute -bottom-1 -right-10 h-4 w-4 text-tone-sky-fg animate-pulse motion-reduce:animate-none [animation-delay:600ms]"
        />
      </div>
    ) : (
      <RaccoonHero size={190} className="drop-shadow-2xl" />
    );

  return (
    <aside
      aria-label={t("aurora_eyebrow")}
      className="relative hidden min-h-[640px] overflow-hidden rounded-3xl border border-border bg-card p-8 lg:sticky lg:top-8 lg:flex lg:flex-col"
    >
      {/* Aurora wash — same blob convention as the marketing hero. */}
      <div
        aria-hidden="true"
        className="aurora-blob pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="aurora-blob-2 pointer-events-none absolute -bottom-32 -right-24 h-64 w-64 rounded-full bg-tone-sage-bg blur-3xl"
      />

      <div className="relative flex flex-1 flex-col">
        <p className="font-mono text-xs uppercase tracking-wider text-primary">
          {t("aurora_eyebrow")}
        </p>

        <div className="flex flex-1 items-center justify-center py-8">{mascot}</div>

        <p className="h1 text-3xl leading-[1.15]">{t.rich("aurora_quote", em)}</p>
        <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
          {t("aurora_quoteSub")}
        </p>

        <ol className="mt-7 space-y-2.5">
          {stepLabels.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li
                key={label}
                aria-current={current ? "step" : undefined}
                className={`flex items-center gap-3 text-sm transition-colors ${
                  current
                    ? "font-semibold text-foreground"
                    : done
                      ? "text-foreground/70"
                      : "text-muted-foreground"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold ${
                    done
                      ? "border-tone-emerald-br bg-tone-emerald-bg text-tone-emerald-fg"
                      : current
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-foreground/5 text-muted-foreground"
                  }`}
                >
                  {done ? <Check aria-hidden="true" className="h-3 w-3" /> : i + 1}
                </span>
                {label}
              </li>
            );
          })}
        </ol>

        {/* Owner-mandated honesty note: billing is deliberately NOT part of
            onboarding — no plan picker, no card. */}
        <p className="mt-7 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground/80">
          {t("aurora_noBilling")}
        </p>
      </div>
    </aside>
  );
}
