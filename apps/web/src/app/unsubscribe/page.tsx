import Link from "next/link";
import { MailX, MailCheck } from "lucide-react";
import { Wordmark } from "@/components/marketing/logo";
import { prisma } from "@/lib/db";
import {
  parseUnsubscribeKind,
  verifyUnsubscribeToken,
} from "@/lib/unsubscribe";
import {
  loadEmailOptOutState,
  processUnsubscribe,
} from "@/lib/unsubscribe-actions";

export const dynamic = "force-dynamic";

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Public unsubscribe landing. The link in marketing emails opens this
 * page; we verify the HMAC token, opt the user out of the requested
 * kind immediately (so the click itself counts as consent — matches
 * Gmail/Apple expectations), then show the resulting state with a link
 * back to the in-app preference page for finer control.
 *
 * No auth required: the token is the proof that the holder controls
 * the email address we sent the message to.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams?: Promise<{ t?: string | string[]; k?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : {};
  const token = readParam(params.t);
  const kindParam = readParam(params.k);

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return (
      <Shell>
        <MailX className="mx-auto h-11 w-11 text-destructive" aria-hidden />
        <h1 className="text-2xl font-bold text-foreground">Link no longer valid</h1>
        <p className="text-sm text-muted-foreground">
          This unsubscribe link has expired or is invalid. Sign in and adjust your preferences from the
          notification settings page instead.
        </p>
        <Link
          href="/settings/notifications"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Open settings
        </Link>
      </Shell>
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { email: true },
  });
  if (!user) {
    return (
      <Shell>
        <MailX className="mx-auto h-11 w-11 text-destructive" aria-hidden />
        <h1 className="text-2xl font-bold text-foreground">Account not found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t find an active account for this unsubscribe link.
        </p>
      </Shell>
    );
  }

  const kind = parseUnsubscribeKind(kindParam);
  await processUnsubscribe({ userId, kind, source: "click" });
  const state = await loadEmailOptOutState(userId);

  const summary = describeState(kind, state);

  return (
    <Shell>
      <MailCheck className="mx-auto h-11 w-11 text-sage" aria-hidden />
      <h1 className="text-2xl font-bold text-foreground">You&apos;re unsubscribed</h1>
      <p className="text-sm text-muted-foreground">
        {summary} You&apos;ll still receive critical security and account messages so you can recover
        your account if something goes wrong.
      </p>
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
        <span className="block font-medium text-foreground">Email on file</span>
        <span className="break-all">{user.email}</span>
      </div>
      <Link
        href="/settings/notifications"
        className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        Manage preferences
      </Link>
      <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
        Back to home
      </Link>
    </Shell>
  );
}

function describeState(
  kind: ReturnType<typeof parseUnsubscribeKind>,
  state: { marketingOptedOut: boolean; reminderOptedOut: boolean },
): string {
  if (kind === "marketing") {
    return "We won't send marketing or digest emails to this address anymore.";
  }
  if (kind === "reminder") {
    return "We've turned off bill, contract, and move reminders for this address.";
  }
  if (state.marketingOptedOut && state.reminderOptedOut) {
    return "We've turned off all marketing and reminder emails for this address.";
  }
  return "We've recorded your unsubscribe request.";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--surface)" }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/85 p-8 text-center shadow-lg backdrop-blur-xl space-y-4">
        <div className="flex justify-center">
          <Wordmark href="/" animated={false} />
        </div>
        {children}
      </div>
    </div>
  );
}
