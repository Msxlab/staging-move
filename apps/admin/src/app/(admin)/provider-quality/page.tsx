import { requirePagePermission } from "@/lib/page-guard";
import ProviderQualityClient from "./provider-quality-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Provider Quality - Admin",
  robots: { index: false, follow: false },
};

export default async function ProviderQualityPage() {
  await requirePagePermission("providers", "canRead", {
    minimumRole: "VIEWER",
  });
  return <ProviderQualityClient />;
}
