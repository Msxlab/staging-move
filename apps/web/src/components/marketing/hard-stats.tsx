import { getTranslations } from "next-intl/server";

/**
 * Hard stats — the credibility play.
 * Three large attributed numbers that move the wound from "feels real"
 * to "is real". Each card cites a real public source. Don't add stats
 * here without an attributable source — unattributed numbers read as
 * marketing fluff and undermine the rest of the page.
 */
export async function HardStats() {
  const t = await getTranslations("landing");

  const stats = [
    { value: "$273", labelKey: "stat_subs_label", sourceKey: "stat_subs_source" },
    { value: "1 in 3", labelKey: "stat_movers_label", sourceKey: "stat_movers_source" },
    { value: "30M+", labelKey: "stat_households_label", sourceKey: "stat_households_source" },
  ] as const;

  return (
    <section className="container py-20 border-t">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {t("stats_eyebrow")}
        </div>
        <h2 className="mt-5 text-3xl md:text-4xl font-bold tracking-tight">
          {t("stats_title")}
        </h2>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.value}
            className="rounded-3xl border bg-card p-8 transition-all hover:border-primary/40 hover:shadow-lg"
          >
            <p className="text-5xl md:text-6xl font-extrabold tracking-tight tabular-nums leading-none text-primary">
              {s.value}
            </p>
            <p className="mt-5 text-sm md:text-base text-foreground/80 leading-relaxed">
              {t(s.labelKey as any)}
            </p>
            <p className="mt-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {t(s.sourceKey as any)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
