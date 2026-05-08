import { requirePagePermission } from "@/lib/page-guard";
import AdminTicketDetailClient from "./support-detail-client";

// Support ticket detail exposes user moving plans, addresses, services,
// custom-providers in the initial fetch. Read at tickets:canRead with a
// MODERATOR floor.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Support Ticket — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminTicketDetailPage() {
  await requirePagePermission("tickets", "canRead", { minimumRole: "MODERATOR" });
  return <AdminTicketDetailClient />;
}
