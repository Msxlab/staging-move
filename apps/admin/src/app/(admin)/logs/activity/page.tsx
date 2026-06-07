import { requirePagePermission } from "@/lib/page-guard";
import AdminActivityClient from "./admin-activity-client";

// /logs/activity renders per-admin audit analytics (leaderboard, action
// breakdowns, critical actions with actor + IP). Server-gate at
// audit_logs:canRead with an ADMIN floor — mirrors
// /api/analytics/admin-activity — so it fails closed before render.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Activity Analytics — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminActivityPage() {
  await requirePagePermission("audit_logs", "canRead", { minimumRole: "ADMIN" });
  return <AdminActivityClient />;
}
