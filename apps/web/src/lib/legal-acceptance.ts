import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveClientIpFromHeaders } from "@/lib/client-ip";
import {
  LEGAL_CONSENT_VERSION,
  LEGAL_CONSENT_EVENT,
  createAcceptedLegalConsents,
  getDefaultLegalConsents,
  hasRequiredLegalConsents,
  type LegalConsentState,
} from "@/lib/legal";

export function getRequestIp(request: NextRequest): string | null {
  const ip = resolveClientIpFromHeaders(request.headers);
  return ip === "anonymous" ? null : ip;
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
  const existing = await prisma.userEvent.findFirst({
    where: { userId: input.userId, event: LEGAL_CONSENT_EVENT },
    orderBy: { createdAt: "desc" },
  });
  if (existing?.metadata) {
    try {
      const current = getDefaultLegalConsents(JSON.parse(existing.metadata));
      if (
        hasRequiredLegalConsents(current) &&
        current.termsVersion === (accepted.termsVersion || LEGAL_CONSENT_VERSION) &&
        current.disclaimerVersion === (accepted.disclaimerVersion || LEGAL_CONSENT_VERSION)
      ) {
        return;
      }
    } catch {
      // Malformed legacy metadata should not block recording current consent.
    }
  }
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
