"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

export default function OfflinePage() {
  const t = useTranslations("errors");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="mx-auto max-w-md rounded-[26px] border border-border bg-card/60 px-8 py-12 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <WifiOff className="h-10 w-10" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground mb-3">{t("offlineTitle")}</h1>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
          {t("offlineDescription")}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
        >
          <RefreshCw className="h-4 w-4" />
          {t("tryAgain")}
        </button>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {t("cachedPages")}
        </p>
      </div>
    </div>
  );
}
