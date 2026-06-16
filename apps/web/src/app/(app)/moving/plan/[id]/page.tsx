import { getUserSession } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { UX_TRUST_COPY_FLAG, type UxTrustCopyVariant } from "@locateflow/shared";
import MovingPlanDetailClient from "./moving-plan-detail-client";

export const dynamic = "force-dynamic";

export default async function MovingPlanDetailPage() {
  const session = await getUserSession();
  const flagEnabled = session
    ? await isFeatureEnabled(UX_TRUST_COPY_FLAG, { userId: session.userId })
    : false;
  const uxTrustCopyVariant: UxTrustCopyVariant = flagEnabled ? "variant" : "control";

  return <MovingPlanDetailClient uxTrustCopyVariant={uxTrustCopyVariant} />;
}
