import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { destroyUserSession, requireDbUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPostAuthUserState, resolvePostAuthRedirect } from "@/lib/post-auth-redirect";
import { normalizeAppRedirectPath } from "@/lib/safe-redirect";

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

  return (
    <AppShell showBudget={userPrefs?.showBudget ?? true}>
      {children}
    </AppShell>
  );
}
