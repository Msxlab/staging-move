import { getTranslations } from "next-intl/server";

/**
 * Recognition / chip-storm — the visceral wound.
 * A scattered cloud of provider-name chips, each with the small
 * dread-tag that explains why it's a problem. The reader is meant
 * to recognize at least three of these before they finish reading.
 *
 * Color tone tracks severity: rose = bleeding money, amber =
 * silently auto-renewing, sky = a clock running down, gray = inert.
 */
export async function RecognitionChipStorm() {
  const t = await getTranslations("landing");

  // Provider names stay literal — they're brand strings.
  // Only the trailing "status" half is localized via t().
  const chips: { brand: string; statusKey: string; tone: "rose" | "amber" | "sky" | "gray"; left: string; top: string }[] = [
    { brand: "PG&E · $142.18", statusKey: "chip_status_past_due", tone: "rose", left: "1%", top: "8%" },
    { brand: "Verizon", statusKey: "chip_status_auto_renewing", tone: "amber", left: "28%", top: "4%" },
    { brand: "Comcast", statusKey: "chip_status_old_address", tone: "rose", left: "60%", top: "10%" },
    { brand: "USPS", statusKey: "chip_status_forwarding", tone: "sky", left: "4%", top: "36%" },
    { brand: "Netflix · $19.99", statusKey: "chip_status_charged", tone: "amber", left: "36%", top: "38%" },
    { brand: "Geico", statusKey: "chip_status_inert", tone: "gray", left: "70%", top: "40%" },
    { brand: "ClassPass", statusKey: "chip_status_unused", tone: "amber", left: "8%", top: "68%" },
    { brand: "AT&T", statusKey: "chip_status_disconnect_failed", tone: "rose", left: "38%", top: "72%" },
    { brand: "HOA", statusKey: "chip_status_inert", tone: "gray", left: "66%", top: "70%" },
    { brand: "Anytime Fitness", statusKey: "chip_status_unused", tone: "amber", left: "18%", top: "90%" },
    { brand: "City Water", statusKey: "chip_status_inert", tone: "gray", left: "50%", top: "92%" },
  ];

  const toneClasses: Record<typeof chips[number]["tone"], string> = {
    rose: "bg-rose-500/12 border-rose-500/30 text-rose-200",
    amber: "bg-amber-500/12 border-amber-500/30 text-amber-200",
    sky: "bg-sky-500/12 border-sky-500/30 text-sky-200",
    gray: "bg-foreground/5 border-foreground/15 text-foreground/70",
  };

  return (
    <section className="container py-20 border-t md:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t("recognition_eyebrow")}
        </div>
        <h2 className="mt-5 text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] max-w-[20ch]">
          {t("recognition_title_a")}{" "}
          <span className="text-primary">{t("recognition_title_b")}</span>
        </h2>
        <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-[52ch] leading-relaxed">
          {t("recognition_body")}
        </p>
      </div>

      {/* Chip cloud — desktop: absolute positioning. mobile: flex-wrap. */}
      <div className="mx-auto mt-12 max-w-5xl">
        <div className="relative hidden h-[360px] md:block">
          {chips.map((c) => (
            <div
              key={`${c.brand}-${c.left}-${c.top}`}
              className={`absolute whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-md ${toneClasses[c.tone]}`}
              style={{ left: c.left, top: c.top }}
            >
              {c.brand} · {t(c.statusKey as any)}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 md:hidden">
          {chips.map((c) => (
            <div
              key={`mobile-${c.brand}`}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${toneClasses[c.tone]}`}
            >
              {c.brand} · {t(c.statusKey as any)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
