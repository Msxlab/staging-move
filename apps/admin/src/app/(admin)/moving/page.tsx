import { requirePagePermission } from "@/lib/page-guard";
import MovingClient from "./moving-client";

// Moving plans list surfaces user PII (names, emails, addresses). The
// matching API (GET /api/moving) gates at moving_plans:canRead with a
// VIEWER floor — fail-closed here before the client bundle ships.
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function MovingPage() {
  await requirePagePermission("moving_plans", "canRead", { minimumRole: "VIEWER" });
  return <MovingClient />;
}
