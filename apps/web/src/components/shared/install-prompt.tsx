"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PWA_INSTALL_ENABLED = false;

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!PWA_INSTALL_ENABLED) return;

    const stored = localStorage.getItem("pwa-install-dismissed");
    if (stored) setDismissed(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 animate-in slide-in-from-bottom-4">
      <div className="rounded-2xl border border-border p-4 shadow-2xl" style={{ background: "color-mix(in srgb, var(--surface-secondary) 95%, transparent)" }}>
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-tone-orange-bg p-2.5 shrink-0">
            <Download className="h-5 w-5 text-tone-orange-fg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Install LocateFlow</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add to home screen for quick access and offline support</p>
            <div className="flex gap-2 mt-3">
              <button onClick={install} className="rounded-lg bg-tone-orange-bg px-3 py-1.5 text-xs font-medium text-white hover:bg-tone-orange-fg transition">
                Install
              </button>
              <button onClick={dismiss} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-muted-foreground transition">
                Not Now
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="text-foreground/30 hover:text-muted-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
