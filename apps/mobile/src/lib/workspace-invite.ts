/**
 * Workspace invite acceptance — shared logic for the mobile invite-accept flow.
 *
 * The web app emails an invite URL of the form `https://locateflow.com/invitations/<token>`
 * (see apps/web/src/app/api/workspaces/[id]/invitations/route.ts → `inviteUrl`).
 * The token itself is `wsi_<base64url>` (see apps/web/src/lib/workspace-invitations.ts).
 *
 * Two ways into the accept flow on mobile:
 *   1. Deep link — the universal link `/invitations/<token>` opens the app at
 *      app/invitations/[token].tsx (associated domain + Android intent filter are
 *      already configured in app.json).
 *   2. Manual paste — the user pastes the whole invite URL (or just the bare code)
 *      into app/workspace/accept-invite.tsx. `extractInviteToken` pulls the token out.
 *
 * Both paths funnel through `acceptInvite`, which calls the SAME web endpoint the web
 * accept page uses: `POST /api/invitations/<token>/accept`.
 */

import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

/** Invite tokens are minted as `wsi_` + base64url(32 bytes) on the web side. */
const TOKEN_PREFIX = "wsi_";
// base64url alphabet: A–Z a–z 0–9 - _ . The random 32-byte payload encodes to 43
// chars, but we keep the matcher permissive (1+) so a future token-length change
// on the server doesn't silently break paste parsing.
const TOKEN_RE = /wsi_[A-Za-z0-9_-]+/;

/**
 * Pull an invite token out of whatever the user pasted. Accepts:
 *   - a full URL:   https://locateflow.com/invitations/wsi_abc123  (also /accept, query, hash)
 *   - a deep link:  locateflow:///invitations/wsi_abc123
 *   - a bare token: wsi_abc123
 * Returns the normalized token, or null if no `wsi_…` token is present.
 */
export function extractInviteToken(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Fast path: the user pasted exactly the bare token.
  if (trimmed.startsWith(TOKEN_PREFIX) && !/[\s/?#]/.test(trimmed)) {
    return trimmed;
  }

  // Otherwise scan the string for the first `wsi_…` run. This covers full URLs,
  // deep links, and tokens buried in extra text, without needing URL parsing
  // (which is brittle across the locateflow:// scheme and pasted fragments).
  const match = trimmed.match(TOKEN_RE);
  return match ? match[0] : null;
}

/** Stable error codes the UI maps to localized copy. */
export type InviteErrorCode =
  | "INVALID_TOKEN" // no token could be parsed, or 404 from the server
  | "EXPIRED" // 410 — revoked, already used, or past expiry
  | "SEAT_FULL" // 409 — workspace is at its seat limit (or a write-race)
  | "ALREADY_MEMBER" // 409 — caller is already a member
  | "WRONG_EMAIL" // 403 — invite is for a different email
  | "UNAUTHORIZED" // 401 — not signed in
  | "UNKNOWN"; // network/5xx/anything else

export interface AcceptInviteSuccess {
  ok: true;
  workspaceId: string;
  role: string;
  /** The effective plan tier resolved from /api/profile after joining (e.g. "FAMILY"). */
  planTier: string | null;
}

export interface AcceptInviteFailure {
  ok: false;
  code: InviteErrorCode;
  /** Raw server message, surfaced as a fallback when no localized copy applies. */
  message: string | null;
}

export type AcceptInviteResult = AcceptInviteSuccess | AcceptInviteFailure;

/**
 * Classify an ApiClient error into a stable InviteErrorCode.
 *
 * The shared ApiClient does not expose the numeric status, so we lean on the
 * server's `code` (when present) and otherwise match the known error strings the
 * accept route returns (see apps/web/src/app/api/invitations/[token]/accept/route.ts):
 *   401 "Sign in to accept."
 *   403 "This invitation is for a different email address."
 *   404 "Workspace not found."  /  GET 404 "Invalid invitation."
 *   409 "Workspace is at its seat limit." | "You are already a member…" | "Please try again."
 *   410 "Invitation not available." | "This invitation expired."
 */
function classifyError(error: string | null | undefined, code: string | null | undefined): InviteErrorCode {
  const c = (code ?? "").toUpperCase();
  if (c === "UNAUTHORIZED") return "UNAUTHORIZED";
  if (c === "WORKSPACE_DISABLED") return "UNKNOWN"; // feature off — generic copy

  const msg = (error ?? "").toLowerCase();
  if (!msg) return "UNKNOWN";
  if (msg.includes("sign in")) return "UNAUTHORIZED";
  if (msg.includes("different email")) return "WRONG_EMAIL";
  if (msg.includes("already a member") || msg.includes("already used")) return "ALREADY_MEMBER";
  if (msg.includes("seat limit") || msg.includes("try again")) return "SEAT_FULL";
  if (msg.includes("expired") || msg.includes("not available") || msg.includes("revoked")) return "EXPIRED";
  if (msg.includes("invalid invitation") || msg.includes("not found")) return "INVALID_TOKEN";
  return "UNKNOWN";
}

/**
 * Refresh the user's entitlement/workspace context after joining.
 *
 * Mirrors the dashboard's profile read (apps/mobile/app/(tabs)/index.tsx): the
 * effective plan comes from `/api/profile` → `entitlement.plan` (an inherited
 * Family/Pro member has no own paid row but inherits access). Writing it into the
 * auth store makes ThemeProvider apply the new plan accent/mascots app-wide.
 *
 * Best-effort: a transient profile failure must NOT undo a successful join, so we
 * swallow errors and return the prior tier.
 */
export async function refreshPlanTierFromProfile(): Promise<string | null> {
  try {
    const res = await api.get<{ entitlement?: { plan?: string | null }; subscription?: { plan?: string | null } }>(
      "/api/profile",
    );
    if (res.error || !res.data) return useAuthStore.getState().planTier;
    const planValue = (res.data.entitlement?.plan ?? res.data.subscription?.plan ?? null) as string | null;
    useAuthStore.getState().setPlanTier(planValue);
    return planValue;
  } catch {
    return useAuthStore.getState().planTier;
  }
}

/**
 * Accept a workspace invite by token. Calls the same endpoint as the web accept
 * page and, on success, refreshes the in-app entitlement so the new plan theme
 * applies immediately. The caller owns navigation + haptics.
 */
export async function acceptInvite(rawToken: string): Promise<AcceptInviteResult> {
  const token = extractInviteToken(rawToken);
  if (!token) {
    return { ok: false, code: "INVALID_TOKEN", message: null };
  }

  // encodeURIComponent guards against any stray characters; tokens are base64url
  // so this is normally a no-op, but it keeps a malformed paste from breaking the path.
  const res = await api.post<{ workspaceId: string; role: string }>(
    `/api/invitations/${encodeURIComponent(token)}/accept`,
    {},
  );

  if (res.error || !res.data) {
    return { ok: false, code: classifyError(res.error, res.code), message: res.error ?? null };
  }

  const planTier = await refreshPlanTierFromProfile();
  return { ok: true, workspaceId: res.data.workspaceId, role: res.data.role, planTier };
}

/* ------------------------------------------------------------------------- *
 * In-app pending-invitation prompt (dashboard banner)
 *
 * Unlike the token/paste flows above, these helpers talk to the id-based
 * endpoints the backend exposes for invites the user can act on WITHOUT a raw
 * token (the email-match on the server is the authorization boundary):
 *   GET  /api/invitations/pending                  → bare array of invites
 *   POST /api/invitations/pending/<id>/accept      → { workspaceId, role }
 *   POST /api/invitations/pending/<id>/decline     → { ok: true }
 * ------------------------------------------------------------------------- */

/** One actionable invitation as returned by GET /api/invitations/pending. */
export interface PendingInvitation {
  id: string;
  /** Workspace display name, or null when unavailable. */
  workspaceName: string | null;
  /** Inviter's display name, or null when unavailable. */
  inviterName: string | null;
  /** Workspace role the invite grants (e.g. "MEMBER"). */
  role: string;
  /** ISO-8601 expiry timestamp. */
  expiresAt: string;
}

/**
 * Fetch the caller's actionable (PENDING, non-expired, email-matched) invites.
 *
 * The endpoint returns a BARE JSON array. Best-effort: any error (feature gate
 * 404, network, unauth) yields an empty list so the dashboard simply hides the
 * banner rather than surfacing an error.
 */
export async function fetchPendingInvitations(): Promise<PendingInvitation[]> {
  try {
    const res = await api.get<PendingInvitation[]>("/api/invitations/pending");
    if (res.error || !Array.isArray(res.data)) return [];
    return res.data;
  } catch {
    return [];
  }
}

/**
 * Accept a pending invitation by id and, on success, refresh the in-app
 * entitlement so the new plan theme + mascots apply immediately (same mechanism
 * as the token flow — writes the resolved tier into the auth store, which
 * ThemeProvider observes).
 */
export async function acceptPendingInvitation(id: string): Promise<AcceptInviteResult> {
  const res = await api.post<{ workspaceId: string; role: string }>(
    `/api/invitations/pending/${encodeURIComponent(id)}/accept`,
    {},
  );
  if (res.error || !res.data) {
    return { ok: false, code: classifyError(res.error, res.code), message: res.error ?? null };
  }
  const planTier = await refreshPlanTierFromProfile();
  return { ok: true, workspaceId: res.data.workspaceId, role: res.data.role, planTier };
}

/**
 * Decline a pending invitation by id. Idempotent server-side. Returns true on
 * success so the caller can drop it from the list.
 */
export async function declinePendingInvitation(id: string): Promise<boolean> {
  const res = await api.post<{ ok: boolean }>(
    `/api/invitations/pending/${encodeURIComponent(id)}/decline`,
    {},
  );
  return !res.error && !!res.data?.ok;
}
