import { requirePagePermission } from "@/lib/page-guard";
import FeatureFlagsClient from "./feature-flags-client";

// Feature flags control public/staged rollouts. Read at settings:canRead
// (ADMIN floor); write actions are gated server-side per route.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Feature Flags — Admin",
  robots: { index: false, follow: false },
};

export default async function FeatureFlagsPage() {
  await requirePagePermission("settings", "canRead", { minimumRole: "ADMIN" });
  return <FeatureFlagsClient />;
}
