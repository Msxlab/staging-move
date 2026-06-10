import { requirePagePermission } from "@/lib/page-guard";
import SponsoredClient from "./sponsored-client";

// Sponsored placements are paid ad inventory rendered on public directory
// surfaces. Read at providers:canRead (VIEWER floor); the create/update/
// delete routes gate at canCreate/canUpdate/canDelete with an ADMIN
// minimum plus password + MFA step-up.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sponsored Placements — Admin",
  robots: { index: false, follow: false },
};

export default async function SponsoredPage() {
  await requirePagePermission("providers", "canRead", {
    minimumRole: "VIEWER",
  });
  return <SponsoredClient />;
}
