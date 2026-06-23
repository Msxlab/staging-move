import { requirePagePermission } from "@/lib/page-guard";
import CoverageOverviewClient from "./coverage-overview-client";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function CoverageOverviewPage() {
  await requirePagePermission("providers", "canRead", { minimumRole: "VIEWER" });
  return <CoverageOverviewClient />;
}
