/**
 * /blog/preview/<token> â€” short-lived signed preview of a draft post.
 *
 * The admin "Preview" button hits the admin webhook
 * (`/api/blog/posts/[id]/preview-token`), gets back a JWT, and links
 * to this route. The token encodes the postId; we verify the
 * signature and the audience (`blog-preview`) before rendering. The
 * page sets `noindex,nofollow` so even if a preview link leaks, it
 * never enters search results.
 */

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { verifyPreviewToken } from "@/lib/blog/preview-token";
import { buildBlogOgImageUrl } from "@/lib/blog/imgproxy-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Preview Â· LocateFlow",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // Touch headers() so this page is always SSR'd â€” never cached.
  await headers();

  const { token } = await params;
  const verified = await verifyPreviewToken(token);
  if (!verified) notFound();

  const post = await prisma.blogPost.findFirst({
    where: { id: verified.postId, deletedAt: null },
    include: {
      author: { select: { firstName: true, lastName: true } },
      category: { select: { name: true } },
    },
  });
  if (!post) notFound();

  const authorName = `${post.author.firstName ?? ""} ${post.author.lastName ?? ""}`.trim() || "LocateFlow";
  let cover: string | null = null;
  if (post.ogImageKey) {
    try {
      cover = buildBlogOgImageUrl(post.ogImageKey);
    } catch {
      cover = null;
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <div
        className="mb-6 rounded-md border border-tone-honey-br bg-tone-honey-bg px-4 py-2 text-sm text-tone-honey-fg"
        role="status"
      >
        Preview mode Â· status: <strong>{post.status}</strong>. This page is
        excluded from search and feeds.
      </div>

      <header className="mb-8">
        {post.category ? (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {post.category.name}
          </span>
        ) : null}
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">{post.title}</h1>
        <p className="mt-3 text-muted-foreground dark:text-muted-foreground">{post.excerpt}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          By {authorName} Â· {post.readingMinutes} min read
        </p>
      </header>

      {cover ? (
        <div className="aspect-[1200/630] relative overflow-hidden rounded-lg mb-10 bg-muted dark:bg-muted">
          <Image src={cover} alt={post.ogImageAlt ?? post.title} fill priority sizes="100vw" className="object-cover" />
        </div>
      ) : null}

      <article
        className="prose prose-zinc dark:prose-invert max-w-none"
        // Already-sanitized HTML â€” same write-time pipeline as published posts.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
    </main>
  );
}
