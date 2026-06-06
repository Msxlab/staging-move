import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUserId } from "@/lib/user-auth";
import { getUserPlan } from "@/lib/plan-limits";
import { planFeatures, ADDRESS_VALIDATION_UNAVAILABLE } from "@locateflow/shared";
import { validateAddressWithUsps, isAddressValidationConfigured } from "@/lib/usps-address-validation";

export const runtime = "nodejs";

/**
 * POST /api/addresses/validate — USPS address validation (Tier 2).
 *
 * ALWAYS responds 200 with an AddressValidationResponse. When the user isn't
 * signed in, isn't on an entitled plan, the feature flag is off, USPS isn't
 * configured, or USPS errors — it returns the safe "unavailable" payload. The
 * client treats "unavailable" as "show nothing" and the address save is never
 * gated on this call.
 */
const schema = z.object({
  street1: z.string().min(1).max(200),
  street2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(120),
  state: z.string().min(2).max(2),
  zip: z.string().min(3).max(10),
});

const safe = () =>
  NextResponse.json(ADDRESS_VALIDATION_UNAVAILABLE, { headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return safe();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return safe();
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return safe();

  try {
    // Entitlement gate (Tier 2 is paid-plans only) + configuration gate.
    const plan = await getUserPlan(userId);
    if (!planFeatures(String(plan.plan)).addressValidation) return safe();
    if (!(await isAddressValidationConfigured())) return safe();

    const result = await validateAddressWithUsps(parsed.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return safe();
  }
}
