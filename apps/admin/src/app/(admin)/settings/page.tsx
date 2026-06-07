import { requirePagePermission } from "@/lib/page-guard";
import SettingsClient from "./settings-client";

// /settings surfaces the admin profile, runtime/integration readiness,
// database record counts, and PII export controls. Server-gate at
// settings:canRead with an ADMIN floor so VIEWER/MODERATOR fail closed
// before render — the page must not ship an empty shell. The underlying
// /api/settings GET additionally honors an audit_logs fallback and
// remains authoritative for every write.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings — Admin",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  await requirePagePermission("settings", "canRead", { minimumRole: "ADMIN" });
  return <SettingsClient />;
}
