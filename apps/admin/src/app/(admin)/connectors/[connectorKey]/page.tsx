import { requirePagePermission } from "@/lib/page-guard";
import ConnectorDetailClient from "./connector-detail-client";

// Per-connector detail view: identity + health, masked configuration, the
// enable/stage/rollout controls (step-up + audited via the existing
// /api/connectors PUT), an on-demand health check + credential test, the recent
// dispatch call log, and the fallback summary. Read at connectors:canRead
// (ADMIN floor) — same gate as the list; every write stays server-gated + stepped up.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connector Detail — Admin",
  robots: { index: false, follow: false },
};

export default async function ConnectorDetailPage() {
  await requirePagePermission("connectors", "canRead", { minimumRole: "ADMIN" });
  return <ConnectorDetailClient />;
}
