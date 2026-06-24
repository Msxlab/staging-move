import { getUserSession } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { CONSUMER_FREE_FLAG } from "@locateflow/shared";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Resolve the consumer-free signal the same way other app surfaces do
  // (dashboard, subscription). When CONSUMER_FREE is OFF the client renders the
  // original paid-model copy byte-for-byte, so the change is fully reversible.
  const session = await getUserSession();
  const consumerFree = session
    ? await isFeatureEnabled(CONSUMER_FREE_FLAG, { userId: session.userId }).catch(() => false)
    : false;

  return <SettingsClient consumerFree={consumerFree} />;
}
