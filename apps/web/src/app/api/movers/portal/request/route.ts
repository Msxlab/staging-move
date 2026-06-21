import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { sendEmail, renderLocateFlowEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/seo";
import { requestMoverPortalLink } from "@/lib/mover-portal-auth";

// POST /api/movers/portal/request — email an approved mover a magic link to its
// self-service portal. Always answers with a generic success (no account
// enumeration); only sends mail when the email matches an approved, listed
// mover. Rate-limited per IP and per normalized email.

export const runtime = "nodejs";

const GENERIC = { ok: true, message: "If that email is on file for an approved mover, we've sent a sign-in link." };

export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit(getRateLimitKey(request, "mover-portal-request"), {
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
    if (!normalizedEmail) return NextResponse.json(GENERIC); // never reveal which inputs are valid

    const emailRl = await rateLimit(`mover-portal-request:email:${normalizedEmail}`, {
      limit: 4,
      windowSeconds: 60 * 60,
      failClosed: "if-redis-configured",
    });
    if (!emailRl.success) return NextResponse.json(GENERIC);

    const issued = await requestMoverPortalLink(normalizedEmail).catch(() => null);
    if (issued) {
      const link = absoluteUrl(`/movers/portal/enter?token=${encodeURIComponent(issued.token)}`);
      const html = renderLocateFlowEmail({
        preheader: "Your LocateFlow mover portal sign-in link.",
        title: "Sign in to your mover portal",
        badge: "Link expires in 24 hours",
        bodyHtml: `<p>Use the button below to manage <strong>${escapeHtml(issued.companyName)}</strong>'s LocateFlow listing — view your stats and buy a sponsored placement.</p>`,
        cta: { href: link, label: "Open mover portal" },
        linkFallback: true,
        securityNote: true,
      });
      await sendEmail({
        to: normalizedEmail,
        subject: "Your LocateFlow mover portal link",
        html,
        text: `Sign in to your LocateFlow mover portal: ${link}`,
      }).catch(() => {});
    }

    return NextResponse.json(GENERIC);
  } catch {
    // Even on error, don't leak — the generic answer is safe.
    return NextResponse.json(GENERIC);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
