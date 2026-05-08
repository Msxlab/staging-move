import { requirePagePermission } from "@/lib/page-guard";
import UserDetailClient from "./user-detail-client";

// User detail surfaces every column the API returns plus full PII bundles
// (sessions, login history, GDPR requests, OAuth provider IDs). Server-
// gate at users:canRead (VIEWER floor) — same as the API. Field-level
// redaction by role still happens in the API (see lib/privacy.ts).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "User Detail — Admin",
  robots: { index: false, follow: false },
};

export default async function UserDetailPage() {
  await requirePagePermission("users", "canRead", { minimumRole: "VIEWER" });
  return <UserDetailClient />;
}
