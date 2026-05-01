"use client";

import { useId, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

type Target =
  | "MOBILE_IOS"
  | "MOBILE_ANDROID"
  | "MOBILE_ANY"
  | "PLAN_FAMILY"
  | "PLAN_PRO"
  | "API_ACCESS";

interface WaitlistFormProps {
  target: Target;
  source: string;
  /** Shown above the input — sets expectations for what they're signing up for. */
  heading?: string;
  /** Small helper text under the input. */
  helper?: string;
  /** Button copy on the submit button. */
  submitLabel?: string;
  /** Copy after successful submit. */
  successMessage?: string;
  /** Show the optional free-form note textarea (Pro / API signups benefit from this). */
  withNote?: boolean;
  /** Compact layout for inline use (Pricing cards). */
  compact?: boolean;
}

export function WaitlistForm({
  target,
  source,
  heading,
  helper = "We'll email you when it opens. No marketing.",
  submitLabel = "Notify me",
  successMessage = "You're on the list. We'll email you when it's ready.",
  withNote = false,
  compact = false,
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const emailId = useId();
  const noteId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          target,
          source,
          note: withNote ? note || undefined : undefined,
          locale:
            typeof navigator !== "undefined" ? navigator.language : undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Something went wrong. Please try again.");
      }
      trackEvent("waitlist_joined", { target, source });
      setState("success");
    } catch (err) {
      setState("error");
      setErrorMsg((err as Error).message);
    }
  }

  if (state === "success") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
        <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {heading ? (
        <p className="text-sm font-medium text-foreground">{heading}</p>
      ) : null}
      <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-2 sm:flex-row"}>
        <label htmlFor={emailId} className="sr-only">
          Email address
        </label>
        <input
          id={emailId}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={state === "loading"}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        />
        <Button type="submit" disabled={state === "loading"} size="default">
          {state === "loading" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
      {withNote ? (
        <div className="space-y-1">
          <label htmlFor={noteId} className="text-xs text-muted-foreground">
            Optional — tell us about your use case (helps us prioritize)
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={state === "loading"}
            rows={3}
            maxLength={1000}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            placeholder="e.g. 'I manage 40 rental properties' or 'Realtor — I'd use this with clients'"
          />
        </div>
      ) : null}
      {helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
      {errorMsg ? (
        <p className="text-xs text-destructive" role="alert">
          {errorMsg}
        </p>
      ) : null}
    </form>
  );
}
