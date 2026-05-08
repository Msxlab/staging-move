import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";

/**
 * Moving-moment checklist mock — the relief reveal.
 * After the chip storm + hard stats have made the chaos feel real,
 * this section is the first taste of what calm looks like.
 *
 * Visually it's a single move-day checklist: 11 tasks, 6 done, the
 * progress bar mid-fill. Three concrete badges (Transfer / Cancel /
 * Update) hint at the state machine without explaining it.
 */
export async function MovingMomentMock() {
  const t = await getTranslations("landing");

  const items: { name: string; action: "transfer" | "cancel" | "update"; done: boolean }[] = [
    { name: "PG&E", action: "transfer", done: true },
    { name: "Comcast", action: "cancel", done: true },
    { name: "Geico", action: "update", done: true },
    { name: "AT&T Fiber", action: "transfer", done: false },
    { name: "Netflix", action: "update", done: false },
    { name: "USPS Forwarding", action: "transfer", done: false },
  ];

  const badge: Record<typeof items[number]["action"], string> = {
    transfer: "border-primary/30 bg-primary/10 text-primary",
    cancel: "border-destructive bg-destructive/10 text-destructive",
    update: "border-tone-sky-br bg-tone-sky-bg text-tone-sky-fg",
  };

  const labelKey: Record<typeof items[number]["action"], string> = {
    transfer: "checklist_action_transfer",
    cancel: "checklist_action_cancel",
    update: "checklist_action_update",
  };

  const bullets = [
    t("mm_bullet_1"),
    t("mm_bullet_2"),
    t("mm_bullet_3"),
    t("mm_bullet_4"),
  ];

  return (
    <section className="container py-20 border-t md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:gap-16 md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-wider text-primary">
            {t("mm_eyebrow")}
          </div>
          <h2 className="mt-5 text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] max-w-[18ch]">
            {t("mm_title_a")} <span className="text-primary italic">{t("mm_title_accent")}</span>
          </h2>
          <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-[42ch]">
            {t("mm_body")}
          </p>
          <ul className="mt-7 space-y-3">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2.5 text-sm text-foreground/80">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border bg-card p-7 shadow-xl">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              432 OAK ST → 88 PINE LN · JUN 15
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {t("checklist_count", { total: 11, done: 6 })}
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              style={{ width: "55%" }}
            />
          </div>

          <div className="mt-6 space-y-2">
            {items.map((item) => (
              <div
                key={item.name}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  item.done
                    ? "border-tone-emerald-br bg-tone-emerald-bg"
                    : "border-border bg-muted/40"
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    item.done
                      ? "border-tone-emerald-br bg-tone-emerald-fg text-white"
                      : "border-foreground/30"
                  }`}
                >
                  {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
                </div>
                <p
                  className={`flex-1 text-sm font-semibold ${
                    item.done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {item.name}
                </p>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge[item.action]}`}
                >
                  {t(labelKey[item.action] as any)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
