import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/marketing/logo";
import { destroyUserSession, requireDbUserId } from "@/lib/auth";
import {
  getPostAuthUserState,
  resolveOnboardingGateRedirect,
} from "@/lib/post-auth-redirect";

async function assertOnboardingAccess() {
  let userId: string;
  try {
    userId = await requireDbUserId({ distinguishDeleted: true });
  } catch (error: any) {
    if (error?.message === "ACCOUNT_DELETED") {
      redirect("/sign-in?error=account-unavailable");
    }
    if (error?.message === "UNAUTHORIZED") {
      redirect("/sign-in?redirect=/onboarding");
    }
    throw error;
  }

  try {
    const redirectTarget = resolveOnboardingGateRedirect(
      await getPostAuthUserState(userId),
      "/onboarding",
    );
    if (redirectTarget) redirect(redirectTarget);
  } catch (error: any) {
    if (error?.message === "AUTH_STATE_USER_UNAVAILABLE") {
      await destroyUserSession().catch(() => null);
      redirect("/sign-in?redirect=/onboarding");
    }
    throw error;
  }
}

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  await assertOnboardingAccess();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        <div className="text-center mb-6">
          <div className="flex justify-center">
            <Wordmark href="/" animated={false} />
          </div>
          <p className="text-muted-foreground text-sm mt-2">Let&apos;s set up your account</p>
        </div>
        {children}
      </div>
    </div>
  );
}
