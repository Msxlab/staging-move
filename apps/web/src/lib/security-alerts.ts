/**
 * WEB security alarm layer — closes audit finding SEC-ALERT [HIGH] "DETECT:
 * web off" (the admin app dispatches operator alerts for admin-panel events;
 * the web app raised none).
 *
 * The web app already EMITS structured security events (lib/security-events,
 * console + optional Sentry burst sink in lib/security-alert-sink), but
 * nothing ever EMAILS an operator. This module is that missing email alarm.
 * It is deliberately tiny and high-signal:
 *
 *  - Failed-login bursts: >= FAILED_LOGIN_ALERT_THRESHOLD failed attempts for
 *    ONE account or ONE source IP inside a rolling 15-minute window → one
 *    email per UTC day per subject. The threshold (10) sits ABOVE the
 *    per-(email,IP,UA) lockout (5 fails / 15 min in lib/login-lockout), so a
 *    single contained attacker never pages anyone — the alarm fires for the
 *    attacks the lockout can't contain alone: UA/IP rotation against one
 *    account, or password spraying many accounts from one IP. Counters are
 *    NOT reset on a successful login: a success mid-burst is the scenario
 *    that most needs eyes.
 *  - Webhook signature/auth failures: ANY failure (stripe / appstore /
 *    playstore) → one email per UTC day per provider+reason. A signature
 *    failure is either probing or a broken webhook secret; both need an
 *    operator either way.
 *
 * Design constraints:
 *  - NEVER throws into a request path. Every public function catches
 *    everything and resolves; callers may safely `void` the promise.
 *  - Detection only — this module never blocks, locks, or rate-limits
 *    anything, so degradation can only ever mean a missed alert, never an
 *    open door (the enforcing controls live in login-lockout /
 *    rate-limit-policy and are untouched).
 *  - Counters use the same Upstash REST primitives as lib/login-lockout with
 *    an in-process fallback. MULTI-INSTANCE CAVEAT: without Upstash each
 *    instance counts independently, so the threshold must be crossed on a
 *    single instance before the alarm fires. The per-day email dedupe is
 *    global either way (emailLog.dedupeKey is unique in the DB), so multiple
 *    instances can never double-email an operator.
 *  - PII: alert emails contain at most the targeted account email + source
 *    IP. Redis counter keys and email dedupe keys carry only sha256 prefixes
 *    of those values.
 *  - Transport reuses the owner-alert plumbing: recipients resolve via
 *    ADMIN_ALERT_EMAIL || ALERT_EMAIL_TO (lib/admin-alerts) and delivery goes
 *    through sendLoggedEmail. Operator-facing, English-only by design (same
 *    owner decision as admin-alerts; user-facing emails keep their own en/es
 *    handling elsewhere).
 *  - The allowlisted QA account is excluded from the ACCOUNT dimension only
 *    (automated QA login churn must not page the owner); its attempts still
 *    count toward the source-IP dimension so the exclusion is not a blanket
 *    alarm bypass.
 */

import { createHash } from "node:crypto";
import { resolveAdminAlertRecipients } from "@/lib/admin-alerts";
import { escapeHtml, htmlToPlainText } from "@/lib/email";
import { sendLoggedEmail } from "@/lib/email-service";
import { isAllowlistedQaEmail } from "@/lib/qa-account";
import { getRequiredRuntimeConfigValues } from "@/lib/runtime-config";

const LOG_PREFIX = "[SECURITY-ALERT]";

export const FAILED_LOGIN_ALERT_THRESHOLD = 10;
export const FAILED_LOGIN_ALERT_WINDOW_SECONDS = 15 * 60;

export type SecurityAlertWebhookProvider = "stripe" | "appstore" | "playstore";

/** sha256 prefix — enough to key a counter, never reversible to the raw value. */
function subjectHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function utcDayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Upstash counter (same REST shape as lib/login-lockout) ────────────────

interface RedisConfig {
  url: string;
  token: string;
}

async function resolveRedisConfig(): Promise<RedisConfig | null> {
  try {
    const values = await getRequiredRuntimeConfigValues([
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]);
    const url = values.UPSTASH_REDIS_REST_URL;
    const token = values.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token || url.includes("REPLACE") || token.includes("REPLACE")) {
      return null;
    }
    return { url, token };
  } catch {
    return null;
  }
}

async function redisCall(
  config: RedisConfig,
  path: string,
): Promise<{ result: unknown } | null> {
  try {
    const res = await fetch(`${config.url}${path}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as { result: unknown };
  } catch {
    return null;
  }
}

interface MemCounter {
  count: number;
  resetAt: number;
}

const memCounters = new Map<string, MemCounter>();

/**
 * Increment the rolling-window failure counter for `counterKey` and return
 * the current count. Prefers the shared Upstash window; falls back to the
 * in-process window when Upstash is unconfigured or a call fails (detection
 * only — see the multi-instance caveat in the module docs).
 */
async function bumpFailureCounter(counterKey: string): Promise<number> {
  const redisConfig = await resolveRedisConfig();
  if (redisConfig) {
    const key = `sec-alert:${counterKey}`;
    const incr = await redisCall(redisConfig, `/incr/${encodeURIComponent(key)}`);
    if (typeof incr?.result === "number" && incr.result > 0) {
      if (incr.result === 1) {
        await redisCall(
          redisConfig,
          `/expire/${encodeURIComponent(key)}/${FAILED_LOGIN_ALERT_WINDOW_SECONDS}`,
        );
      }
      return incr.result;
    }
    // Redis call failed — fall through to the in-process window so a Redis
    // blip degrades to per-instance counting instead of total blindness.
  }

  const now = Date.now();
  const entry = memCounters.get(counterKey);
  if (!entry || entry.resetAt < now) {
    memCounters.set(counterKey, {
      count: 1,
      resetAt: now + FAILED_LOGIN_ALERT_WINDOW_SECONDS * 1000,
    });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

// ── Per-day alert dispatch ─────────────────────────────────────────────────

/**
 * Per-process "already alerted today" cache. Saves a DB round-trip per event
 * once an alert fired; the authoritative once-per-day guard is the globally
 * unique emailLog.dedupeKey inside sendLoggedEmail. Only marked after a
 * delivery succeeded (or was deduped), so transport failures retry on the
 * next qualifying event.
 */
const alertedDayKeys = new Set<string>();

function buildAlertHtml(opts: {
  heading: string;
  rows: Array<[string, string | null | undefined]>;
}): string {
  const rowsHtml = opts.rows
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(
      ([label, value]) =>
        `<li style="margin:0 0 6px;color:#334155;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</li>`,
    )
    .join("");
  return (
    `<div style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">` +
    `<h2 style="color:#b91c1c;margin:0 0 10px;">${escapeHtml(opts.heading)}</h2>` +
    `<ul style="padding-left:18px;margin:0;">${rowsHtml}</ul>` +
    `<p style="margin:12px 0 0;color:#64748b;font-size:13px;">Further occurrences of this alert are deduped until the next UTC day — check server logs for live volume.</p>` +
    `</div>`
  );
}

/**
 * One email per UTC day per `alertKey`, fanned out to every configured
 * recipient. Always leaves a console.error breadcrumb (even when no
 * recipients are configured, so log-based alerting still has a hook).
 * Never throws.
 */
async function dispatchSecurityAlert(opts: {
  /** Stable alert identity WITHOUT the prefix/day/recipient parts. */
  alertKey: string;
  subject: string;
  heading: string;
  rows: Array<[string, string | null | undefined]>;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const dayKey = `security-alert:${opts.alertKey}:${utcDayStamp()}`;
  if (alertedDayKeys.has(dayKey)) return;

  // Breadcrumb first — fires even when email is unconfigured or down.
  // eslint-disable-next-line no-console
  console.error(`${LOG_PREFIX} ${opts.subject}`, { alertKey: opts.alertKey });

  const recipients = await resolveAdminAlertRecipients();
  if (recipients.length === 0) {
    // No transport configured — still mark the day so the breadcrumb above
    // stays one-per-day-per-key instead of one-per-event.
    rememberAlertedDayKey(dayKey);
    return;
  }

  const html = buildAlertHtml({ heading: opts.heading, rows: opts.rows });
  const text = htmlToPlainText(html);

  let delivered = false;
  for (const to of recipients) {
    const result = await sendLoggedEmail({
      to,
      subject: opts.subject,
      html,
      text,
      // `:<to>` suffix because dedupeKey is globally unique — without it the
      // second recipient would be skipped as a duplicate (same pattern as
      // admin-alerts and the admin daily digest).
      dedupeKey: `${dayKey}:${to}`,
      metadata: opts.metadata,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(
        `${LOG_PREFIX} send failed (${opts.alertKey}):`,
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (result && (result.success || result.skipped)) delivered = true;
  }
  if (delivered) rememberAlertedDayKey(dayKey);
}

function rememberAlertedDayKey(dayKey: string): void {
  // Crude unbounded-growth guard; keys are per-day so this never triggers in
  // practice, but a hostile reason/provider mix must not leak memory forever.
  if (alertedDayKeys.size > 1000) alertedDayKeys.clear();
  alertedDayKeys.add(dayKey);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Record one failed login attempt for alarm purposes (NOT for enforcement —
 * lockout stays in lib/login-lockout). Tracks two independent dimensions:
 * the submitted account email (whether or not the account exists — that is
 * exactly what credential stuffing looks like) and the source IP. When
 * either window reaches {@link FAILED_LOGIN_ALERT_THRESHOLD}, one alert
 * email per UTC day per subject goes out. Never throws.
 */
export async function recordFailedLoginForAlerting(opts: {
  /** Normalized (lowercased) email as submitted to the login endpoint. */
  email: string;
  /** Source IP as resolved by lib/rate-limit's resolveClientIP. */
  ip: string;
  /** "web" | "mobile" — context for the operator, nothing more. */
  clientType?: string;
}): Promise<void> {
  try {
    const email = (opts.email || "").trim().toLowerCase();
    const ip = (opts.ip || "").trim();
    const windowMinutes = Math.round(FAILED_LOGIN_ALERT_WINDOW_SECONDS / 60);

    if (email && !isAllowlistedQaEmail(email)) {
      const accountHash = subjectHash(`acct:${email}`);
      const count = await bumpFailureCounter(`fl:acct:${accountHash}`);
      if (count >= FAILED_LOGIN_ALERT_THRESHOLD) {
        await dispatchSecurityAlert({
          alertKey: `failed-login:account:${accountHash}`,
          subject: `[LocateFlow] Security alert: failed-login burst on account ${email}`,
          heading: "Failed-login burst — single account",
          rows: [
            ["Account", email],
            ["Failed attempts in window", String(count)],
            ["Window", `${windowMinutes} minutes`],
            ["Threshold", String(FAILED_LOGIN_ALERT_THRESHOLD)],
            ["Client", opts.clientType || null],
            ["When", new Date().toUTCString()],
            [
              "Note",
              "Per-(email,IP,UA) lockout (5 fails / 15 min) is still enforcing. Crossing this threshold usually means the attempts span multiple IPs or user agents.",
            ],
          ],
          metadata: { kind: "security-alert" },
        });
      }
    }

    if (ip) {
      const ipHash = subjectHash(`ip:${ip}`);
      const count = await bumpFailureCounter(`fl:ip:${ipHash}`);
      if (count >= FAILED_LOGIN_ALERT_THRESHOLD) {
        await dispatchSecurityAlert({
          alertKey: `failed-login:ip:${ipHash}`,
          subject: `[LocateFlow] Security alert: failed-login burst from IP ${ip}`,
          heading: "Failed-login burst — single source IP",
          rows: [
            ["Source IP", ip],
            ["Failed attempts in window", String(count)],
            ["Window", `${windowMinutes} minutes`],
            ["Threshold", String(FAILED_LOGIN_ALERT_THRESHOLD)],
            ["Client", opts.clientType || null],
            ["When", new Date().toUTCString()],
            [
              "Note",
              "Per-(email,IP,UA) lockout (5 fails / 15 min) is still enforcing. Crossing this threshold usually means the attempts span multiple accounts (password spraying).",
            ],
          ],
          metadata: { kind: "security-alert" },
        });
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `${LOG_PREFIX} failed-login tracking failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Alarm for a webhook signature/auth failure. No threshold — a single
 * failure is signal (probing, or a broken webhook secret silently dropping
 * billing events). Deduped to one email per UTC day per provider+reason.
 * Never throws; safe to `void` from a webhook handler.
 */
export async function alertWebhookSignatureFailure(opts: {
  provider: SecurityAlertWebhookProvider;
  /** Machine reason, e.g. "signature_verification_failed", "oidc_verify_failed". */
  reason: string;
}): Promise<void> {
  try {
    const reason = (opts.reason || "unspecified")
      .replace(/[^a-zA-Z0-9_.-]/g, "_")
      .slice(0, 64);
    await dispatchSecurityAlert({
      alertKey: `webhook-sig:${opts.provider}:${reason}`,
      subject: `[LocateFlow] Security alert: ${opts.provider} webhook signature/auth failure (${reason})`,
      heading: "Webhook signature/auth failure",
      rows: [
        ["Provider", opts.provider],
        ["Reason", reason],
        [
          "Environment",
          process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
        ],
        ["When", new Date().toUTCString()],
        [
          "Note",
          "The request was rejected — the verification control held. If this is unexpected, check the webhook secret/identity configuration before assuming an attack.",
        ],
      ],
      metadata: { kind: "security-alert", provider: opts.provider },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `${LOG_PREFIX} webhook alert failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/** Test-only: reset the in-process counters and per-day dedupe cache. */
export function __resetSecurityAlertsForTests(): void {
  memCounters.clear();
  alertedDayKeys.clear();
}
