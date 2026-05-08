import { requirePagePermission } from "@/lib/page-guard";
import SecurityDashboardClient from "./security-dashboard-client";

// /security/dashboard exposes admin sessions, login history, and security
// events with raw IP/UA. Server-gate at audit_logs:canRead with an ADMIN
// floor — VIEWER/MODERATOR don't get this page even if the API would
// 403 them after.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Security Dashboard — Admin",
  robots: { index: false, follow: false },
};

export default async function SecurityDashboardPage() {
  await requirePagePermission("audit_logs", "canRead", { minimumRole: "ADMIN" });
  return <SecurityDashboardClient />;
}
