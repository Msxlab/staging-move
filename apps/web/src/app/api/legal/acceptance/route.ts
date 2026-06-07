import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUserId } from "@/lib/auth";
import { normalizeAcceptedLegalConsents, recordLegalAcceptance } from "@/lib/legal-acceptance";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

const legalAcceptanceSchema = z.object({
  legalConsents: z.object({
    termsAccepted: z.boolean(),
    disclaimerAccepted: z.boolean(),
    termsVersion: z.string().optional(),
    disclaimerVersion: z.string().optional(),
    acceptedAt: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getRateLimitKey(request, "legal:acceptance", { userId }), {
    limit: 20,
    windowSeconds: 60,
    failClosed: true,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = legalAcceptanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.errors }, { status: 400 });
  }

  const acceptedLegalConsents = normalizeAcceptedLegalConsents(parsed.data.legalConsents);
  if (!acceptedLegalConsents) {
    return NextResponse.json(
      { error: "You must accept the Terms of Use and Legal Disclaimer before continuing." },
      { status: 400 },
    );
  }

  await recordLegalAcceptance({
    userId,
    request,
    page: "/onboarding?step=legal",
    source: "onboarding_legal_gate",
    consents: acceptedLegalConsents,
  });

  return NextResponse.json({ success: true, legalConsents: acceptedLegalConsents });
}
