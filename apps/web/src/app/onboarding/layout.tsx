import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/marketing/logo";
import { requireDbUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildEmailVerificationGateRedirect,
  needsEmailVerificationGate,
} from "@/lib/email-verification-gate";

async function assertOnboardingAccess() {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      redirect("/sign-in?redirect=/onboarding");
    }
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      emailVerifiedAt: true,
      passwordHash: true,
      oauthAccounts: { select: { id: true }, take: 1 },
    },
  });

  if (!user) {
    redirect("/sign-in?redirect=/onboarding");
  }

  if (needsEmailVerificationGate(user)) {
    redirect(buildEmailVerificationGateRedirect("/onboarding"));
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
