import { getUserSession } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  UX_TRUST_COPY_FLAG,
  OFFERS_AFFILIATE_FLAG,
  OFFERS_MOVING_QUOTES_FLAG,
  type UxTrustCopyVariant,
} from "@locateflow/shared";
import MovingPlanDetailClient from "./moving-plan-detail-client";

export const dynamic = "force-dynamic";

export default async function MovingPlanDetailPage() {
  const session = await getUserSession();
  const [flagEnabled, offersAffiliate, offersMovingQuotes] = session
    ? await Promise.all([
        isFeatureEnabled(UX_TRUST_COPY_FLAG, { userId: session.userId }),
        // R2: the move-task destination is the #1 monetizable moment. Surface an
        // affiliate offer there only when this rollout flag is on (fail-closed).
        isFeatureEnabled(OFFERS_AFFILIATE_FLAG, { userId: session.userId }),
        // R3: the "get N moving quotes" lead form on the movers section.
        isFeatureEnabled(OFFERS_MOVING_QUOTES_FLAG, { userId: session.userId }),
      ])
    : [false, false, false];
  const uxTrustCopyVariant: UxTrustCopyVariant = flagEnabled ? "variant" : "control";

  return (
    <MovingPlanDetailClient
      uxTrustCopyVariant={uxTrustCopyVariant}
      offersAffiliate={offersAffiliate}
      offersMovingQuotes={offersMovingQuotes}
    />
  );
}
