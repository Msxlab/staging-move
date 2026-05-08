import { NextResponse, type NextRequest } from "next/server";

export const MOBILE_EXTERNAL_BILLING_NOT_ALLOWED =
  "MOBILE_EXTERNAL_BILLING_NOT_ALLOWED";

export function isMobileAppClient(request: NextRequest): boolean {
  return request.headers.get("x-client-type")?.trim().toLowerCase() === "mobile";
}

export function mobileExternalBillingNotAllowedResponse() {
  return NextResponse.json(
    {
      code: MOBILE_EXTERNAL_BILLING_NOT_ALLOWED,
      error: "Billing is unavailable in this app version.",
    },
    { status: 403 },
  );
}

