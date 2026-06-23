import { requirePagePermission } from "@/lib/page-guard";
import ProvidersClient from "./providers-client";

// Providers catalog list. The matching API (GET /api/providers) gates at
// providers:canRead with a VIEWER floor — fail-closed here before the
// client bundle ships.
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function ProvidersPage() {
  await requirePagePermission("providers", "canRead", { minimumRole: "VIEWER" });
  return <ProvidersClient />;
}
