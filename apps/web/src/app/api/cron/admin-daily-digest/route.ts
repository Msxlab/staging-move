import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendLoggedEmail } from "@/lib/email-service";
import { escapeHtml, htmlToPlainText } from "@/lib/email";
import { guardCronRequest } from "@/lib/cron-guard";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { getAdminDigestConfig } from "@/lib/admin-digest-config";
import {
  computeMrr,
  computeMrrMovement,
  computeMonthlyChurnRate,
  type RevenueSub,
} from "@locateflow/shared";

export const runtime = "nodejs";

const REVENUE_SUB_SELECT = {
  plan: true,
  status: true,
  provider: true,
  accessType: true,
  billingInterval: true,
  createdAt: true,
  canceledAt: true,
  trialEndsAt: true,
} as const;

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Signed delta suffix vs a prior window, e.g. "▲ +3 vs prior 24h". */
function deltaSuffix(current: number, prior: number): string {
  const d = current - prior;
  const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "•";
  const color = d > 0 ? "#16a34a" : d < 0 ? "#dc2626" : "#64748b";
  return `<span style="color:${color};">${arrow} ${d >= 0 ? "+" : ""}${d} vs prior 24h</span>`;
}

function formatDateTime(date: Date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function metricCard(label: string, value: number | string, subline?: string) {
  return `
    <td style="width:25%;padding:0 6px 12px;">
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;background:#f8fafc;">
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;">${escapeHtml(label)}</p>
        <p style="margin:0;font-size:24px;line-height:30px;font-weight:700;color:#0f172a;">${typeof value === "number" ? value : escapeHtml(value)}</p>
        ${subline ? `<p style="margin:5px 0 0;font-size:11px;line-height:14px;">${subline}</p>` : ""}
      </div>
    </td>`;
}

function renderList(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return `<p style="margin:0;font-size:13px;color:#64748b;">${escapeHtml(emptyLabel)}</p>`;
  }

  return `<ul style="margin:0;padding-left:18px;">${items
    .map((item) => `<li style="margin:0 0 6px;font-size:13px;line-height:20px;color:#334155;">${item}</li>`)
    .join("")}</ul>`;
}

/**
 * Fire an IMMEDIATE anomaly alert (Slack incoming webhook + high-priority email)
 * when a revenue signal crosses a threshold, so a bad morning doesn't wait for
 * the next scheduled digest read. Uses the same SLACK_WEBHOOK_URL the admin
 * alert-dispatcher uses; best-effort, never throws. A distinct dedupeKey keeps
 * the alert email separate from the digest send.
 */
async function dispatchAnomalyAlert(params: {
  anomalies: string[];
  mrr: number;
  recipients: string[];
  digestDate: string;
  adminBaseUrl: string;
}): Promise<boolean> {
  const { anomalies, mrr, recipients, digestDate, adminBaseUrl } = params;
  let dispatched = false;

  const slackUrl = await getRuntimeConfigValue("SLACK_WEBHOOK_URL").catch(() => null);
  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `:warning: *LocateFlow revenue anomaly* (${digestDate})\n${anomalies.map((a) => `• ${a}`).join("\n")}\nMRR: ${fmtUsd(mrr)}${adminBaseUrl ? `\n${adminBaseUrl}` : ""}`,
        }),
      });
      dispatched = true;
    } catch {
      // best-effort — Slack failure must not block the email alert below
    }
  }

  const html =
    `<div style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">` +
    `<h2 style="color:#dc2626;margin:0 0 10px;">⚠️ Revenue anomaly</h2>` +
    `<ul style="padding-left:18px;">${anomalies.map((a) => `<li style="margin:0 0 6px;color:#334155;">${escapeHtml(a)}</li>`).join("")}</ul>` +
    `<p style="color:#334155;">MRR: <strong>${escapeHtml(fmtUsd(mrr))}</strong></p>` +
    (adminBaseUrl
      ? `<p><a href="${escapeHtml(adminBaseUrl)}" style="color:#2563eb;">Open admin dashboard</a></p>`
      : "") +
    `</div>`;
  for (const to of recipients) {
    await sendLoggedEmail({
      to,
      subject: `⚠️ [LocateFlow] Revenue anomaly - ${digestDate}`,
      html,
      text: htmlToPlainText(html),
      dedupeKey: `cron:admin-digest-anomaly:${digestDate}:${to}`,
      metadata: { kind: "admin-digest-anomaly" },
    }).catch(() => {});
    dispatched = true;
  }
  return dispatched;
}

export async function GET(request: Request) {
  const guard = await guardCronRequest(request, "admin-daily-digest");
  if (!guard.ok) return guard.response;

  const config = await getAdminDigestConfig();
  if (!config.enabled) {
    return NextResponse.json({ ok: true, skipped: "ADMIN_DIGEST_ENABLED is false" });
  }

  // Recipients: every active admin (per-admin fan-out) UNION the configured alert
  // address, MINUS any runtime-config opt-outs. Falls back to the alert address
  // alone when the admin table is empty or unavailable.
  const alertEmail =
    (await getRuntimeConfigValue("ADMIN_ALERT_EMAIL")) ||
    (await getRuntimeConfigValue("ALERT_EMAIL_TO"));
  const activeAdmins = await prisma.adminUser
    .findMany({ where: { isActive: true }, select: { email: true } })
    .catch(() => [] as Array<{ email: string }>);
  const recipientSet = new Set<string>();
  if (alertEmail) recipientSet.add(alertEmail.trim().toLowerCase());
  for (const admin of activeAdmins) {
    if (admin.email) recipientSet.add(admin.email.trim().toLowerCase());
  }
  for (const excluded of config.excludeEmails) recipientSet.delete(excluded);
  const recipients = [...recipientSet].filter(Boolean);
  if (recipients.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: "no digest recipients (ADMIN_ALERT_EMAIL unset and no active admins)",
    });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const digestDate = now.toISOString().slice(0, 10);

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const priorSince = new Date(since.getTime() - 24 * 60 * 60 * 1000);
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    newUsers,
    newUserCount,
    priorNewUserCount,
    canceledSubscriptions,
    pastDueCount,
    supportTicketCount,
    supportTickets,
    activeSubs,
    canceledThisMonth,
    trialsExpiring,
    pendingGdprCount,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: since }, deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.user.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
    prisma.user.count({ where: { createdAt: { gte: priorSince, lt: since }, deletedAt: null } }),
    prisma.subscription.count({ where: { canceledAt: { gte: since } } }),
    // Real billing-distress signal (replaces the fragile emailLog substring match):
    // subscriptions Stripe/store reconciliation has marked PAST_DUE.
    prisma.subscription.count({ where: { status: "PAST_DUE" } }),
    prisma.supportTicket.count({ where: { createdAt: { gte: since } } }),
    prisma.supportTicket.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        subject: true,
        priority: true,
        status: true,
        category: true,
        createdAt: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // Revenue inputs — the same Subscription rows the admin billing dashboard
    // reads, priced through the shared computeMrr/movement/churn helpers.
    prisma.subscription.findMany({ where: { status: { in: ["ACTIVE", "TRIALING"] } }, select: REVENUE_SUB_SELECT }),
    prisma.subscription.findMany({ where: { status: "CANCELED", canceledAt: { gte: monthStart } }, select: REVENUE_SUB_SELECT }),
    // Action-queue inputs.
    prisma.subscription.findMany({
      where: { status: "TRIALING", trialEndsAt: { gte: now, lte: in7d } },
      select: { id: true, plan: true, trialEndsAt: true, user: { select: { id: true, email: true } } },
      orderBy: { trialEndsAt: "asc" },
      take: 10,
    }),
    prisma.gDPRRequest.count({ where: { type: "DELETE", status: { in: ["PENDING", "PROCESSING"] } } }),
  ]);

  const mrr = computeMrr(activeSubs as RevenueSub[]);
  const movement = computeMrrMovement({
    subs: [...activeSubs, ...canceledThisMonth] as RevenueSub[],
    windowStart: since,
    windowEnd: now,
  });
  const churnPct = computeMonthlyChurnRate({
    activeSubs: activeSubs as RevenueSub[],
    canceledInMonth: canceledThisMonth as RevenueSub[],
    monthStart,
  });
  const netMrrText = `${movement.netMrr >= 0 ? "+" : "−"}${fmtUsd(Math.abs(movement.netMrr))}`;

  // Deep-link each row into the admin panel so an operator can act in one click
  // instead of opening the panel and searching. Resolve the canonical admin URL
  // from runtime config (falls back to the build-time public env). htmlToPlainText
  // renders <a> as "label: url", so the plaintext part stays clean.
  const adminBaseUrl = (
    (await getRuntimeConfigValue("NEXT_PUBLIC_ADMIN_URL")) ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    ""
  ).replace(/\/+$/, "");
  const adminLink = (path: string, label: string): string => {
    const safeLabel = escapeHtml(label);
    if (!adminBaseUrl) return `<strong>${safeLabel}</strong>`;
    return `<a href="${escapeHtml(`${adminBaseUrl}${path}`)}" style="color:#2563eb;text-decoration:underline;font-weight:600;">${safeLabel}</a>`;
  };

  const newUserItems = newUsers.map((user) => {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
    const label = name ? `${name} (${user.email})` : user.email;
    return `${adminLink(`/users/${user.id}`, label)} signed up at ${escapeHtml(formatDateTime(user.createdAt))}`;
  });

  const supportItems = supportTickets.map((ticket) => (
    `<strong>${escapeHtml(ticket.priority)}</strong> ${adminLink("/support", ticket.subject)} ` +
    `<span style="color:#64748b;">(${escapeHtml(ticket.status)}, ${escapeHtml(ticket.category)}, ${escapeHtml(ticket.user.email)})</span>`
  ));

  // "What needs a human today" — surfaces the work an operator would otherwise
  // have to hunt for across the subscriptions, users, and security pages.
  const actionQueueItems: string[] = [];
  if (pastDueCount > 0) {
    actionQueueItems.push(
      `<strong>${pastDueCount}</strong> ${adminLink("/subscriptions?status=PAST_DUE", "subscription(s) past due")} — payment needs attention`,
    );
  }
  if (pendingGdprCount > 0) {
    actionQueueItems.push(
      `<strong>${pendingGdprCount}</strong> ${adminLink("/security/dashboard", "pending data-deletion request(s)")} awaiting completion`,
    );
  }
  for (const trial of trialsExpiring) {
    const days = Math.max(0, Math.ceil((new Date(trial.trialEndsAt as Date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    const who = trial.user?.email || trial.id;
    actionQueueItems.push(
      `Trial ending in <strong>${days}d</strong> — ${adminLink(`/users/${trial.user?.id ?? ""}`, who)} <span style="color:#64748b;">(${escapeHtml(trial.plan)})</span>`,
    );
  }

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 12px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">${escapeHtml(formatDateTime(since))} to ${escapeHtml(formatDateTime(now))}</p>
      <h1 style="margin:0 0 20px;font-size:24px;line-height:30px;color:#0f172a;">LocateFlow admin daily digest</h1>
      <h2 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#475569;">Revenue &amp; growth</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 -6px 8px;">
        <tr>
          ${metricCard("MRR", fmtUsd(mrr))}
          ${metricCard("Net new MRR (24h)", netMrrText)}
          ${metricCard("Churn (mo)", `${churnPct.toFixed(1)}%`)}
          ${metricCard("Trials ≤7d", trialsExpiring.length)}
        </tr>
      </table>
      <h2 style="margin:14px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#475569;">Activity (last 24h)</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 -6px 8px;">
        <tr>
          ${metricCard("New signups", newUserCount, deltaSuffix(newUserCount, priorNewUserCount))}
          ${metricCard("Canceled subs", canceledSubscriptions)}
          ${metricCard("Past due", pastDueCount)}
          ${metricCard("Support tickets", supportTicketCount)}
        </tr>
      </table>
      <h2 style="margin:18px 0 8px;font-size:15px;color:#0f172a;">Action queue</h2>
      ${renderList(actionQueueItems, "Nothing needs attention right now. 🎉")}
      <h2 style="margin:18px 0 8px;font-size:15px;color:#0f172a;">New users</h2>
      ${renderList(newUserItems, "No new user signups in this window.")}
      <h2 style="margin:18px 0 8px;font-size:15px;color:#0f172a;">Support tickets</h2>
      ${renderList(supportItems, "No new support tickets in this window.")}
      ${adminBaseUrl
        ? `<div style="margin-top:22px;text-align:center;">
        <a href="${escapeHtml(adminBaseUrl)}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 22px;border-radius:8px;">Open admin dashboard</a>
      </div>`
        : ""}
    </div>
  </div>
</body>
</html>`;

  // Quiet-day suppression: when opted in, don't send an all-zero digest.
  const nothingHappened =
    newUserCount === 0 &&
    canceledSubscriptions === 0 &&
    pastDueCount === 0 &&
    supportTicketCount === 0 &&
    trialsExpiring.length === 0 &&
    pendingGdprCount === 0;
  if (config.skipIfEmpty && nothingHappened) {
    return NextResponse.json({ ok: true, skipped: "empty digest suppressed (ADMIN_DIGEST_SKIP_IF_EMPTY)" });
  }

  const subject = `LocateFlow admin daily digest - ${digestDate}`;
  const text = htmlToPlainText(html);
  // Per-admin fan-out with a per-recipient dedupeKey so each send is logged and
  // deduplicated independently.
  const sendResults = await Promise.all(
    recipients.map((to) =>
      sendLoggedEmail({
        to,
        subject,
        html,
        text,
        dedupeKey: `cron:admin-daily-digest:${digestDate}:${to}`,
        metadata: { kind: "admin-daily-digest" },
      }).catch(() => ({ success: false, skipped: "send_failed" as string | undefined })),
    ),
  );
  const sent = sendResults.filter((r) => r.success).length;

  // Immediate anomaly escalation — a bad morning shouldn't wait for the read.
  const anomalies: string[] = [];
  if (churnPct > config.minChurnAlertPct) {
    anomalies.push(`Monthly churn ${churnPct.toFixed(1)}% (above ${config.minChurnAlertPct}% threshold)`);
  }
  if (movement.netMrr < 0) {
    anomalies.push(`Net MRR contracting: ${netMrrText} in the last 24h`);
  }
  const anomalyAlerted =
    anomalies.length > 0
      ? await dispatchAnomalyAlert({ anomalies, mrr, recipients, digestDate, adminBaseUrl })
      : false;

  return NextResponse.json({
    ok: sent > 0,
    recipients: recipients.length,
    sent,
    anomalyAlerted,
    counts: {
      newUsers: newUserCount,
      canceledSubscriptions,
      pastDue: pastDueCount,
      supportTickets: supportTicketCount,
      trialsExpiring: trialsExpiring.length,
      pendingGdpr: pendingGdprCount,
    },
    revenue: {
      mrr: Math.round(mrr * 100) / 100,
      netNewMrr: movement.netMrr,
      churnPct: Math.round(churnPct * 10) / 10,
    },
  });
}
