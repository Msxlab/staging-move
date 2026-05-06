import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { InstallPrompt } from "@/components/shared/install-prompt";

type AppShellProps = {
  children: ReactNode;
  showBudget?: boolean;
};

export function AppShell({ children, showBudget = true }: AppShellProps) {
  return (
    <div className="flex min-h-screen relative" style={{ background: "var(--surface)" }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 dark-only-blobs">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-orange-600/10 blur-[150px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/3 w-[350px] h-[350px] rounded-full bg-cyan-500/8 blur-[120px]" />
      </div>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-brand-orange focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to main content
      </a>
      <Sidebar showBudget={showBudget} />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen relative z-10">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-w-0 p-4 md:p-6 pb-20 md:pb-6 focus:outline-none"
        >
          {children}
        </main>
        <MobileNav />
      </div>
      <InstallPrompt />
    </div>
  );
}
