import { requirePagePermission } from "@/lib/page-guard";
import HealthClient from "./health-client";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function HealthPage() {
  await requirePagePermission("settings", "canRead", { minimumRole: "ADMIN" });
  return <HealthClient />;
}
