import { requirePagePermission } from "@/lib/page-guard";
import { getConsumerFreeStatus } from "@/lib/consumer-free-status";
import SubscriptionsClient from "./subscriptions-client";

// Subscriptions list. Read at subscriptions:canRead (VIEWER floor) so
// support roles can investigate billing without being able to mutate.
//
// Under the consumer-free pivot these are legacy records — we resolve the
// CONSUMER_FREE flag and pass it down so the header reads honestly. The list +
// management actions stay intact (dormant billing infra is reversible).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Subscriptions — Admin",
  robots: { index: false, follow: false },
};

export default async function SubscriptionsPage() {
  await requirePagePermission("subscriptions", "canRead", {
    minimumRole: "VIEWER",
  });
  const { consumerFreeEnabled } = await getConsumerFreeStatus();
  return <SubscriptionsClient consumerFreeEnabled={consumerFreeEnabled} />;
}
