import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { LEGAL_CONSENT_EVENT, getDefaultLegalConsents, hasRequiredLegalConsents } from "@/lib/legal";
import type { ReactNode } from "react";

function parseStoredLegalConsents(metadata: string | null | undefined) {
  if (!metadata) return null;
  try {
    return getDefaultLegalConsents(JSON.parse(metadata));
  } catch {
    return null;
  }
}

async function checkOnboardingNeeded(): Promise<boolean> {
  try {
    const { requireDbUserId } = await import("@/lib/auth");
    const userId = await requireDbUserId();
    const [profile, consentEvent, address] = await Promise.all([
      prisma.profile.findUnique({ where: { userId } }),
      prisma.userEvent.findFirst({ where: { userId, event: LEGAL_CONSENT_EVENT } }),
      prisma.address.findFirst({ where: { userId, deletedAt: null }, select: { id: true } }),
    ]);
    const legalConsents = parseStoredLegalConsents(consentEvent?.metadata);
    return !(profile && hasRequiredLegalConsents(legalConsents) && address);
  } catch (error: any) {
    if (error?.message === "ACCOUNT_DELETED") {
      redirect("/");
    }
    return false;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const needsOnboarding = await checkOnboardingNeeded();
  if (needsOnboarding) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen relative" style={{ background: "var(--surface)" }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 dark-only-blobs">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-orange-600/10 blur-[150px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/3 w-[350px] h-[350px] rounded-full bg-cyan-500/8 blur-[120px]" />
      </div>
      {/* Skip link — keyboard users tab past 30+ sidebar links on every
          page load. The link becomes visible on focus and jumps focus
          straight to <main>. Tailwind's `sr-only` + `focus:not-sr-only`
          pattern keeps it invisible to sighted users. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-brand-orange focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen relative z-10">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 md:p-6 pb-20 md:pb-6 focus:outline-none"
        >
          {children}
        </main>
        <MobileNav />
      </div>
      <InstallPrompt />
    </div>
  );
}
