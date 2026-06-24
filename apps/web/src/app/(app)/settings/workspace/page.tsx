import { getUserSession } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { CONSUMER_FREE_FLAG } from "@locateflow/shared";
import WorkspaceSettingsClient from "./workspace-client";

export const dynamic = "force-dynamic";

/**
 * Server wrapper: resolves the CONSUMER_FREE signal the same way the dashboard
 * and app layout do (isFeatureEnabled(CONSUMER_FREE_FLAG, { userId })) and passes
 * it to the client. When the flag is OFF, `consumerFree` is false and the client
 * renders the original paid copy + no-create behavior byte-identically.
 */
export default async function WorkspaceSettingsPage() {
  const session = await getUserSession();
  const consumerFree = session
    ? await isFeatureEnabled(CONSUMER_FREE_FLAG, { userId: session.userId }).catch(() => false)
    : false;
  return <WorkspaceSettingsClient consumerFree={consumerFree} />;
}
