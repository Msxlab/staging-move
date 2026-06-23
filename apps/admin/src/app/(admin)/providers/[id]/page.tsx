import { requirePagePermission } from "@/lib/page-guard";
import ProviderDetailClient from "./provider-detail-client";

// Provider detail. The matching API (GET /api/providers/[id]) gates at
// providers:canRead with a VIEWER floor — fail-closed here before the
// client bundle ships. The client reads the route id via useParams(), so
// the server wrapper passes no props.
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function ProviderDetailPage() {
  await requirePagePermission("providers", "canRead", { minimumRole: "VIEWER" });
  return <ProviderDetailClient />;
}
