import { requirePermission } from "@/lib/auth";
import { BlogPostEditorShell } from "@/components/blog/post-editor-shell";

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("blog", "canUpdate", { minimumRole: "MODERATOR" });
  const { id } = await params;
  return <BlogPostEditorShell postId={id} />;
}
