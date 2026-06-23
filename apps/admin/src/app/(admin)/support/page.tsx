import { requirePagePermission } from "@/lib/page-guard";
import SupportClient from "./support-client";

// Support inbox surfaces every user ticket plus user PII (name/email) and
// SLA/triage state. Server-gate at tickets:canRead (ADMIN floor) — same as
// GET /api/tickets — so the privileged shell never ships to a low-permission
// admin. The API re-validates on every request.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Support — Admin",
  robots: { index: false, follow: false },
};

export default async function SupportPage() {
  await requirePagePermission("tickets", "canRead", { minimumRole: "ADMIN" });
  return <SupportClient />;
}
