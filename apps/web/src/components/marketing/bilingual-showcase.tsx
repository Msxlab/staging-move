import { getTranslations } from "next-intl/server";

/**
 * Bilingual side-by-side — the wedge.
 * The page already serves both languages, but most readers won't notice
 * unless we *show* the parity. Two cards next to each other, one in EN
 * and one in ES, both literal regardless of which locale the rest of
 * the page is rendering in.
 *
 * The supporting copy explains the strategic bet: 62M Hispanic adults
 * relocate at 1.6× the general rate; bilingual is our wedge, not an
 * afterthought.
 */
export async function BilingualShowcase() {
  const t = await getTranslations("landing");

  return (
    <section className="container py-20 border-t md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:gap-16 md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider text-primary">
            {t("bili_eyebrow")}
          </div>
          <h2 className="mt-5 text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] max-w-[18ch]">
            In English. <span className="text-primary italic">En español.</span>
            <br />
            {t("bili_title_b")}
          </h2>
          <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-[44ch]">
            {t("bili_body")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border bg-card p-6">
            <p className="text-[10px] font-mono uppercase tracking-wider text-primary">EN</p>
            <h3 className="mt-2.5 text-xl font-bold leading-tight tracking-tight">
              Stop paying for things <span className="text-primary italic">you forgot about.</span>
            </h3>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              The average household spends $273/year on unused subscriptions. We surface them, you
              cancel them.
            </p>
          </article>

          <article className="rounded-2xl border bg-card p-6">
            <p className="text-[10px] font-mono uppercase tracking-wider text-primary">ES</p>
            <h3 className="mt-2.5 text-xl font-bold leading-tight tracking-tight">
              Deja de pagar por cosas <span className="text-primary italic">que olvidaste.</span>
            </h3>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              El hogar promedio gasta $273 al año en suscripciones sin usar. Las encontramos, tú
              las cancelas.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
