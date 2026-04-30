/**
 * Admin /blog — list + entry point.
 *
 * Sprint 1 placeholder: confirms the route, RBAC gate, and DB-backed
 * list render correctly. Sprint 2 layers on filters (status, locale,
 * category), bulk actions, slug-search, and the "New post" form.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export default async function BlogListPage() {
  await requirePermission("blog", "canRead", { minimumRole: "MODERATOR" });

  const posts = await prisma.blogPost.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      locale: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      author: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Blog</h1>
        <Link
          href="/blog/new"
          className="px-3 py-1.5 text-sm rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
        >
          New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="border rounded-md p-8 text-center text-sm text-zinc-500">
          No posts yet. Click <strong>New post</strong> to publish your first article.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-2">Title</th>
              <th>Status</th>
              <th>Locale</th>
              <th>Author</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-2">
                  <Link href={`/blog/${p.id}/edit`} className="hover:underline">
                    {p.title}
                  </Link>
                  <div className="text-xs text-zinc-500">/{p.slug}</div>
                </td>
                <td>{p.status}</td>
                <td>{p.locale}</td>
                <td>
                  {p.author?.firstName} {p.author?.lastName}
                </td>
                <td>{p.updatedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
