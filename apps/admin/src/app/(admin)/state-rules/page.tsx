import { requirePagePermission } from "@/lib/page-guard";
import StateRulesClient from "./state-rules-client";

// State-rules surfaces editorial DMV / tax / voter content and write controls.
// Server-gate at state_rules:canRead (VIEWER floor) — same as the list API
// (GET /api/state-rules). Write APIs re-validate canCreate/canUpdate/canDelete
// plus password step-up on every mutation.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "State Rules — Admin",
  robots: { index: false, follow: false },
};

export default async function StateRulesPage() {
  await requirePagePermission("state_rules", "canRead", { minimumRole: "VIEWER" });
  return <StateRulesClient />;
}
