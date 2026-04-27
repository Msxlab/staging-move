"use client";

import { useEffect, useState } from "react";
import { DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface UIPreferences {
  showBudget: boolean;
}

export function UIPreferencesCard() {
  const t = useTranslations("settings.preferences");
  const [prefs, setPrefs] = useState<UIPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setPrefs({ showBudget: Boolean(data.showBudget) });
      })
      .catch(() => {
        if (!cancelled) setPrefs({ showBudget: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function update<K extends keyof UIPreferences>(key: K, value: UIPreferences[K]) {
    if (!prefs) return;
    const previous = prefs[key];
    setPrefs({ ...prefs, [key]: value });
    setSaving(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error("save_failed");
      // Sidebar visibility is rendered server-side from the same column, so
      // refresh the page silently to apply nav changes without forcing a
      // hard reload.
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch {
      setPrefs({ ...prefs, [key]: previous });
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
        <Loader2 className="h-4 w-4 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider">
          {t("heading")}
        </h2>
      </div>
      <div className="px-5 pb-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <DollarSign className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{t("showBudget.label")}</p>
              <p className="text-xs text-white/40">{t("showBudget.description")}</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={prefs.showBudget}
              onChange={(e) => update("showBudget", e.target.checked)}
              disabled={saving}
              aria-label={t("showBudget.label")}
            />
            <div className="w-11 h-6 bg-white/10 peer-checked:bg-orange-500 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5 peer-disabled:opacity-50" />
          </label>
        </div>
      </div>
    </div>
  );
}
