import { requirePagePermission } from "@/lib/page-guard";
import NotificationsClient from "./notifications-client";

// Notification broadcast can blast every active user. Read at
// settings:canRead with an ADMIN floor; create/broadcast goes through
// the API which re-checks settings:canCreate.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifications — Admin",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  await requirePagePermission("settings", "canRead", { minimumRole: "ADMIN" });
  return <NotificationsClient />;
}
