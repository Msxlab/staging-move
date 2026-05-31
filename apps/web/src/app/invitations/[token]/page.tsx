"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Users, AlertCircle, CheckCircle2 } from "lucide-react";

interface InviteDetails {
  workspaceName: string | null;
  invitedEmail: string;
  role: string;
  expiresAt: string;
  requiresSignup: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  CHILD: "Child",
  VIEW_ONLY: "View only",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/85 p-8 shadow-lg backdrop-blur-xl space-y-6">
        {children}
      </div>
    </div>
  );
}

export default function InvitationPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : Array.isArray(params?.token) ? params.token[0] : "";
  const selfPath = `/invitations/${token}`;

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [authed, setAuthed] = useState(false);
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [invRes, meRes] = await Promise.all([
          fetch(`/api/invitations/${token}`, { cache: "no-store" }),
          fetch(`/api/auth/me?optional=1`, { cache: "no-store" }),
        ]);
        const invData = await invRes.json().catch(() => ({}));
        const meData = await meRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!invRes.ok) {
          // A 5xx isn't "invalid" — tell the user it's a transient error.
          setError(
            invRes.status >= 500
              ? "Something went wrong loading this invitation. Please try again."
              : invData.error || "This invitation is no longer valid.",
          );
        } else if (typeof invData?.invitedEmail === "string") {
          setInvite(invData as InviteDetails);
        } else {
          setError("Something went wrong loading this invitation.");
        }
        setAuthed(Boolean(meData.authenticated));
        setMyEmail(meData.user?.email ?? null);
      } catch {
        if (!cancelled) setError("Something went wrong loading this invitation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = useCallback(async () => {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't accept this invitation.");
        setAccepting(false);
        return;
      }
      setAccepted(true);
      setTimeout(() => router.replace("/dashboard"), 1200);
    } catch {
      setError("Couldn't accept this invitation.");
      setAccepting(false);
    }
  }, [token, router]);

  const switchAccount = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "locateflow" },
      body: "{}",
      cache: "no-store",
    }).catch(() => {});
    window.location.href = `/sign-in?redirect=${encodeURIComponent(selfPath)}`;
  }, [selfPath]);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  if (!invite) {
    return (
      <Shell>
        <div className="space-y-3 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="text-xl font-bold text-foreground">Invitation unavailable</h1>
          <p className="text-sm text-muted-foreground">{error || "This invitation is no longer valid."}</p>
          <Link href="/" className="inline-block text-sm text-primary hover:underline">Go home</Link>
        </div>
      </Shell>
    );
  }

  if (accepted) {
    return (
      <Shell>
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
          <h1 className="text-xl font-bold text-foreground">You&apos;re in!</h1>
          <p className="text-sm text-muted-foreground">Joined {invite.workspaceName ?? "the workspace"}. Redirecting&hellip;</p>
        </div>
      </Shell>
    );
  }

  const roleLabel = ROLE_LABEL[invite.role] ?? invite.role;
  const wsName = invite.workspaceName ?? "a workspace";
  const emailMatches = authed && myEmail != null && myEmail.toLowerCase() === invite.invitedEmail.toLowerCase();

  return (
    <Shell>
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-tone-orange-br bg-tone-orange-bg">
          <Users className="h-6 w-6 text-tone-orange-fg" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Join {wsName}</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ve been invited to join <span className="font-medium text-foreground">{wsName}</span> as{" "}
          <span className="font-medium text-foreground">{roleLabel}</span>.
        </p>
        <p className="text-xs text-muted-foreground">Invitation for {invite.invitedEmail}</p>
      </div>

      {error && (
        <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-3 text-xs text-tone-honey-fg/90">
        Joining means an owner or admin can start an address-change sync that affects your connected services. You can leave at any time.
      </div>

      {!authed && (
        <div className="space-y-2">
          {invite.requiresSignup ? (
            <>
              <Link
                href={`/sign-up?redirect=${encodeURIComponent(selfPath)}`}
                className="block w-full rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Create your account
              </Link>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link href={`/sign-in?redirect=${encodeURIComponent(selfPath)}`} className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <Link
              href={`/sign-in?redirect=${encodeURIComponent(selfPath)}`}
              className="block w-full rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Sign in to accept
            </Link>
          )}
          <p className="text-center text-[11px] text-muted-foreground">Sign in with {invite.invitedEmail} to accept this invitation.</p>
        </div>
      )}

      {authed && emailMatches && (
        <div className="space-y-2">
          <button
            onClick={accept}
            disabled={accepting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {accepting && <Loader2 className="h-4 w-4 animate-spin" />}
            {accepting ? "Joining…" : `Join as ${roleLabel}`}
          </button>
          <Link href="/dashboard" className="block text-center text-xs text-muted-foreground hover:text-foreground">
            Maybe later
          </Link>
        </div>
      )}

      {authed && !emailMatches && (
        <div className="space-y-2">
          <p className="text-center text-sm text-muted-foreground">
            This invitation is for <span className="font-medium text-foreground">{invite.invitedEmail}</span>, but you&apos;re signed in as{" "}
            <span className="font-medium text-foreground">{myEmail}</span>.
          </p>
          <button
            onClick={switchAccount}
            className="block w-full rounded-xl border border-border px-4 py-2.5 text-center text-sm font-semibold text-foreground transition hover:bg-foreground/5"
          >
            Sign in as {invite.invitedEmail}
          </button>
        </div>
      )}
    </Shell>
  );
}
