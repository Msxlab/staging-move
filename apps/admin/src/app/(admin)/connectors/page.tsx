import { requirePagePermission } from "@/lib/page-guard";
import ConnectorsClient from "./connectors-client";

// Connector control plane: enable/disable connectors, set rollout/stage, and
// bulk-revoke consents during an incident. Read at connectors:canRead (ADMIN
// floor); write actions are gated server-side per route + step-up.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connectors — Admin",
  robots: { index: false, follow: false },
};

export default async function ConnectorsPage() {
  await requirePagePermission("connectors", "canRead", { minimumRole: "ADMIN" });
  return <ConnectorsClient />;
}
