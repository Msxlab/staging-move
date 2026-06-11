import { requirePagePermission } from "@/lib/page-guard";
import MoverApplicationsClient from "./mover-applications-client";

// Mover self-service verification queue. Read at providers:canRead (VIEWER
// floor) — the same resource the movers catalog + sponsored modules use; the
// decision PATCH gates at canUpdate (ADMIN) with password + MFA step-up.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mover Applications — Admin",
  robots: { index: false, follow: false },
};

export default async function MoverApplicationsPage() {
  await requirePagePermission("providers", "canRead", { minimumRole: "VIEWER" });
  return <MoverApplicationsClient />;
}
