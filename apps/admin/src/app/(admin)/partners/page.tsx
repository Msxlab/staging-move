import { requirePagePermission } from "@/lib/page-guard";
import PartnerApplicationsClient from "./partner-applications-client";

// Generic-partner verification queue (R4c). Approve/reject/needs-info on cleaning
// + junk partner applications; an approval makes the partner a live lead recipient
// (step-up + audited in the API). Movers keep their own FMCSA queue.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Partner Applications — Admin",
  robots: { index: false, follow: false },
};

export default async function PartnersPage() {
  await requirePagePermission("providers", "canRead", { minimumRole: "VIEWER" });
  return (
    <div className="mx-auto max-w-5xl">
      <PartnerApplicationsClient />
    </div>
  );
}
