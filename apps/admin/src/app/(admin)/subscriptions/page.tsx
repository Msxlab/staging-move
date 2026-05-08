import { requirePagePermission } from "@/lib/page-guard";
import SubscriptionsClient from "./subscriptions-client";

// Subscriptions list. Read at subscriptions:canRead (VIEWER floor) so
// support roles can investigate billing without being able to mutate.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Subscriptions — Admin",
  robots: { index: false, follow: false },
};

export default async function SubscriptionsPage() {
  await requirePagePermission("subscriptions", "canRead", {
    minimumRole: "VIEWER",
  });
  return <SubscriptionsClient />;
}
