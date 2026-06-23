import { requirePagePermission } from "@/lib/page-guard";
import HelpCenterClient from "./help-center-client";

// Help-center content management. The matching API (/api/help-center) gates
// reads at settings:canRead with an ADMIN floor, so match that here — the
// page is more than general help: it edits/publishes articles and FAQs.
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function HelpCenterPage() {
  await requirePagePermission("settings", "canRead", { minimumRole: "ADMIN" });
  return <HelpCenterClient />;
}
