import { getTranslations } from "next-intl/server";

/**
 * Recognition / chip-storm — the visceral wound.
 *
 * Three rows of provider chips (4 / 3 / 4) flex-laid so they stay
 * visible at every viewport. Each chip carries a tiny dread-tag
 * ("past due", "auto-renewing", "old address") and a static rotation
 * that keeps the cluster feeling scattered rather than spreadsheet-y.
 *
 * Color tone tracks severity, mapped to the site palette so the chips
 * actually render (the previous build used arbitrary alpha values
 * like `/12` that some Tailwind builds dropped, leaving most chips
 * invisible against a dark canvas):
 *   - rose  = bleeding money / past due
 *   - honey = silently auto-renewing / unused
 *   - slate = a clock running down (forwarding)
 *   - foil  = inert / quietly active
 */
export async function RecognitionChipStorm() {
  const t = await getTranslations("landing");

  type Tone = "rose" | "honey" | "slate" | "foil";
  interface Chip {
    brand: string;
    statusKey: string;
    tone: Tone;
    /** Static -3°..+3° tilt so the cluster reads as scattered, not gridded. */
    tilt: number;
  }

  // Provider names stay literal — they're brand strings.
  // Only the trailing "status" half is localized via t().
  // The visual order matters: severity tones (rose) sprinkled across
  // all three rows so the eye finds at least one wound per band.
  const rowOne: Chip[] = [
    { brand: "PG&E · $142.18", statusKey: "chip_status_past_due", tone: "rose", tilt: -2 },
    { brand: "Verizon", statusKey: "chip_status_auto_renewing", tone: "honey", tilt: 1 },
    { brand: "Comcast", statusKey: "chip_status_old_address", tone: "rose", tilt: -1 },
    { brand: "USPS", statusKey: "chip_status_forwarding", tone: "slate", tilt: 2 },
  ];
  const rowTwo: Chip[] = [
    { brand: "Netflix · $19.99", statusKey: "chip_status_charged", tone: "honey", tilt: -1 },
    { brand: "AT&T", statusKey: "chip_status_disconnect_failed", tone: "rose", tilt: 2 },
    { brand: "Geico", statusKey: "chip_status_inert", tone: "foil", tilt: -2 },
  ];
  const rowThree: Chip[] = [
    { brand: "ClassPass", statusKey: "chip_status_unused", tone: "honey", tilt: 1 },
    { brand: "Anytime Fitness", statusKey: "chip_status_unused", tone: "honey", tilt: -2 },
    { brand: "HOA", statusKey: "chip_status_inert", tone: "foil", tilt: 1 },
    { brand: "City Water", statusKey: "chip_status_inert", tone: "foil", tilt: -1 },
  ];

  // Each tone maps to a tonal pair from the Edition VI palette
  // (defined in globals.css as `--tone-*-bg/br/fg` triples). Solid
  // backgrounds + opaque foreground guarantees readability in both
  // light and dark modes — the previous `bg-rose-500/12` arbitrary
  // alpha quietly dropped on some builds and left chips ghostlike.
  const toneClasses: Record<Tone, string> = {
    rose: "bg-tone-rose-bg border-tone-rose-br text-tone-rose-fg",
    honey: "bg-tone-honey-bg border-tone-honey-br text-tone-honey-fg",
    slate: "bg-tone-slate-bg border-tone-slate-br text-tone-slate-fg",
    foil: "bg-tone-foil-bg border-tone-foil-br text-tone-foil-fg",
  };

  function renderRow(row: Chip[], extraClass = "") {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-3 sm:gap-4 ${extraClass}`}>
        {row.map((c) => (
          <div
            key={`${c.brand}-${c.statusKey}`}
            style={{ transform: `rotate(${c.tilt}deg)` }}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium shadow-sm backdrop-blur transition hover:translate-y-[-1px] hover:shadow-md sm:text-[15px] ${toneClasses[c.tone]}`}
          >
            <span className="font-semibold">{c.brand}</span>
            <span className="px-1.5 opacity-60" aria-hidden="true">·</span>
            <span className="opacity-90">{t(c.statusKey as any)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="container py-20 border-t md:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t("recognition_eyebrow")}
        </div>
        <h2 className="mt-5 font-display text-3xl font-bold leading-[1.05] tracking-tight md:text-5xl">
          {t("recognition_title_a")}{" "}
          <span className="italic text-primary">{t("recognition_title_b")}</span>
        </h2>
        <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-muted-foreground md:text-lg">
          {t("recognition_body")}
        </p>
      </div>

      {/* Chip cloud — three rows, flex-wrap, never clips and never collapses */}
      <div className="relative mx-auto mt-14 flex max-w-5xl flex-col gap-6 sm:gap-8">
        {/* Soft ambient glow behind the cluster — purely decorative */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.08),transparent_65%)]"
        />
        {renderRow(rowOne)}
        {renderRow(rowTwo, "sm:-mx-6")}
        {renderRow(rowThree)}
      </div>
    </section>
  );
}
