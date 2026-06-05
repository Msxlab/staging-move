import { requirePagePermission } from "@/lib/page-guard";
import ConnectorMetricsClient from "./connector-metrics-client";

// Per-connector dispatch health (confirm rate, outcome breakdown). Reads the
// existing /api/connectors payload (which already excludes shadow rows), so no
// new endpoint or query — just a metrics-focused view over the same data.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connector metrics — Admin",
  robots: { index: false, follow: false },
};

export default async function ConnectorMetricsPage() {
  await requirePagePermission("connectors", "canRead", { minimumRole: "ADMIN" });
  return <ConnectorMetricsClient />;
}
