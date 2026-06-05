import { requirePagePermission } from "@/lib/page-guard";
import ConnectorFallbacksClient from "./connector-fallbacks-client";

// Admin-editable connector fallback (guided) actions. A row here overrides the
// in-code default the web resolver layers it over, so adding a partner's guided
// flow is a data change, not a deploy. Read at connectors:canRead (ADMIN floor);
// writes are permission-gated + audit-logged server-side in /api/connector-fallbacks.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connector fallbacks — Admin",
  robots: { index: false, follow: false },
};

export default async function ConnectorFallbacksPage() {
  await requirePagePermission("connectors", "canRead", { minimumRole: "ADMIN" });
  return <ConnectorFallbacksClient />;
}
