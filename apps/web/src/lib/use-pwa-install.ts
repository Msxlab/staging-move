"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Platform-aware PWA install state for the smart install banner.
 *
 * On Chromium desktop + Android Chrome the browser fires `beforeinstallprompt`
 * when the PWA is installable. We capture it, suppress the default mini-infobar,
 * and stash the deferred event so the UI can trigger the native install dialog
 * on a user gesture (browsers require the gesture; the stashed event may only be
 * `.prompt()`-ed once). When the app is installed (`appinstalled`) or already
 * running standalone, the prompt is no longer offered.
 *
 * iOS Safari never fires `beforeinstallprompt`, so this hook reports
 * `canPromptInstall === false` there and the caller falls back to the native
 * App Store path / Add-to-Home-Screen guidance.
 *
 * SSR-safe: all window/navigator access happens inside effects, and `mounted`
 * stays false until the first client render so the caller can render nothing
 * on the server and avoid a hydration mismatch.
 */

// The slice of the (non-standardised) BeforeInstallPromptEvent we rely on.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari exposes a non-standard `navigator.standalone` for installed PWAs.
  return Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
}

export interface PwaInstall {
  /** True once the component has mounted on the client (render-gate for SSR). */
  mounted: boolean;
  /** True only when a captured `beforeinstallprompt` is ready to fire. */
  canPromptInstall: boolean;
  /** True once the PWA is installed or already running standalone. */
  isInstalled: boolean;
  /**
   * Fires the captured native install dialog. No-op (returns null) when no
   * prompt is available. Returns the user's choice outcome when one is.
   */
  promptInstall: () => Promise<"accepted" | "dismissed" | null>;
}

export function usePwaInstall(): PwaInstall {
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsInstalled(isStandaloneDisplayMode());

    const onBeforeInstallPrompt = (event: Event) => {
      // Stop Chrome's default mini-infobar; we drive install from our own UI.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      // Installed → drop the stale deferred event and hide the install CTA.
      setDeferred(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return null;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      // The deferred event can only be prompted once; clear it either way.
      setDeferred(null);
      if (choice.outcome === "accepted") setIsInstalled(true);
      return choice.outcome;
    } catch {
      setDeferred(null);
      return null;
    }
  }, [deferred]);

  return {
    mounted,
    canPromptInstall: Boolean(deferred) && !isInstalled,
    isInstalled,
    promptInstall,
  };
}
