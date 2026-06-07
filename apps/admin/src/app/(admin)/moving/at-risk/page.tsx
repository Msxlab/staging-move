import { requirePagePermission } from "@/lib/page-guard";
import AtRiskBoardClient from "./at-risk-board-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "At-Risk Moves — Admin",
  robots: { index: false, follow: false },
};

export default async function AtRiskMovesPage() {
  await requirePagePermission("moving_plans", "canRead", { minimumRole: "VIEWER" });
  return <AtRiskBoardClient />;
}
