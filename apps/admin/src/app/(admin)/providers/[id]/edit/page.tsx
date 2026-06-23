import { requirePagePermission } from "@/lib/page-guard";
import EditProviderClient from "./edit-provider-client";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function EditProviderPage() {
  await requirePagePermission("providers", "canUpdate", { minimumRole: "MODERATOR" });
  return <EditProviderClient />;
}
