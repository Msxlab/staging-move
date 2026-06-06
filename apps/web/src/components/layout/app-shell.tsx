"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { InstallPrompt } from "@/components/shared/install-prompt";

type AppShellProps = {
  children: ReactNode;
  showBudget?: boolean;
  showWorkspace?: boolean;
  /** Effective plan tier — applies the per-plan accent theme on the shell. */
  planTier?: string | null;
};

const EMBED_STORAGE_KEY = "lf:embed-mobile";

function useEmbedMode() {
  const searchParams = useSearchParams();
  const [embed, setEmbed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromQuery = searchParams.get("embed") === "mobile";
    if (fromQuery) {
      // Native in-app browser sessions navigate between pages of the same
      // origin; the query param survives the first hop but not subsequent
      // server-side redirects, so latch it for the rest of the session.
      try {
        window.sessionStorage.setItem(EMBED_STORAGE_KEY, "1");
      } catch {
        /* sessionStorage can throw in private mode — fall through */
      }
      setEmbed(true);
      return;
    }
    try {
      if (window.sessionStorage.getItem(EMBED_STORAGE_KEY) === "1") {
        setEmbed(true);
      }
    } catch {
      /* noop */
    }
  }, [searchParams]);

  return embed;
}

export function AppShell({ children, showBudget = true, showWorkspace = false, planTier = null }: AppShellProps) {
  const tCommon = useTranslations("common");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const embedMode = useEmbedMode();
  // Per-plan accent class consumed by globals.css (.plan-family / .plan-pro).
  const planClass = planTier === "PRO" ? "plan-pro" : planTier === "FAMILY" ? "plan-family" : "";

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Mobile in-app browser embed: strip the global chrome so the screen
  // visually matches the surrounding native UI. No header, sidebar, mobile
  // tab bar, or install prompt — just the page content. The in-app browser
  // supplies its own "Done" button to dismiss.
  const embedShell = useMemo(() => {
    if (!embedMode) return null;
    return (
      <div className="min-h-screen" style={{ background: "var(--surface)" }}>
        <ImpersonationBanner />
        <main id="main-content" tabIndex={-1} className="p-4 focus:outline-none">
          <div className="mx-auto w-full max-w-screen-md">{children}</div>
        </main>
      </div>
    );
  }, [embedMode, children]);

  if (embedShell) return embedShell;

  return (
    <div className={`flex min-h-screen relative ${planClass}`} style={{ background: "var(--surface)" }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 dark-only-blobs">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-tone-orange-bg blur-[150px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-tone-foil-bg blur-[120px]" />
        <div className="absolute -bottom-40 right-1/3 w-[350px] h-[350px] rounded-full bg-tone-cyan-bg blur-[120px]" />
      </div>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-brand-orange focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {tCommon("skipToMain")}
      </a>
      <Sidebar showBudget={showBudget} showWorkspace={showWorkspace} />
      {mobileMenuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm backdrop-blur-sm md:hidden"
            aria-label={tCommon("closeNavigationMenu")}
            onClick={() => setMobileMenuOpen(false)}
          />
          <Sidebar
            showBudget={showBudget}
            showWorkspace={showWorkspace}
            variant="mobile"
            open
            onClose={() => setMobileMenuOpen(false)}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </>
      ) : null}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen relative z-10">
        <ImpersonationBanner />
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-w-0 p-4 md:p-6 pb-20 md:pb-6 focus:outline-none"
        >
          <div className="mx-auto w-full max-w-screen-2xl">
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
      <InstallPrompt />
    </div>
  );
}
