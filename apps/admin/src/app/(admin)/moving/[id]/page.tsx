import { requirePagePermission } from "@/lib/page-guard";
import MovingPlanDetailClient from "./moving-plan-detail-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Moving Plan — Admin",
  robots: { index: false, follow: false },
};

export default async function MovingPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("moving_plans", "canRead", { minimumRole: "VIEWER" });
  const { id } = await params;
  return <MovingPlanDetailClient id={id} />;
}
