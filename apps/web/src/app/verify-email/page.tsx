import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/85 p-8 text-center shadow-lg backdrop-blur-xl space-y-5">
        <div className="flex justify-center">
          <Wordmark href="/" animated={false} />
        </div>
        <MailCheck className="mx-auto h-11 w-11 text-sage" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
          {email ? (
            <p className="text-sm text-muted-foreground">
              We sent a verification link to <span className="font-medium text-foreground">{email}</span>. Verify your email before opening the app.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sign in with the account you just created, then verify your email before opening the app.
            </p>
          )}
        </div>

        {email ? <ResendVerificationButton /> : null}

        <div className="flex flex-col gap-2">
          <Link
            href={`/sign-in?redirect=${encodeURIComponent(redirectPath)}`}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Sign in
          </Link>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
