import { requirePagePermission } from "@/lib/page-guard";
import ActivityIntelligenceClient from "./activity-intelligence-client";

// /analytics/intelligence renders user-level intelligence (onboarding
// funnel, engagement, churn risk, platform mix). Server-gate at
// users:canRead with an ADMIN floor — mirrors
// /api/analytics/activity-intelligence — so under-privileged admins fail
// closed before render instead of getting an empty shell.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activity Intelligence — Admin",
  robots: { index: false, follow: false },
};

export default async function ActivityIntelligencePage() {
  await requirePagePermission("users", "canRead", { minimumRole: "ADMIN" });
  return <ActivityIntelligenceClient />;
}
