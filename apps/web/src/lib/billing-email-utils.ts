import { captureMessage } from "@/lib/sentry";

export function formatPlanLabel(plan: string | null | undefined): string {
  return (plan || "subscription")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDateForEmail(
  date: Date | null | undefined,
  locale: string | null | undefined,
): string | null {
  if (!date) return null;
  const lang = (locale || "").toLowerCase().startsWith("es") ? "es-US" : "en-US";
  return date.toLocaleDateString(lang, { year: "numeric", month: "long", day: "numeric" });
}

// Best-effort email dispatch: a failure must never break webhook idempotency
// or a user-facing mutation, so callers fire-and-forget and we swallow here.
// `logPrefix` keeps each subsystem's existing log namespace; `captureWarning`
// opts a caller into Sentry (webhook + subscription actions do; IAP does not).
export function fireAndLogEmail(
  promise: Promise<unknown>,
  context: string,
  opts: { logPrefix: string; captureWarning?: boolean },
): void {
  void promise.catch((err) => {
    console.error(`${opts.logPrefix} Email dispatch failed (${context}):`, err);
    if (opts.captureWarning) {
      captureMessage(`${opts.logPrefix} Email dispatch failed (${context})`, "warning");
    }
  });
}
