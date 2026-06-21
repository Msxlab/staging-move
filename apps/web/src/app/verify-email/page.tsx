import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/marketing/logo";
import { prisma } from "@/lib/db";
import { normalizeAppRedirectPath } from "@/lib/safe-redirect";
import { getUserSession } from "@/lib/user-auth";
import { ResendVerificationButton } from "./resend-verification-button";

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VerifyEmailPendingPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : {};
  const redirectPath = normalizeAppRedirectPath(readParam(params.redirect), "/dashboard");
  const session = await getUserSession();
  const tAuth = await getTranslations("auth");
  const tCommon = await getTranslations("common");

  let email: string | null = null;
  if (session) {
    const user = await prisma.user.findFirst({
      where: { id: session.userId, deletedAt: null },
      select: { email: true, emailVerifiedAt: true, passwordHash: true },
    });

    if (user?.emailVerifiedAt) {
      redirect(redirectPath);
    }
    if (user?.passwordHash) {
      email = user.email;
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-card to-background p-4">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-40 h-[560px] w-[560px] rounded-full bg-primary/10 blur-3xl" />
      <div className="relative w-full max-w-md space-y-5 rounded-2xl border border-border bg-card/85 p-8 text-center shadow-lg backdrop-blur-xl">
        <div className="flex justify-center">
          <Wordmark href="/" animated={false} />
        </div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <MailCheck className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-foreground">{tAuth("verifyEmailTitle")}</h1>
          {email ? (
            <p className="text-sm text-muted-foreground">
              {tAuth("verifyEmailSentPrefix")} <span className="font-medium text-foreground">{email}</span>. {tAuth("verifyEmailSentSuffix")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tAuth("verifyEmailSignInFirst")}
            </p>
          )}
        </div>

        {email ? <ResendVerificationButton /> : null}

        <div className="flex flex-col gap-2">
          <Link
            href={`/sign-in?redirect=${encodeURIComponent(redirectPath)}`}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            {tCommon("signIn")}
          </Link>
          <Link href="/" className="text-xs text-muted-foreground transition hover:text-primary">
            {tCommon("goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
