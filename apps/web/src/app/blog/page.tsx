/**
 * Public /blog — list page.
 *
 * Server component, ISR'd at 5 minutes (the publish webhook also
 * forces revalidation so freshness rarely lags). Shows the latest
 * posts in the visitor's locale; falls back to English if the user's
 * locale has no published posts yet.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getLocale } from "next-intl/server";
import { listPublicPosts } from "@/lib/blog/queries";
import { blogPostPath } from "@/lib/blog/urls";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Blog",
    description:
      "Stories, guides, and product updates from the LocateFlow team — moving smarter, tracking every provider in one place.",
    alternates: {
      canonical: `${SITE_URL}/blog`,
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/blog`,
      title: "LocateFlow Blog",
      description:
        "Stories, guides, and product updates from the LocateFlow team.",
      siteName: "LocateFlow",
    },
  };
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);
  const locale = await getLocale();

  // Try the visitor's locale first; fall back to en if empty so a new
  // Spanish reader still sees content while we ramp up translations.
  let listing = {
    items: [],
    total: 0,
    page,
    pageSize: 12,
  } as Awaited<ReturnType<typeof listPublicPosts>>;
  try {
    listing = await listPublicPosts({ locale, page, pageSize: 12 });
    if (listing.items.length === 0 && locale !== "en") {
      listing = await listPublicPosts({ locale: "en", page, pageSize: 12 });
    }
  } catch {
    listing = { ...listing, page };
  }

  const totalPages = Math.max(1, Math.ceil(listing.total / listing.pageSize));

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">Blog</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Guides, stories, and product updates from the LocateFlow team.
        </p>
      </header>

      {listing.items.length === 0 ? (
        <p className="text-zinc-500">No posts yet — check back soon.</p>
      ) : (
        <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {listing.items.map((post) => (
            <li key={`${post.locale}-${post.slug}`}>
              <Link href={blogPostPath(post.slug, post.locale)} className="group block">
                {post.ogImageUrl ? (
                  <div className="aspect-[1200/630] relative overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Image
                      src={post.ogImageUrl}
                      alt={post.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="aspect-[1200/630] rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900" />
                )}
                <div className="mt-3">
                  {post.category ? (
                    <span className="text-xs uppercase tracking-wide text-zinc-500">
                      {post.category.name}
                    </span>
                  ) : null}
                  <h2 className="mt-1 text-xl font-medium tracking-tight group-hover:underline">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {new Date(post.publishedAt).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {post.readingMinutes} min read
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="mt-10 flex justify-between text-sm">
          {page > 1 ? (
            <Link href={`/blog?page=${page - 1}`} className="hover:underline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {page < totalPages ? (
            <Link href={`/blog?page=${page + 1}`} className="hover:underline">
              Older →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
