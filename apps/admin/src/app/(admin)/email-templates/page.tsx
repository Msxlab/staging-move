import { requirePagePermission } from "@/lib/page-guard";
import EmailTemplatesClient from "./email-templates-client";

// Email template editor — content can be sent to all users on next
// transactional/marketing send. Read at settings:canRead (ADMIN floor).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email Templates — Admin",
  robots: { index: false, follow: false },
};

export default async function EmailTemplatesPage() {
  await requirePagePermission("settings", "canRead", { minimumRole: "ADMIN" });
  return <EmailTemplatesClient />;
}
