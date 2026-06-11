import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { sendEmail, renderLocateFlowEmail } from "@/lib/email";
import { getMoverPortalSession } from "@/lib/mover-portal-auth";
import { US_STATES } from "@locateflow/shared";

// POST /api/movers/portal/placements/request — a signed-in, eligible mover
// requests a sponsored placement (state + duration). Emails the ops inbox; the
// team sets it up via the admin sponsored tool. (A fully self-serve Stripe
// checkout is a planned follow-up — see the deferred note.)

export const runtime = "nodejs";

const VALID_STATES = new Set<string>(US_STATES.map((s) => s.value));
const VALID_DURATIONS = new Set([30, 60, 90]);

export async function POST(request: NextRequest) {
  try {
    const session = await getMoverPortalSession();
    if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const body = await request.json().catch(() => null);
    const stateScope = String(body?.stateScope ?? "").trim().toUpperCase();
    const durationDays = Number(body?.durationDays);
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";

    if (!VALID_STATES.has(stateScope)) return NextResponse.json({ error: "Pick a valid state." }, { status: 400 });
    if (!VALID_DURATIONS.has(durationDays)) return NextResponse.json({ error: "Pick a valid duration." }, { status: 400 });

    const company = await prisma.movingCompany.findUnique({
      where: { id: session.movingCompanyId },
      select: { legalName: true, usdotNumber: true, active: true, hhgAuthorization: true, complaintCount2y: true },
    });
    if (!company) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    // Mirror the sponsored eligibility gate (active + HHG + complaint ceiling 10).
    if (!company.active || !company.hhgAuthorization || company.complaintCount2y > 10) {
      return NextResponse.json({ error: "Your listing isn't eligible for sponsored placements." }, { status: 403 });
    }

    const to =
      (await getRuntimeConfigValue("ADMIN_ALERT_EMAIL").catch(() => null))?.trim() ||
      (await getRuntimeConfigValue("SUPPORT_EMAIL").catch(() => null))?.trim() ||
      null;
    if (to) {
      const html = renderLocateFlowEmail({
        preheader: `Placement request: ${company.legalName}`,
        title: "Sponsored placement request",
        badge: "Mover portal",
        bodyHtml: `<p>An eligible mover requested a sponsored placement.</p><ul>
          <li><strong>Company:</strong> ${escapeHtml(company.legalName)} (USDOT ${company.usdotNumber})</li>
          <li><strong>State:</strong> ${escapeHtml(stateScope)}</li>
          <li><strong>Duration:</strong> ${durationDays} days</li>
          ${note ? `<li><strong>Note:</strong> ${escapeHtml(note)}</li>` : ""}
        </ul><p>Set it up in Admin → Sponsored (kind = mover, target = this USDOT's MovingCompany).</p>`,
      });
      await sendEmail({
        to,
        subject: `Placement request — ${company.legalName} (${stateScope}, ${durationDays}d)`,
        html,
        text: `Placement request: ${company.legalName} (USDOT ${company.usdotNumber}), state ${stateScope}, ${durationDays} days.${note ? ` Note: ${note}` : ""}`,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
