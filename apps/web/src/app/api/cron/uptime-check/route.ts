import { NextRequest, NextResponse } from "next/server";
import { resolveAdminAlertRecipients } from "@/lib/admin-alerts";
import { guardCronRequest } from "@/lib/cron-guard";
import { escapeHtml, htmlToPlainText } from "@/lib/email";
import { sendLoggedEmail } from "@/lib/email-service";
import { recordIntegrationOutcome } from "@/lib/integration-telemetry";
import { SITE_NAME } from "@/lib/seo";

export const runtime = "nodejs";

// Free synthetic uptime monitor — GitHub Actions calls this route ~every 15
// minutes (cron.yml `uptime` job, CRON_SECRET-guarded like every other
// /api/cron/* route). The route probes the public surfaces SERVER-SIDE:
//
//   1. web-home    GET https://locateflow.com/            → 200 + the
//      SITE_NAME marker in the body (a 200 splash/maintenance page that lost
//      the brand string still counts as DOWN);
//   2. web-health  GET https://locateflow.com/api/health  → 200 (the health
//      route itself 503s when the DB is unreachable, so this leg covers the
//      database too);
//   3. admin-login GET https://admin.locateflow.com/login → 200.
//
// Each probe has a hard 5s AbortController timeout. On ANY failure the route:
//   - leaves a console.error breadcrumb per failed target;
//   - emails the admin alert recipients via the existing owner-alert
//     transport (lib/admin-alerts recipient resolution + sendLoggedEmail),
//     deduped to ONE email per UTC day per target per recipient
//     (`cron:uptime-alert:<target>:<day>:<to>`), so a continuous outage
//     emails once a day per target instead of every 15 minutes;
//   - records one integration-telemetry outcome per target under source
//     "uptime" ("ok" | "error"), so the admin Insights health panel charts
//     availability for free (unknown sources are auto-appended there).
//
// SELF-HOSTING CAVEAT: this route runs ON the same web app it monitors. If
// the web app is fully down, the route never executes (and could not email
// anyway) — but then GHA's call to this endpoint gets a non-2xx, the `uptime`
// workflow job FAILS, and GitHub's own default workflow-failure notification
// email is the backstop alert for total outage. That is why the GHA job must
// NOT set continue-on-error, and why this route returns HTTP 200 even when
// probes fail: the job (and its failure email) should only fire when the app
// hosting the monitor cannot answer at all.
//
// Contract: never throws; always answers a JSON summary.

/** Hard per-probe timeout (spec: 5s AbortController). */
export const PROBE_TIMEOUT_MS = 5_000;

export interface UptimeTarget {
  /** Stable id — telemetry/dedupe/breadcrumb key; never derived from the URL. */
  id: string;
  /** Human label for the alert email. */
  label: string;
  url: string;
  /**
   * Optional marker that must appear in a 200 body. Guards against a proxy
   * or error page answering 200 without actually being the app.
   */
  marker?: string;
}

export interface ProbeOutcome {
  id: string;
  label: string;
  url: string;
  ok: boolean;
  /** HTTP status when a response arrived; null on network failure/timeout. */
  status: number | null;
  /** Machine reason when !ok: "http_<code>" | "marker_missing" | "timeout" | "fetch_failed". */
  reason: string | null;
  /** Wall-clock probe duration. */
  ms: number;
}

/**
 * Pure verdict for one probe response (exported for the colocated test).
 * 200 + (marker present when required) is UP; anything else is DOWN with a
 * machine reason.
 */
export function evaluateProbeResponse(
  target: Pick<UptimeTarget, "marker">,
  status: number,
  body: string | null,
): { ok: boolean; reason: string | null } {
  if (status !== 200) return { ok: false, reason: `http_${status}` };
  if (target.marker && !(body ?? "").includes(target.marker)) {
    return { ok: false, reason: "marker_missing" };
  }
  return { ok: true, reason: null };
}

/**
 * Probe targets. Hard-coded to the public production surfaces by design (the
 * monitor exists to see what a real visitor sees); UPTIME_*_BASE_URL env
 * overrides exist for staging/local smoke tests only.
 */
export function buildTargets(): UptimeTarget[] {
  const webBase = (process.env.UPTIME_WEB_BASE_URL || "https://locateflow.com").replace(/\/+$/, "");
  const adminBase = (
    process.env.UPTIME_ADMIN_BASE_URL ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    "https://admin.locateflow.com"
  ).replace(/\/+$/, "");
  return [
    {
      id: "web-home",
      label: "Web home page",
      url: `${webBase}/`,
      // SITE_NAME ("LocateFlow") is in the rendered <title> and shell on every
      // build — a 200 without it is a masquerading error page.
      marker: SITE_NAME,
    },
    {
      id: "web-health",
      label: "Web health endpoint (DB-backed)",
      url: `${webBase}/api/health`,
    },
    {
      id: "admin-login",
      label: "Admin login page",
      url: `${adminBase}/login`,
    },
  ];
}

/** One GET probe with a hard 5s abort. Never throws. */
async function probeTarget(target: UptimeTarget): Promise<ProbeOutcome> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(target.url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "LocateFlow-Uptime-Check/1.0 (synthetic monitor; GitHub Actions cron)",
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
    });
    // Body is only needed for the marker check, and only on a 200 (the abort
    // signal also covers the body read, so a stalled body still times out).
    const body = target.marker && res.status === 200 ? await res.text() : null;
    const verdict = evaluateProbeResponse(target, res.status, body);
    return {
      id: target.id,
      label: target.label,
      url: target.url,
      ok: verdict.ok,
      status: res.status,
      reason: verdict.reason,
      ms: Date.now() - startedAt,
    };
  } catch (error) {
    const timedOut = controller.signal.aborted;
    return {
      id: target.id,
      label: target.label,
      url: target.url,
      ok: false,
      status: null,
      reason: timedOut ? "timeout" : "fetch_failed",
      ms: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildUptimeAlertHtml(failure: ProbeOutcome, dayStamp: string): string {
  const rows: Array<[string, string]> = [
    ["Target", failure.label],
    ["URL", failure.url],
    ["Reason", failure.reason ?? "unknown"],
    ["HTTP status", failure.status === null ? "no response" : String(failure.status)],
    ["Probe duration", `${failure.ms} ms`],
    ["When", new Date().toUTCString()],
  ];
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<li style="margin:0 0 6px;color:#334155;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`,
    )
    .join("");
  return (
    `<div style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">` +
    `<h2 style="color:#b91c1c;margin:0 0 10px;">Uptime alert — ${escapeHtml(failure.label)} is DOWN</h2>` +
    `<ul style="padding-left:18px;margin:0;">${rowsHtml}</ul>` +
    `<p style="margin:12px 0 0;color:#64748b;font-size:13px;">The synthetic monitor re-probes every ~15 minutes but this alert is deduped to once per target per UTC day (${escapeHtml(dayStamp)}) — check the admin Insights panel (source &quot;uptime&quot;) or server logs for live status.</p>` +
    `</div>`
  );
}

/**
 * Email every configured admin-alert recipient about each failed target,
 * deduped to once per UTC day per target per recipient via the emailLog
 * dedupeKey (the same once-a-day mechanism as the security/admin alerts).
 * Returns the number of emails actually sent (dedupe hits don't count).
 */
async function dispatchUptimeAlerts(failures: ProbeOutcome[]): Promise<number> {
  const recipients = await resolveAdminAlertRecipients();
  if (recipients.length === 0) {
    // Breadcrumb-only degradation — log-based alerting still has a hook.
    console.error(
      "[UPTIME] no alert recipients configured (ADMIN_ALERT_EMAIL / ALERT_EMAIL_TO) — email alert skipped",
    );
    return 0;
  }

  const dayStamp = new Date().toISOString().slice(0, 10);
  let sent = 0;
  for (const failure of failures) {
    const html = buildUptimeAlertHtml(failure, dayStamp);
    const text = htmlToPlainText(html);
    for (const to of recipients) {
      const result = await sendLoggedEmail({
        to,
        subject: `[LocateFlow] Uptime alert: ${failure.label} is DOWN`,
        html,
        text,
        // `:<to>` suffix because dedupeKey is globally unique — without it the
        // second recipient would be skipped as a duplicate (same per-recipient
        // pattern as admin-alerts / security-alerts / the admin digest).
        dedupeKey: `cron:uptime-alert:${failure.id}:${dayStamp}:${to}`,
        metadata: {
          kind: "uptime-alert",
          target: failure.id,
          reason: failure.reason,
          status: failure.status,
        },
      }).catch((err) => {
        console.warn(
          `[UPTIME] alert send failed (${failure.id}):`,
          err instanceof Error ? err.message : err,
        );
        return null;
      });
      if (result?.success) sent++;
    }
  }
  return sent;
}

async function handleCron(request: NextRequest) {
  const guard = await guardCronRequest(request, "uptime-check");
  if (!guard.ok) return guard.response;

  try {
    const targets = buildTargets();
    // Parallel probes — worst case the run takes one 5s timeout, not three.
    const results = await Promise.all(targets.map((target) => probeTarget(target)));

    // Telemetry first (fire-and-forget, never throws): one outcome per target
    // so the Insights error-share math IS the availability chart.
    for (const result of results) {
      recordIntegrationOutcome("uptime", result.ok ? "ok" : "error");
    }

    const failures = results.filter((result) => !result.ok);
    for (const failure of failures) {
      console.error(
        `[UPTIME] target DOWN: ${failure.id} (${failure.url}) — ${failure.reason}` +
          (failure.status !== null ? ` (HTTP ${failure.status})` : ""),
      );
    }

    const alertsSent = failures.length > 0 ? await dispatchUptimeAlerts(failures) : 0;

    // Always 200: probe failures alert via email + telemetry, NOT via the GHA
    // job — the job's failure email is reserved for "this app is fully down"
    // (see the self-hosting caveat in the module docblock).
    return NextResponse.json({
      ok: failures.length === 0,
      checked: results.length,
      failures: failures.length,
      alertsSent,
      targets: results,
    });
  } catch (error) {
    // Contract: never throws, never non-2xx for internal errors.
    console.error("[UPTIME] uptime-check cron failed:", error);
    return NextResponse.json({ ok: false, error: "uptime-check failed" });
  }
}

// GitHub Actions cron hits GET; POST kept for parity with the other cron routes.
export async function GET(request: NextRequest) { return handleCron(request); }
export async function POST(request: NextRequest) { return handleCron(request); }
