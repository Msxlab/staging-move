import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { PARTNER_REGISTRATION_FLAG } from "@locateflow/shared";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { sendEmail, renderLocateFlowEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Generic (non-mover) partner categories. Movers register via /api/movers/apply.
const PARTNER_CATEGORIES = ["cleaning", "junk"] as const;
const STATE_CSV = /^([A-Za-z]{2})(\s*,\s*[A-Za-z]{2})*$/;

const partnerSchema = z.object({
  category: z.enum(PARTNER_CATEGORIES),
  companyName: z.string().trim().min(1).max(255),
  contactName: z.string().trim().min(1).max(120),
  // Lowercased at write so the case-insensitive portal lookup always matches
  // (audit P2; mirrors the mover portal).
  contactEmail: z.string().trim().email().max(191).transform((v) => v.toLowerCase()),
  contactPhone: z.string().trim().max(30).optional().nullable(),
  website: z.string().trim().url().max(255).optional().nullable(),
  // Comma-separated 2-letter states; empty allowed (nationwide).
  serviceStates: z.string().trim().max(255).optional().nullable(),
  attestation: z.literal(true),
  // Partner agrees to receive consumer leads + handle the contact data per terms.
  consent: z.literal(true),
});

function normalizeStates(csv: string | null | undefined): string {
  if (!csv) return "";
  return csv
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s))
    .join(",");
}

// POST /api/partners — public generic-partner self-service application (R4b).
// Fail-closed behind partner_registration_v1; rate-limited; creates a PENDING
// Partner for the admin verification queue. JSON only (documents are uploaded
// later via the partner portal). The application is the source of truth — a
// failed admin email never rolls it back.
export async function POST(request: NextRequest) {
  try {
    if (!(await isFeatureEnabled(PARTNER_REGISTRATION_FLAG))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rl = await rateLimit(getRateLimitKey(request, "partner-apply"), {
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    }

    const parsed = partnerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Please fix the highlighted fields.", code: "INVALID_PARTNER" }, { status: 422 });
    }
    const d = parsed.data;
    if (d.serviceStates && d.serviceStates.trim() && !STATE_CSV.test(d.serviceStates.trim())) {
      return NextResponse.json({ error: "Service states must be 2-letter codes.", code: "INVALID_STATES" }, { status: 422 });
    }

    const partner = await prisma.partner.create({
      data: {
        category: d.category,
        companyName: d.companyName,
        contactName: d.contactName,
        contactEmail: d.contactEmail,
        contactPhone: d.contactPhone || null,
        website: d.website || null,
        serviceStates: normalizeStates(d.serviceStates),
        attestation: true,
        // Persist the lead-program consent so matching can route PII only to
        // opted-in partners (audit P2). consent is z.literal(true) here.
        leadsOptIn: d.consent,
        status: "PENDING",
      },
      select: { id: true },
    });

    void notifyAdmin({
      partnerId: partner.id,
      category: d.category,
      companyName: d.companyName,
      contactEmail: d.contactEmail,
      serviceStates: normalizeStates(d.serviceStates),
    }).catch(() => {});

    return NextResponse.json({ ok: true, id: partner.id }, { status: 201 });
  } catch (error) {
    console.error("Partner application failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

async function notifyAdmin(input: {
  partnerId: string;
  category: string;
  companyName: string;
  contactEmail: string;
  serviceStates: string;
}): Promise<void> {
  const to =
    (await getRuntimeConfigValue("ADMIN_ALERT_EMAIL").catch(() => null))?.trim() ||
    (await getRuntimeConfigValue("SUPPORT_EMAIL").catch(() => null))?.trim() ||
    null;
  if (!to) return;
  const esc = (v: string) => v.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
  const html = renderLocateFlowEmail({
    preheader: `New partner application: ${input.companyName}`,
    title: "New partner application",
    badge: "Verification queue",
    bodyHtml: `
      <p>A ${esc(input.category)} partner submitted a self-service application.</p>
      <ul>
        <li><strong>Company:</strong> ${esc(input.companyName)}</li>
        <li><strong>Category:</strong> ${esc(input.category)}</li>
        <li><strong>Contact:</strong> ${esc(input.contactEmail)}</li>
        <li><strong>States:</strong> ${esc(input.serviceStates) || "Nationwide"}</li>
      </ul>
      <p>Review it in the admin verification queue.</p>`,
  });
  await sendEmail({
    to,
    subject: `New partner application — ${input.companyName} (${input.category})`,
    html,
    text: `New ${input.category} partner application: ${input.companyName}. Contact: ${input.contactEmail}. Review it in the admin verification queue.`,
  });
}
