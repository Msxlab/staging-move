import { requirePagePermission } from "@/lib/page-guard";
import WorkspacesClient from "./workspaces-client";

// Family/Pro household directory. Read at users:canRead (VIEWER floor) so
// support roles can investigate a household without mutation rights.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workspaces — Admin",
  robots: { index: false, follow: false },
};

export default async function WorkspacesPage() {
  await requirePagePermission("users", "canRead", { minimumRole: "VIEWER" });
  return <WorkspacesClient />;
}
