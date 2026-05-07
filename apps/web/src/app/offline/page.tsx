"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

export default function OfflinePage() {
  const t = useTranslations("errors");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center px-6">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <WifiOff className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t("offlineTitle")}</h1>
        <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
          {t("offlineDescription")}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          <RefreshCw className="h-4 w-4" />
          {t("tryAgain")}
        </button>
        <p className="mt-6 text-xs text-muted-foreground">
          {t("cachedPages")}
        </p>
      </div>
    </div>
  );
}
