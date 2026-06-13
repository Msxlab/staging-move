/**
 * Adaptive (risk-based) admin login signal: is this login coming from a
 * network the operator normally uses?
 *
 * An IP is "known" when its /24 (IPv4) or /64 (IPv6) network bucket matches a
 * recent successful admin session for the same admin. Same bucket tolerates
 * normal dynamic-ISP churn while a genuinely different network/country reads as
 * anomalous. The very first login (no baseline sessions) is treated as known —
 * there is nothing to compare against, so it cannot be "unusual".
 *
 * Used by the login route to FORCE a fresh MFA challenge (ignore the
 * trusted-device cookie) and email the operator when the network is new, while
 * keeping the usual device + network friction-free.
 */
import { prisma } from "./db";
import { bucketClientIp } from "./session-fingerprint";
import { sendEmail } from "./email";

const KNOWN_IP_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // look back 90 days

export async function isKnownAdminLoginIp(adminId: string, ip: string): Promise<boolean> {
  const bucket = bucketClientIp(ip);
  const since = new Date(Date.now() - KNOWN_IP_WINDOW_MS);
  try {
    const rows = await prisma.adminSession.findMany({
      where: { adminUserId: adminId, ipAddress: { not: null }, createdAt: { gte: since } },
      select: { ipAddress: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    if (!Array.isArray(rows) || rows.length === 0) return true; // no baseline → not anomalous
    return rows.some((r) => r.ipAddress != null && bucketClientIp(r.ipAddress) === bucket);
  } catch {
    // Fail open: if we can't read the baseline, don't add login friction.
    return true;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Email the operator that their admin account was accessed from a network we
 * haven't seen before. Best-effort: never throws, so a mail outage can't block
 * the login flow. The login itself still required a fresh MFA challenge.
 */
export async function sendAdminNewLocationAlert(opts: {
  to: string;
  ip: string;
  userAgent: string;
  country?: string | null;
  when: Date;
}): Promise<void> {
  const where = opts.country ? `${opts.ip} (${opts.country})` : opts.ip;
  const subject = "Security alert: new sign-in to your LocateFlow admin account";
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:540px;color:#1a2330">
      <h2 style="margin:0 0 10px;font-size:18px">New sign-in from an unrecognized network</h2>
      <p style="line-height:1.5">A sign-in to your <b>LocateFlow Admin</b> account came from a network we haven't seen before. You were asked to confirm it with two-factor authentication.</p>
      <table style="font-size:14px;border-collapse:collapse;margin:14px 0">
        <tr><td style="padding:4px 16px 4px 0;color:#667">IP address</td><td><b>${escapeHtml(where)}</b></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#667">Device</td><td>${escapeHtml(opts.userAgent.slice(0, 180))}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#667">Time (UTC)</td><td>${opts.when.toUTCString()}</td></tr>
      </table>
      <p style="line-height:1.5"><b>If this wasn't you:</b> change your password immediately and revoke active sessions from <i>Settings → Security</i>.</p>
      <p style="color:#8a93a0;font-size:12px;margin-top:18px">Automated security alert from LocateFlow Admin. You are receiving this because the sign-in network was new.</p>
    </div>`;
  await sendEmail({ to: opts.to, subject, html }).catch(() => undefined);
}
