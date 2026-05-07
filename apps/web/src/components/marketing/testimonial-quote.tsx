import { getTranslations } from "next-intl/server";

/**
 * Testimonial â€” the social proof + emotional landing.
 * One large pull-quote describing the *feeling* after using the app.
 * Sits right before the pricing/CTA so the reader's last impression
 * before deciding is what someone like them said about the relief.
 */
export async function TestimonialQuote() {
  const t = await getTranslations("landing");

  return (
    <section className="relative overflow-hidden border-t py-24 md:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-tone-honey-fg/[0.06] blur-3xl"
      />
      <div className="container relative">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {t("quote_eyebrow")}
          </p>
          <blockquote className="mt-8 text-2xl md:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight">
            <span className="block">
              {t("quote_a")}{" "}
              <span className="text-primary italic">{t("quote_accent")}</span>{" "}
              {t("quote_b")}
            </span>
          </blockquote>
          <p className="mt-10 text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground">
            {t("quote_attribution")}
          </p>
        </div>
      </div>
    </section>
  );
}
