import { requirePagePermission } from "@/lib/page-guard";
import NewProviderClient from "./new-provider-client";

// Create-provider page POSTs /api/providers, which enforces
// requirePermission("providers", "canCreate", { minimumRole: "MODERATOR" }).
// Fail-closed server-side at the same grant before shipping the bundle.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Provider — Admin",
  robots: { index: false, follow: false },
};

export default async function NewProviderPage() {
  await requirePagePermission("providers", "canCreate", {
    minimumRole: "MODERATOR",
  });
  return <NewProviderClient />;
}
