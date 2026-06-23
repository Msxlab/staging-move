import { requirePagePermission } from "@/lib/page-guard";
import ReportsClient from "./reports-client";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ReportsPage() {
  await requirePagePermission("settings", "canRead", { minimumRole: "VIEWER" });
  return <ReportsClient />;
}
