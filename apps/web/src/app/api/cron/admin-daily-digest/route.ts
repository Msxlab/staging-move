import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendLoggedEmail } from "@/lib/email-service";
import { escapeHtml, htmlToPlainText } from "@/lib/email";
import { guardCronRequest } from "@/lib/cron-guard";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

export const runtime = "nodejs";

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

function metricCard(label: string, value: number) {
  return `
    <td style="width:25%;padding:0 6px 12px;">
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;background:#f8fafc;">
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;">${escapeHtml(label)}</p>
        <p style="margin:0;font-size:24px;line-height:30px;font-weight:700;color:#0f172a;">${value}</p>
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

export async function GET(request: Request) {
  const guard = await guardCronRequest(request, "admin-daily-digest");
  if (!guard.ok) return guard.response;

  const adminEmail =
    (await getRuntimeConfigValue("ADMIN_ALERT_EMAIL")) ||
    (await getRuntimeConfigValue("ALERT_EMAIL_TO"));
  if (!adminEmail) {
    return NextResponse.json({ ok: true, skipped: "ADMIN_ALERT_EMAIL or ALERT_EMAIL_TO not configured" });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const digestDate = now.toISOString().slice(0, 10);

  const [
    newUsers,
    newUserCount,
    canceledSubscriptions,
    paymentFailures,
    supportTicketCount,
    supportTickets,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: since }, deletedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.user.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
    prisma.subscription.count({ where: { canceledAt: { gte: since } } }),
    prisma.emailLog.count({
      where: {
        createdAt: { gte: since },
        metadata: { contains: "payment-failed" },
      },
    }),
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
  ]);

  const newUserItems = newUsers.map((user) => {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
    const label = name ? `${name} (${user.email})` : user.email;
    return `<strong>${escapeHtml(label)}</strong> signed up at ${escapeHtml(formatDateTime(user.createdAt))}`;
  });

  const supportItems = supportTickets.map((ticket) => (
    `<strong>${escapeHtml(ticket.priority)}</strong> ${escapeHtml(ticket.subject)} ` +
    `<span style="color:#64748b;">(${escapeHtml(ticket.status)}, ${escapeHtml(ticket.category)}, ${escapeHtml(ticket.user.email)})</span>`
  ));

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 12px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">${escapeHtml(formatDateTime(since))} to ${escapeHtml(formatDateTime(now))}</p>
      <h1 style="margin:0 0 20px;font-size:24px;line-height:30px;color:#0f172a;">LocateFlow admin daily digest</h1>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 -6px 8px;">
        <tr>
          ${metricCard("New signups", newUserCount)}
          ${metricCard("Canceled subs", canceledSubscriptions)}
          ${metricCard("Payment fails", paymentFailures)}
          ${metricCard("Support tickets", supportTicketCount)}
        </tr>
      </table>
      <h2 style="margin:18px 0 8px;font-size:15px;color:#0f172a;">New users</h2>
      ${renderList(newUserItems, "No new user signups in this window.")}
      <h2 style="margin:18px 0 8px;font-size:15px;color:#0f172a;">Support tickets</h2>
      ${renderList(supportItems, "No new support tickets in this window.")}
    </div>
  </div>
</body>
</html>`;

  const subject = `LocateFlow admin daily digest - ${digestDate}`;
  const result = await sendLoggedEmail({
    to: adminEmail,
    subject,
    html,
    text: htmlToPlainText(html),
    dedupeKey: `cron:admin-daily-digest:${digestDate}`,
    metadata: { kind: "admin-daily-digest" },
  });

  return NextResponse.json({
    ok: result.success,
    skipped: result.skipped,
    counts: {
      newUsers: newUserCount,
      canceledSubscriptions,
      paymentFailures,
      supportTickets: supportTicketCount,
    },
  });
}
