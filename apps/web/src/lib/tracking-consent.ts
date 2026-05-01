import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth";
import { COOKIE_CONSENT_COOKIE_NAME, parseCookieConsentStatus } from "@/lib/consent";

type TrackingConsentResult =
  | { disabled: true; authSession: null }
  | { disabled: false; authSession: Awaited<ReturnType<typeof getUserSession>> };

async function hasCurrentAnalyticsConsent(userId: string): Promise<boolean> {
  const consent = await prisma.dataConsent.findFirst({
    where: { userId, category: "ANALYTICS" },
    orderBy: { createdAt: "desc" },
    select: { granted: true },
  });
  return consent?.granted === true;
}

export async function getConsentedTrackingSession(request: NextRequest): Promise<TrackingConsentResult> {
  const clientType = request.headers.get("x-client-type")?.toLowerCase();
  const isMobile = clientType === "mobile";

  if (!isMobile) {
    const cookieConsent =
      parseCookieConsentStatus(request.cookies.get(COOKIE_CONSENT_COOKIE_NAME)?.value) === "accepted";
    if (!cookieConsent) return { disabled: true, authSession: null };
  }

  const authSession = await getUserSession();
  if (!authSession) return { disabled: false, authSession: null };

  if (isMobile && !(await hasCurrentAnalyticsConsent(authSession.userId))) {
    return { disabled: true, authSession: null };
  }

  return { disabled: false, authSession };
}
