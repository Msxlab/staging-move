import { requirePagePermission } from "@/lib/page-guard";
import NeedsLogoClient from "./needs-logo-client";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function NeedsLogoPage() {
  await requirePagePermission("providers", "canRead", { minimumRole: "VIEWER" });
  return <NeedsLogoClient />;
}
