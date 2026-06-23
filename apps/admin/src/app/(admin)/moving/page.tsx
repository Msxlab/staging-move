import { requirePagePermission } from "@/lib/page-guard";
import MovingListClient from "./moving-list-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Moving Plans — Admin",
  robots: { index: false, follow: false },
};

export default async function MovingPage() {
  await requirePagePermission("moving_plans", "canRead", { minimumRole: "VIEWER" });
  return <MovingListClient />;
}
