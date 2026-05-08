import { requirePagePermission } from "@/lib/page-guard";
import AcquisitionCampaignsClient from "./acquisition-campaigns-client";

// Acquisition campaigns rewrite live pricing copy and bind Stripe price IDs
// to public checkout. Read at acquisition_campaigns:canRead (VIEWER floor);
// create/update routes already gate at canCreate/canUpdate with an ADMIN
// minimum.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Acquisition Campaigns — Admin",
  robots: { index: false, follow: false },
};

export default async function AcquisitionCampaignsPage() {
  await requirePagePermission("acquisition_campaigns", "canRead", {
    minimumRole: "VIEWER",
  });
  return <AcquisitionCampaignsClient />;
}
