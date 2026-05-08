import { requirePagePermission } from "@/lib/page-guard";
import TeamClient from "./team-client";

// Admin team management. Roster is readable by anyone with
// admin_users:canRead (ADMIN floor). Sensitive mutations are gated
// server-side at the API; the client receives the server-resolved role
// only so it can hide controls that would 403 anyway.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Team — Admin",
  robots: { index: false, follow: false },
};

export default async function TeamPage() {
  const ctx = await requirePagePermission("admin_users", "canRead", {
    minimumRole: "ADMIN",
  });
  return <TeamClient currentAdminRole={ctx.role} />;
}
