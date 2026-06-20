import SubscriptionManagementPage from "@/components/settings/subscription-management";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { CONSUMER_FREE_FLAG } from "@locateflow/shared";

export const dynamic = "force-dynamic";

export default async function SettingsSubscriptionPage() {
  const consumerFree = await isFeatureEnabled(CONSUMER_FREE_FLAG);
  return (
    <SubscriptionManagementPage initialNowIso={new Date().toISOString()} consumerFree={consumerFree} />
  );
}
