import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  LEGAL_CONSENT_EVENT,
  createAcceptedLegalConsents,
  hasRequiredLegalConsents,
  type LegalConsentState,
} from "@/lib/legal";

export const OAUTH_LEGAL_ACCEPTANCE_COOKIE = "oauth_legal_acceptance";

export function getRequestIp(request: NextRequest): string | null {
  return (
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export function normalizeAcceptedLegalConsents(
  consents: Partial<LegalConsentState> | null | undefined,
): LegalConsentState | null {
  if (!hasRequiredLegalConsents(consents)) return null;
  return createAcceptedLegalConsents(consents);
}

export async function recordLegalAcceptance(input: {
  userId: string;
  request: NextRequest;
  page: string;
  source: string;
  consents?: Partial<LegalConsentState> | null;
}) {
  const accepted = normalizeAcceptedLegalConsents(input.consents) || createAcceptedLegalConsents();
  const ipAddress = getRequestIp(input.request);
  const userAgent = input.request.headers.get("user-agent") || null;

  await prisma.userEvent.create({
    data: {
      userId: input.userId,
      event: LEGAL_CONSENT_EVENT,
      page: input.page,
      metadata: JSON.stringify({
        ...accepted,
        source: input.source,
        ipAddress,
        userAgent: userAgent?.slice(0, 500) ?? null,
      }),
    },
  });
}
