import { requirePermission } from "@/lib/auth";
import { BlogPostEditorShell } from "@/components/blog/post-editor-shell";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  await requirePermission("blog", "canCreate", { minimumRole: "MODERATOR" });
  return <BlogPostEditorShell />;
}
