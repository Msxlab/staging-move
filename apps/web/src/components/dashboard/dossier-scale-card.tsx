"use client";

import { useTranslations } from "next-intl";
import type { DossierScaleResult } from "@locateflow/shared";
import { DossierLottieStage } from "./dossier-lottie-stage";

/**
 * DOSSIER SCALE CARD — the Blend card: a Lottie character stage + a clear data
 * number/chip + a uniform 5-segment scale + the narration line + the source
 * caveat. Consumes a `DossierScaleResult` from `scoreFor*` in @locateflow/shared.
 * The narration line is the accessible description (role="img" aria-label).
 *
 * Level colour reuses existing dark-safe tone/semantic tokens so the card works
 * in light and dark without hardcoded brand colour.
 */

const LEVEL_COLOR: Record<number, string> = {
  1: "var(--tone-sage-fg)",
  2: "var(--tone-honey-fg)",
  3: "var(--tone-orange-fg)",
  4: "var(--danger)",
  5: "var(--danger)",
};

export function DossierScaleCard({
  result,
  title,
  lottieData = null,
  segment,
}: {
  result: DossierScaleResult;
  title: string;
  lottieData?: unknown | null;
  segment?: [number, number];
}) {
  const t = useTranslations("dashboard");
  const narration = t(result.narrationKey);
  const caveat = t(result.caveatKey);
  const color = result.available ? (LEVEL_COLOR[result.level] ?? "var(--muted-foreground)") : "var(--muted-foreground)";

  return (
    <div
      role="img"
      aria-label={`${title}: ${result.bandLabel}. ${narration}`}
      className="overflow-hidden rounded-2xl border border-border bg-foreground/5"
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{title}</span>
      </div>
      <div className="px-4 pt-1">
        <DossierLottieStage data={lottieData} segment={segment} height={84} />
      </div>
      <div className="px-4 pb-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-foreground">{result.displayValue}</span>
          <span className="text-xs font-medium" style={{ color }}>
            {result.bandLabel}
          </span>
        </div>
        <div className="mt-1.5 flex gap-1" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              data-active={result.available && i <= result.level ? "true" : "false"}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: result.available && i <= result.level ? color : "var(--surface-3)" }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{narration}</p>
        <p className="mt-1 text-[10px] text-muted-foreground/80">{caveat}</p>
      </div>
    </div>
  );
}
