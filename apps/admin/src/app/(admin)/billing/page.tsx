import { requirePagePermission } from "@/lib/page-guard";
import { getConsumerFreeStatus } from "@/lib/consumer-free-status";
import BillingClient from "./billing-client";

// Billing analytics — total revenue, cancellation insights, daily MRR.
// Read at subscriptions:canRead (VIEWER floor); writes here go through
// dedicated subscription-action endpoints.
//
// Under the consumer-free pivot these figures are LEGACY/DORMANT: the billing
// infra is kept for historical data + reversibility, but the live revenue
// story is affiliate commission (see /affiliate). We resolve the CONSUMER_FREE
// flag here and pass it down so the client can frame the page honestly without
// removing any billing dashboard.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Billing — Admin",
  robots: { index: false, follow: false },
};

export default async function BillingPage() {
  await requirePagePermission("subscriptions", "canRead", {
    minimumRole: "VIEWER",
  });
  const { consumerFreeEnabled } = await getConsumerFreeStatus();
  return <BillingClient consumerFreeEnabled={consumerFreeEnabled} />;
}
