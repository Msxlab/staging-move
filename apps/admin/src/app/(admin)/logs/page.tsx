import { requirePagePermission } from "@/lib/page-guard";
import LogsClient from "./logs-client";

// /logs exposes admin + user audit trails (actor emails, IPs, change
// diffs) and a PII-bearing CSV export. Server-gate at audit_logs:canRead
// with an ADMIN floor — mirrors /api/logs — so under-privileged admins
// fail closed before render instead of seeing an empty shell.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit Logs — Admin",
  robots: { index: false, follow: false },
};

export default async function LogsPage() {
  await requirePagePermission("audit_logs", "canRead", { minimumRole: "ADMIN" });
  return <LogsClient />;
}
