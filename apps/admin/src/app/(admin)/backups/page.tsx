import { requirePagePermission } from "@/lib/page-guard";
import BackupsClient from "./backups-client";

// Backups can be downloaded (full PII export) and imported (DESTRUCTIVE
// REPLACE). Server-gate at settings:canCreate — write capability is
// required to create or restore backups. Audit-log fallback resource lets
// audit-only ADMINs read the list without granting them backup creation.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Backups — Admin",
  robots: { index: false, follow: false },
};

export default async function BackupsPage() {
  await requirePagePermission("settings", "canRead", { minimumRole: "ADMIN" });
  return <BackupsClient />;
}
