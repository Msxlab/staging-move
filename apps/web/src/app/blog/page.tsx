/**
 * Public /blog — list page.
 *
 * Server component rendered per request because locale resolution reads
 * request cookies/headers. Magazine-style layout: a featured hero card
 * for the latest post, then the rest in a two-column grid. Falls back
 * to English if the visitor's locale has no published posts yet.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Rss, ArrowRight } from "lucide-react";
import { getLocale } from "next-intl/server";
import { listPublicCategories, listPublicPosts } from "@/lib/blog/queries";
import { blogCategoryPath, blogPostPath } from "@/lib/blog/urls";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";
import { BlogHeroFallback } from "@/components/blog/blog-hero-fallback";
import { RaccoonReading } from "@/components/illustrations/RaccoonReading";

export const dynamic = "force-dynamic";

function normalizePageParam(value: string | undefined): number {
  return Math.max(parseInt(value ?? "1", 10) || 1, 1);
}

function blogIndexCanonical(page: number): string {
  return page > 1 ? `${SITE_URL}/blog?page=${page}` : `${SITE_URL}/blog`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
} = {}): Promise<Metadata> {
  const sp = await searchParams;
  const page = normalizePageParam(sp?.page);
  const canonical = blogIndexCanonical(page);
  const title = page > 1 ? `Blog - Page ${page}` : "Blog";

  return {
    title,
    description:
      "Field-tested guides on moving smarter, tracking provider records in one place, and checking address-sensitive services before they become expensive.",
    alternates: {
      canonical,
      types: {
        "application/rss+xml": [{ url: `${SITE_URL}/blog/feed.xml`, title: "LocateFlow Blog · RSS" }],
        "application/atom+xml": [{ url: `${SITE_URL}/blog/atom.xml`, title: "LocateFlow Blog · Atom" }],
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      title: page > 1 ? `LocateFlow Blog - Page ${page}` : "LocateFlow Blog",
      description:
        "Field-tested guides on moving smarter, tracking provider records in one place, and checking address-sensitive services before they become expensive.",
      siteName: "LocateFlow",
      images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), width: 1200, height: 630, alt: "LocateFlow" }],
    },
    twitter: {
      card: "summary_large_image",
      title: page > 1 ? `LocateFlow Blog - Page ${page}` : "LocateFlow Blog",
      description:
        "Field-tested guides on moving smarter, tracking provider records in one place, and checking address-sensitive services before they become expensive.",
      images: [absoluteUrl(DEFAULT_OG_IMAGE)],
    },
  };
}

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = normalizePageParam(sp.page);
  const locale = await getLocale();

  let listing = {
    items: [],
    total: 0,
    page,
    pageSize: 13, // 1 hero + 12 grid items, leaves a clean 4×3 below the fold
  } as Awaited<ReturnType<typeof listPublicPosts>>;
  try {
    listing = await listPublicPosts({ locale, page, pageSize: 13 });
    if (listing.items.length === 0 && locale !== "en") {
      listing = await listPublicPosts({ locale: "en", page, pageSize: 13 });
    }
  } catch {
    listing = { ...listing, page };
  }

  let categoryNav = await listPublicCategories(locale).catch(() => []);
  if (categoryNav.length === 0 && locale !== "en") {
    categoryNav = await listPublicCategories("en").catch(() => []);
  }

  const totalPages = Math.max(1, Math.ceil(listing.total / listing.pageSize));
  const [hero, ...rest] = listing.items;

  return (
    <div>
      {/* Hero header — sets the magazine tone. Fraunces serif on the
          headline, foil eyebrow, RSS pill on the right edge. */}
      <section className="border-b border-border/60 bg-gradient-to-b from-primary/[0.04] to-transparent">
        <div className="container max-w-5xl py-16 sm:py-20">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                The Field Guide
              </span>
              <Link
                href="/blog/feed.xml"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <Rss className="h-3 w-3" />
                RSS
              </Link>
            </div>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Stories, guides & dispatches{" "}
              <span className="italic text-primary">from the move.</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Practical, field-tested writing on moving smarter - keeping provider records, addresses,
              and renewal reminders in one place so fewer details slip through.
            </p>
            {categoryNav.length > 0 ? (
              <nav className="flex flex-wrap gap-2" aria-label="Blog categories">
                {categoryNav.map((c) => (
                  <Link
                    key={c.slug}
                    href={blogCategoryPath(c.slug, locale)}
                    className="rounded-full border border-border bg-card/60 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                  >
                    {c.name}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
        </div>
      </section>

      <section className="container max-w-6xl py-14 sm:py-20">
        {listing.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
            <RaccoonReading size={132} className="mx-auto mb-5 text-primary/40" />
            <p className="font-display text-2xl text-foreground">No posts yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;re drafting the first issue. Check back soon, or subscribe via{" "}
              <Link href="/blog/feed.xml" className="text-primary underline-offset-4 hover:underline">
                RSS
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            {/* Featured hero card — the latest post gets the largest spotlight. */}
            {hero ? (
              <Link
                href={blogPostPath(hero.slug, hero.locale)}
                className="group mb-16 grid items-stretch gap-8 overflow-hidden rounded-3xl border border-border bg-card/40 transition hover:border-primary/40 hover:shadow-rose md:grid-cols-2 md:gap-0"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-transparent md:aspect-auto md:min-h-[420px]">
                  {hero.ogImageUrl ? (
                    <Image
                      src={hero.ogImageUrl}
                      alt={hero.title}
                      fill
                      priority
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <BlogHeroFallback variant="hero" />
                  )}
                </div>
                <div className="flex flex-col justify-center gap-5 p-8 md:p-10">
                  <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">Featured</span>
                    {hero.category ? <span>{hero.category.name}</span> : null}
                    <span aria-hidden="true">·</span>
                    <span>{hero.readingMinutes} min read</span>
                  </div>
                  <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
                    {hero.title}
                  </h2>
                  <p className="text-base leading-relaxed text-muted-foreground line-clamp-3">
                    {hero.excerpt}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                    <time dateTime={hero.publishedAt}>{formatDate(hero.publishedAt, locale)}</time>
                    <span className="inline-flex items-center gap-1.5 text-primary opacity-0 transition group-hover:opacity-100">
                      Read story
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ) : null}

            {/* Two-column grid for everything else */}
            {rest.length > 0 ? (
              <ul className="grid gap-x-10 gap-y-14 md:grid-cols-2">
                {rest.map((post) => (
                  <li key={`${post.locale}-${post.slug}`}>
                    <Link
                      href={blogPostPath(post.slug, post.locale)}
                      className="group block"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-card/40">
                        {post.ogImageUrl ? (
                          <Image
                            src={post.ogImageUrl}
                            alt={post.title}
                            fill
                            sizes="(min-width: 768px) 45vw, 100vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          />
                        ) : (
                          <BlogHeroFallback variant="card" />
                        )}
                      </div>
                      <div className="mt-5 space-y-3">
                        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {post.category ? (
                            <span className="text-primary/80">{post.category.name}</span>
                          ) : (
                            <span>Field Notes</span>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>{post.readingMinutes} min</span>
                        </div>
                        <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight text-foreground transition group-hover:text-primary">
                          {post.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
                          {post.excerpt}
                        </p>
                        <time
                          dateTime={post.publishedAt}
                          className="block text-xs text-muted-foreground"
                        >
                          {formatDate(post.publishedAt, locale)}
                        </time>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}

        {totalPages > 1 ? (
          <nav
            className="mt-20 flex items-center justify-between border-t border-border pt-8 text-sm"
            aria-label="Blog pagination"
          >
            {page > 1 ? (
              <Link
                href={`/blog?page=${page - 1}`}
                className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground transition hover:text-primary"
              >
                ← Newer posts
              </Link>
            ) : (
              <span />
            )}
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={`/blog?page=${page + 1}`}
                className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground transition hover:text-primary"
              >
                Older posts →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
