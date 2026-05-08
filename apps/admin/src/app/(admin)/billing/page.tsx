import { requirePagePermission } from "@/lib/page-guard";
import BillingClient from "./billing-client";

// Billing analytics — total revenue, cancellation insights, daily MRR.
// Read at subscriptions:canRead (VIEWER floor); writes here go through
// dedicated subscription-action endpoints.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Billing — Admin",
  robots: { index: false, follow: false },
};

export default async function BillingPage() {
  await requirePagePermission("subscriptions", "canRead", {
    minimumRole: "VIEWER",
  });
  return <BillingClient />;
}
