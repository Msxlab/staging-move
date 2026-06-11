import { requirePagePermission } from "@/lib/page-guard";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";
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
  // Honest flag status for the policy banner, resolved server-side via the
  // admin runtime-config read path (same ENV-over-DB resolution the public
  // surfaces use). The /api/runtime-config catalog is SUPER_ADMIN-only while
  // this page has a VIEWER floor, so the page reads the single value here
  // instead of having the client hit that endpoint. null = read failed →
  // the banner omits the status line rather than claiming a state.
  const sponsoredEnabled = await getAdminRuntimeConfigValue("SPONSORED_ENABLED")
    .then((raw) => raw?.trim().toLowerCase() === "true")
    .catch(() => null);
  return <SponsoredClient sponsoredEnabled={sponsoredEnabled} />;
}
