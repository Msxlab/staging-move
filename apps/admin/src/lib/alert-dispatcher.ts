/**
 * Alert Dispatcher — sends real-time notifications for security events.
 *
 * Supports:
 *   - Email via Resend (RESEND_API_KEY + ALERT_EMAIL_TO)
 *   - Slack via Incoming Webhook (SLACK_WEBHOOK_URL)
 *
 * Only dispatches for HIGH and CRITICAL severity events.
 * Non-blocking — failures are logged but never throw.
 */

import { getAdminRuntimeConfigValues } from "@/lib/runtime-config";

type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface AlertPayload {
  type: string;
  severity: AlertSeverity;
  ip: string;
  details: string;
  adminId?: string;
  timestamp: Date;
}

// Dedup: don't send the same alert type more than once per 5 minutes
const recentAlerts = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentAlerts) {
    if (now - ts > DEDUP_WINDOW_MS) recentAlerts.delete(key);
  }
}, 5 * 60 * 1000);

function shouldDispatch(severity: AlertSeverity, type: string): boolean {
  if (severity !== "HIGH" && severity !== "CRITICAL") return false;

  const key = `${type}:${severity}`;
  const last = recentAlerts.get(key);
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return false;

  // The dedup marker is recorded in dispatchAlert *after* a channel actually
  // delivers — not here — so a transient double-failure doesn't silently
  // suppress the next identical alert for the whole dedup window.
  return true;
}

// ── Email via Resend ───────────────────────────────────────

async function sendEmailAlert(payload: AlertPayload): Promise<boolean> {
  const {
    RESEND_API_KEY: apiKey,
    ALERT_EMAIL_TO: to,
    ALERT_EMAIL_FROM: alertFrom,
    EMAIL_FROM: emailFrom,
  } = await getAdminRuntimeConfigValues([
    "RESEND_API_KEY",
    "ALERT_EMAIL_TO",
    "ALERT_EMAIL_FROM",
    "EMAIL_FROM",
  ]);
  if (!apiKey || !to) return false;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const severityEmoji = payload.severity === "CRITICAL" ? "🚨" : "⚠️";
    const subject = `${severityEmoji} [LocateFlow] ${payload.severity} Security Alert: ${payload.type}`;
    const from =
      alertFrom ||
      emailFrom ||
      process.env.RESEND_FROM ||
      process.env.MAIL_FROM ||
      "LocateFlow Alerts <notifications@locateflow.com>";

    await resend.emails.send({
      from,
      to: to.split(",").map((e) => e.trim()),
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: ${payload.severity === "CRITICAL" ? "#dc2626" : "#f59e0b"};">
            ${severityEmoji} ${payload.severity} Security Alert
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold;">Event Type</td><td style="padding: 8px;">${payload.type}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Severity</td><td style="padding: 8px;">${payload.severity}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">IP Address</td><td style="padding: 8px;">${payload.ip}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Details</td><td style="padding: 8px;">${payload.details}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Admin ID</td><td style="padding: 8px;">${payload.adminId || "N/A"}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Time</td><td style="padding: 8px;">${payload.timestamp.toISOString()}</td></tr>
          </table>
          <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">
            This is an automated security alert from LocateFlow Admin Panel.
          </p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("[ALERT-DISPATCH] Email send failed:", err);
    return false;
  }
}

// ── Slack via Incoming Webhook ─────────────────────────────

async function sendSlackAlert(payload: AlertPayload): Promise<boolean> {
  const { SLACK_WEBHOOK_URL: webhookUrl } = await getAdminRuntimeConfigValues(["SLACK_WEBHOOK_URL"]);
  if (!webhookUrl) return false;

  try {
    const severityEmoji = payload.severity === "CRITICAL" ? ":rotating_light:" : ":warning:";
    const color = payload.severity === "CRITICAL" ? "#dc2626" : "#f59e0b";

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [
          {
            color,
            blocks: [
              {
                type: "header",
                text: { type: "plain_text", text: `${severityEmoji} ${payload.severity}: ${payload.type}` },
              },
              {
                type: "section",
                fields: [
                  { type: "mrkdwn", text: `*IP:* ${payload.ip}` },
                  { type: "mrkdwn", text: `*Admin:* ${payload.adminId || "N/A"}` },
                  { type: "mrkdwn", text: `*Time:* ${payload.timestamp.toISOString()}` },
                ],
              },
              {
                type: "section",
                text: { type: "mrkdwn", text: `*Details:*\n${payload.details}` },
              },
            ],
          },
        ],
      }),
    });
    return true;
  } catch (err) {
    console.error("[ALERT-DISPATCH] Slack send failed:", err);
    return false;
  }
}

// ── Public API ─────────────────────────────────────────────

export async function dispatchAlert(
  type: string,
  severity: AlertSeverity,
  ip: string,
  details: string,
  adminId?: string
): Promise<void> {
  if (!shouldDispatch(severity, type)) return;

  const payload: AlertPayload = {
    type,
    severity,
    ip,
    details,
    adminId,
    timestamp: new Date(),
  };

  // Send on both channels; record the dedup marker only if at least one
  // actually delivered, so a transient double-failure can retry on the next
  // identical event instead of being silently suppressed for the window.
  const results = await Promise.allSettled([
    sendEmailAlert(payload),
    sendSlackAlert(payload),
  ]);
  const delivered = results.some((r) => r.status === "fulfilled" && r.value === true);
  if (delivered) {
    recentAlerts.set(`${type}:${severity}`, Date.now());
  }
}
