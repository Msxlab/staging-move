import { requirePagePermission } from "@/lib/page-guard";
import UsersClient from "./users-client";

// Users list surfaces user PII (masked emails, plan/status, counts) and
// drives privileged delete/export flows. Server-gate at users:canRead
// (VIEWER floor) — same as the list API GET /api/users. Field-level
// redaction by role still happens in the API (see lib/privacy.ts).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Users — Admin",
  robots: { index: false, follow: false },
};

export default async function UsersPage() {
  await requirePagePermission("users", "canRead", { minimumRole: "VIEWER" });
  return <UsersClient />;
}
