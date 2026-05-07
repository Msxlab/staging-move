import { getTranslations } from "next-intl/server";
import { MapPin, AlertCircle } from "lucide-react";

/**
 * Hero phone mock â€” emotional acid test.
 * Shows the dashboard in its "I just opened the app and saw the truth" state:
 *   - tracked spend at this address
 *   - cumulative savings since starting
 *   - two attention items: a renewal you forgot, a charge at your old place
 * Both rows are real things people miss when they don't track. The visual
 * itself is the pitch â€” the phone screen IS the recognition + relief moment.
 */
export async function HeroPhoneMock() {
  const t = await getTranslations("landing");

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div
        aria-hidden="true"
        className="absolute -inset-10 rounded-[80px] bg-gradient-to-br from-primary/25 via-transparent to-accent0/15 blur-3xl"
      />

      <div className="relative rounded-[44px] border border-border/80 bg-background p-2 shadow-2xl rotate-[-3deg]">
        <div className="overflow-hidden rounded-[36px] border border-border/60 bg-card">
          {/* Status bar */}
          <div className="relative flex items-center justify-between bg-card px-6 pt-3 pb-2 text-[10px] font-medium text-foreground/80">
            <span>9:41</span>
            <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-background" />
            <span className="font-mono">100%</span>
          </div>

          {/* Greeting + address */}
          <div className="px-5 pt-4">
            <p className="text-[10px] text-muted-foreground">{t("hero_mock_greeting")}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-foreground/80">
              <MapPin className="h-3 w-3 text-primary" />
              432 Oak St · Austin
            </p>
          </div>

          {/* Twin stat cards: tracked / saved */}
          <div className="mx-5 mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {t("hero_mock_tracked_label")}
              </p>
              <p className="mt-0.5 text-xl font-extrabold tracking-tight tabular-nums">
                $637<span className="ml-0.5 text-[10px] font-medium text-muted-foreground">/mo</span>
              </p>
              <p className="text-[9px] text-muted-foreground">{t("hero_mock_tracked_sub")}</p>
            </div>
            <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-accent0/5 p-3">
              <p className="text-[9px] uppercase tracking-wider text-primary">
                {t("hero_mock_saved_label")}
              </p>
              <p className="mt-0.5 text-xl font-extrabold tracking-tight tabular-nums">$847</p>
              <p className="text-[9px] text-muted-foreground">{t("hero_mock_saved_sub")}</p>
            </div>
          </div>

          {/* Needs attention */}
          <div className="mx-5 mt-5">
            <p className="text-[10px] font-bold text-foreground">{t("hero_mock_attention")}</p>
          </div>

          <div className="mx-5 mt-2 space-y-1.5 pb-5">
            <div className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning shadow-[0_0_6px] shadow-warning" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold">{t("hero_mock_alert_classpass_t")}</p>
                  <p className="text-[9px] text-muted-foreground">{t("hero_mock_alert_classpass_b")}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold">{t("hero_mock_alert_comcast_t")}</p>
                  <p className="text-[9px] text-muted-foreground">{t("hero_mock_alert_comcast_b")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
