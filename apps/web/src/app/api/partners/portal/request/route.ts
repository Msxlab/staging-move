import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { sendEmail, renderLocateFlowEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/seo";
import { requestPartnerPortalLink } from "@/lib/partner-portal-auth";

// POST /api/partners/portal/request — email an approved partner a magic link to
// its self-service portal (R4d). Always answers generically (no account
// enumeration); only sends when the email matches an approved partner.
export const runtime = "nodejs";

const GENERIC = { ok: true, message: "If that email is on file for an approved partner, we've sent a sign-in link." };

export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit(getRateLimitKey(request, "partner-portal-request"), {
      limit: 6,
      windowSeconds: 60 * 60,
      failClosed: "if-redis-configured",
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email : "";
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return NextResponse.json(GENERIC);

    // Per-email cap so a single address can't be flooded with links across
    // rotating IPs (audit P2). Answer generically on throttle (no enumeration).
    const emailRl = await rateLimit(`partner-portal-request:email:${normalizedEmail}`, {
      limit: 4,
      windowSeconds: 60 * 60,
      failClosed: "if-redis-configured",
    });
    if (!emailRl.success) return NextResponse.json(GENERIC);

    const issued = await requestPartnerPortalLink(normalizedEmail).catch(() => null);
    if (issued) {
      const link = absoluteUrl(`/partners/portal/enter?token=${encodeURIComponent(issued.token)}`);
      const html = renderLocateFlowEmail({
        preheader: "Your LocateFlow partner portal sign-in link.",
        title: "Sign in to your partner portal",
        badge: "Link expires in 24 hours",
        bodyHtml: `<p>Use the button below to view leads for <strong>${escapeHtml(issued.companyName)}</strong> on LocateFlow.</p>`,
        cta: { href: link, label: "Open partner portal" },
        linkFallback: true,
        securityNote: true,
      });
      await sendEmail({
        to: normalizedEmail,
        subject: "Your LocateFlow partner portal link",
        html,
        text: `Sign in to your LocateFlow partner portal: ${link}`,
      }).catch(() => {});
    }

    return NextResponse.json(GENERIC);
  } catch {
    return NextResponse.json(GENERIC);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
