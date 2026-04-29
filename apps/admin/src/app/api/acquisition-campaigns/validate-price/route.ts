import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { validateStripeCampaignPrice } from "@/lib/stripe-campaign-validation";

export async function POST(request: NextRequest) {
  try {
    await requirePermission("subscriptions", "canRead", { minimumRole: "VIEWER" });
    const body = await request.json().catch(() => ({}));
    const accessType = body.accessType === "FREE_ACCESS"
      ? "FREE_ACCESS"
      : body.accessType === "PAID"
        ? "PAID"
        : "FREE_TRIAL";
    const billingInterval = accessType === "FREE_TRIAL"
      ? "YEAR"
      : accessType === "PAID"
        ? (body.billingInterval === "YEAR" ? "YEAR" : "MONTH")
        : null;
    const requiresPaymentMethod = accessType === "FREE_TRIAL" || accessType === "PAID";
    const priceValidation = await validateStripeCampaignPrice({
      accessType,
      billingInterval,
      requiresPaymentMethod,
      stripePriceId: body.stripePriceId || null,
      displayPriceLabel: body.displayPriceLabel || null,
      // Use DRAFT semantics so a mismatch returns ok:true with warning instead
      // of 422. The form UI surfaces both warnings and errors clearly.
      status: "DRAFT",
    });
    return NextResponse.json({ priceValidation });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
