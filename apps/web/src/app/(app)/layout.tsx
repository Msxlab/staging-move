import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { destroyUserSession, requireDbUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPostAuthUserState, resolvePostAuthRedirect } from "@/lib/post-auth-redirect";
import { normalizeAppRedirectPath } from "@/lib/safe-redirect";
import type { ReactNode } from "react";

async function getCurrentAppPath() {
  const headerStore = await headers();
  return normalizeAppRedirectPath(
    headerStore.get("x-locateflow-pathname"),
    "/dashboard",
  );
}

async function getAppGateState(): Promise<
  | { redirectTo: string }
  | { userId: string }
> {
  const currentPath = await getCurrentAppPath();
  let userId: string;
  try {
    userId = await requireDbUserId({ distinguishDeleted: true });
  } catch (error: any) {
    if (error?.message === "ACCOUNT_DELETED") {
      redirect("/sign-in?error=account-unavailable");
    }
    if (error?.message === "UNAUTHORIZED") {
      redirect(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
    }
    // requireDbUserId redirects internally for unhandled cases above; fall
    // through to a "no userId" sentinel rather than rethrow so the layout
    // returns null cleanly.
    return { redirectTo: "/sign-in" };
  }

  try {
    const target = resolvePostAuthRedirect(await getPostAuthUserState(userId), currentPath);
    return target === currentPath ? { userId } : { redirectTo: target };
  } catch (error: any) {
    if (error?.message === "AUTH_STATE_USER_UNAVAILABLE") {
      await destroyUserSession().catch(() => null);
      redirect(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
    }
    throw error;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const gate = await getAppGateState();
  if ("redirectTo" in gate) {
    redirect(gate.redirectTo);
  }

  const userPrefs = await prisma.user
    .findUnique({
      where: { id: gate.userId },
      select: { showBudget: true },
    })
    .catch(() => null);
  const showBudget = userPrefs?.showBudget ?? true;

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
