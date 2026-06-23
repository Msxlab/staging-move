import { requirePagePermission } from "@/lib/page-guard";
import AnalyticsClient from "./analytics-client";

// Analytics surfaces aggregate user behavior, session, and move data. The
// matching API (GET /api/analytics) gates at users:canRead with an ADMIN
// floor — fail-closed here before the client bundle ships.
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AnalyticsPage() {
  await requirePagePermission("users", "canRead", { minimumRole: "ADMIN" });
  return <AnalyticsClient />;
}
