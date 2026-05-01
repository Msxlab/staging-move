import "server-only";
import { prisma } from "@/lib/db";
import { buildBlogOgImageUrl } from "./imgproxy-url";

/**
 * Read-side helpers shared by the public list/detail pages, the JSON
 * API, the RSS feed, and the homepage "latest" section.
 *
 * All queries scope to `status: PUBLISHED`, `publishedAt <= now`,
 * `noIndex: false`, and `deletedAt: null`. That set is the public
 * surface — anything outside it is invisible regardless of caller.
 */

const NOW = () => new Date();

export interface BlogListItem {
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  publishedAt: string;
  ogImageUrl: string | null;
  category: { slug: string; name: string } | null;
}

function safeOgUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  try {
    return buildBlogOgImageUrl(key);
  } catch {
    // imgproxy env not configured (e.g. local dev without secrets) —
    // the page still renders without a cover image.
    return null;
  }
}

export async function listPublicPosts(opts: {
  locale?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ items: BlogListItem[]; total: number; pageSize: number; page: number }> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 20, 1), 50);
  const page = Math.max(opts.page ?? 1, 1);
  const where = {
    status: "PUBLISHED" as const,
    publishedAt: { lte: NOW() },
    noIndex: false,
    deletedAt: null,
    ...(opts.locale ? { locale: opts.locale } : {}),
  };
  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      select: {
        slug: true,
        locale: true,
        title: true,
        excerpt: true,
        readingMinutes: true,
        publishedAt: true,
        ogImageKey: true,
        category: { select: { slug: true, name: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.blogPost.count({ where }),
  ]);

  const items = posts.map((p) => ({
    slug: p.slug,
    locale: p.locale,
    title: p.title,
    excerpt: p.excerpt,
    readingMinutes: p.readingMinutes,
    publishedAt: p.publishedAt!.toISOString(),
    ogImageUrl: safeOgUrl(p.ogImageKey),
    category: p.category ? { slug: p.category.slug, name: p.category.name } : null,
  }));

  return { items, total, pageSize, page };
}

export interface BlogPostDetail extends BlogListItem {
  id: string;
  categoryId: string | null;
  contentHtml: string;
  updatedAt: string;
  ogImageAlt: string | null;
  author: { id: string; name: string };
  tags: Array<{ slug: string; name: string }>;
  seo: {
    title: string;
    description: string;
    canonicalUrl: string | null;
    noIndex: boolean;
  };
}

export async function getPublicPostBySlug(
  slug: string,
  locale?: string,
): Promise<BlogPostDetail | null> {
  const post = await prisma.blogPost.findFirst({
    where: {
      slug,
      ...(locale ? { locale } : {}),
      status: "PUBLISHED",
      publishedAt: { lte: NOW() },
      deletedAt: null,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      category: { select: { slug: true, name: true } },
      tags: { include: { tag: { select: { slug: true, name: true } } } },
    },
  });
  if (!post) return null;

  return {
    id: post.id,
    categoryId: post.categoryId,
    slug: post.slug,
    locale: post.locale,
    title: post.title,
    excerpt: post.excerpt,
    contentHtml: post.contentHtml,
    readingMinutes: post.readingMinutes,
    publishedAt: post.publishedAt!.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    ogImageUrl: safeOgUrl(post.ogImageKey),
    ogImageAlt: post.ogImageAlt,
    author: {
      id: post.author.id,
      name: `${post.author.firstName ?? ""} ${post.author.lastName ?? ""}`.trim() || "LocateFlow",
    },
    category: post.category ? { slug: post.category.slug, name: post.category.name } : null,
    tags: post.tags.map((t) => ({ slug: t.tag.slug, name: t.tag.name })),
    seo: {
      title: post.seoTitle?.trim() || post.title,
      description: post.seoDescription?.trim() || post.excerpt,
      canonicalUrl: post.canonicalUrl,
      noIndex: post.noIndex,
    },
  };
}

/** Shared by sitemap + the public JSON API to enumerate slugs. */
export async function listPublishedSlugs(limit = 5000): Promise<
  Array<{ slug: string; locale: string; updatedAt: Date; publishedAt: Date }>
> {
  const posts = await prisma.blogPost.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { lte: NOW() },
      noIndex: false,
      deletedAt: null,
    },
    select: { slug: true, locale: true, updatedAt: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
  return posts.map((p) => ({
    slug: p.slug,
    locale: p.locale,
    updatedAt: p.updatedAt,
    publishedAt: p.publishedAt!,
  }));
}

export async function listPublishedLocalesForSlug(slug: string): Promise<string[]> {
  const posts = await prisma.blogPost.findMany({
    where: {
      slug,
      status: "PUBLISHED",
      publishedAt: { lte: NOW() },
      noIndex: false,
      deletedAt: null,
    },
    select: { locale: true },
  });
  return Array.from(new Set(posts.map((post) => post.locale)));
}

/**
 * Up to `limit` other published posts for the article footer's
 * "Keep reading" rail. Same-category posts win first; if the post has
 * no category (or that bucket is empty) we fall back to the most recent
 * posts in the same locale so the rail is never empty on a live blog.
 */
export async function listRelatedPosts(opts: {
  excludePostId: string;
  locale: string;
  categoryId?: string | null;
  limit?: number;
}): Promise<BlogListItem[]> {
  const limit = Math.min(Math.max(opts.limit ?? 3, 1), 8);
  const baseWhere = {
    status: "PUBLISHED" as const,
    publishedAt: { lte: NOW() },
    noIndex: false,
    deletedAt: null,
    locale: opts.locale,
  };

  const select = {
    id: true,
    slug: true,
    locale: true,
    title: true,
    excerpt: true,
    readingMinutes: true,
    publishedAt: true,
    ogImageKey: true,
    category: { select: { slug: true, name: true } },
  } as const;

  type Row = {
    id: string;
    slug: string;
    locale: string;
    title: string;
    excerpt: string;
    readingMinutes: number;
    publishedAt: Date | null;
    ogImageKey: string | null;
    category: { slug: string; name: string } | null;
  };

  let posts: Row[] = [];

  if (opts.categoryId) {
    posts = (await prisma.blogPost.findMany({
      where: { ...baseWhere, categoryId: opts.categoryId, id: { not: opts.excludePostId } },
      select,
      orderBy: { publishedAt: "desc" },
      take: limit,
    })) as Row[];
  }

  if (posts.length < limit) {
    const exclude = new Set<string>([opts.excludePostId, ...posts.map((p) => p.id)]);
    const filler = (await prisma.blogPost.findMany({
      where: {
        ...baseWhere,
        id: { notIn: Array.from(exclude) },
      },
      select,
      orderBy: { publishedAt: "desc" },
      take: limit - posts.length,
    })) as Row[];
    posts = [...posts, ...filler];
  }

  return posts.map((p) => ({
    slug: p.slug,
    locale: p.locale,
    title: p.title,
    excerpt: p.excerpt,
    readingMinutes: p.readingMinutes,
    publishedAt: p.publishedAt!.toISOString(),
    ogImageUrl: safeOgUrl(p.ogImageKey),
    category: p.category ? { slug: p.category.slug, name: p.category.name } : null,
  }));
}
