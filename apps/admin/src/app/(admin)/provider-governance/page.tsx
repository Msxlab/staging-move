import { requirePagePermission } from "@/lib/page-guard";
import ProviderGovernanceClient from "./provider-governance-client";

// Provider governance triage queues. The matching API
// (GET /api/provider-governance) gates at providers:canRead with a VIEWER
// floor — fail-closed here before the client bundle ships.
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function ProviderGovernancePage() {
  await requirePagePermission("providers", "canRead", { minimumRole: "VIEWER" });
  return <ProviderGovernanceClient />;
}
