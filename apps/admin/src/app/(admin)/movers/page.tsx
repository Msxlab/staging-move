import { requirePagePermission } from "@/lib/page-guard";
import MoversClient from "./movers-client";

// The MovingCompany catalog is FMCSA public data rendered on public mover
// surfaces. Read at providers:canRead (VIEWER floor) — same resource the
// providers and sponsored modules govern; the corrections PATCH gates at
// canUpdate with an ADMIN minimum plus password + MFA step-up.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Licensed Movers — Admin",
  robots: { index: false, follow: false },
};

export default async function MoversPage() {
  await requirePagePermission("providers", "canRead", {
    minimumRole: "VIEWER",
  });
  return <MoversClient />;
}
