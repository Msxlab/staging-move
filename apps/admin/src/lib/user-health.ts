import type { HealthTone } from "@/components/premium/health-pill";

interface UserHealthInput {
  /** ISO timestamp string of the user's last sign-in, or null. */
  lastLoginAt?: string | null;
  /** Subscription status — `ACTIVE`, `PAST_DUE`, `CANCELED`, etc. */
  subscriptionStatus?: string | null;
  /** Activity counts used to detect "ghost" users with no real engagement. */
  addresses?: number;
  services?: number;
  /** Account-level lock — `BLOCKED` overrides everything. */
  blocked?: boolean;
}

export interface UserHealth {
  tone: HealthTone;
  label: string;
  detail: string;
}

const DAY_MS = 86_400_000;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

/**
 * Compute a 3-state health verdict for a user. Order of precedence:
 *  1. Blocked / past_due → rose (at risk)
 *  2. Canceled / unsubscribed → rose
 *  3. No login + no activity → rose (ghost account)
 *  4. Idle > 14 days → honey
 *  5. Anything else → sage
 *
 * The label is the column cell text; `detail` is the tooltip / aria-label
 * with a longer explanation for the support team.
 */
export function computeUserHealth(input: UserHealthInput): UserHealth {
  if (input.blocked) {
    return {
      tone: "rose",
      label: "Blocked",
      detail: "Account is blocked or deleted",
    };
  }

  const status = (input.subscriptionStatus ?? "").toUpperCase();
  if (status === "PAST_DUE" || status === "UNPAID") {
    return {
      tone: "rose",
      label: "Past due",
      detail: "Payment failed — billing needs attention",
    };
  }
  if (status === "CANCELED" || status === "EXPIRED") {
    return {
      tone: "rose",
      label: "Canceled",
      detail: "Subscription canceled or expired",
    };
  }

  const idle = daysSince(input.lastLoginAt);
  const totalActivity = (input.addresses ?? 0) + (input.services ?? 0);

  if ((idle === null || idle > 60) && totalActivity === 0) {
    return {
      tone: "rose",
      label: "Ghost",
      detail: "No login or activity recorded — likely abandoned",
    };
  }

  if (idle !== null && idle > 14) {
    return {
      tone: "honey",
      label: `Idle ${idle}d`,
      detail: `Last sign-in ${idle} days ago`,
    };
  }

  if (idle === null) {
    return {
      tone: "honey",
      label: "New",
      detail: "No login recorded yet",
    };
  }

  return {
    tone: "sage",
    label: "Healthy",
    detail:
      idle === 0
        ? "Active today"
        : `Active ${idle} day${idle === 1 ? "" : "s"} ago`,
  };
}
