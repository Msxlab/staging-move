import { requirePagePermission } from "@/lib/page-guard";
import WorkspaceDetailClient from "./workspace-detail-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workspace — Admin",
  robots: { index: false, follow: false },
};

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("users", "canRead", { minimumRole: "VIEWER" });
  const { id } = await params;
  return <WorkspaceDetailClient id={id} />;
}
