/**
 * Public /blog — list page.
 *
 * Server component rendered per request because locale resolution reads
 * request cookies/headers. Reskinned to the Move design ("Web Blog.dc.html"):
 * a "Moving guides" eyebrow + serif headline, a wide featured card, then a
 * three-column grid of guide cards. Real post images are used when present;
 * a gradient + category-emoji block is the fallback (matches the design's
 * placeholder tiles). All colors come from the shared semantic tokens so the
 * page follows the site palette (navy surface + accent). Falls back to
 * English if the visitor's locale has no published posts yet.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Rss } from "lucide-react";
import { getLocale } from "next-intl/server";
import { listPublicCategories, listPublicPosts } from "@/lib/blog/queries";
import { blogCategoryPath, blogPostPath } from "@/lib/blog/urls";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";
import { RaccoonReading } from "@/components/illustrations/RaccoonReading";

export const dynamic = "force-dynamic";

function normalizePageParam(value: string | undefined): number {
  return Math.max(parseInt(value ?? "1", 10) || 1, 1);
}

function blogIndexCanonical(page: number): string {
  return page > 1 ? `${SITE_URL}/blog?page=${page}` : `${SITE_URL}/blog`;
}

/** Category → emoji for the gradient placeholder tiles (matches the design's
 *  guide thumbnails). Falls back to a parcel box for anything unmapped. */
function categoryEmoji(name: string | null | undefined): string {
  const key = (name ?? "").toLowerCase();
  if (/util|electric|water|gas|internet/.test(key)) return "🔌";
  if (/gov|dmv|license|legal/.test(key)) return "🏛";
  if (/pack/.test(key)) return "📦";
  if (/tool|app/.test(key)) return "📱";
  if (/budget|cost|money|finance/.test(key)) return "💰";
  if (/cit|neighbo|area|local/.test(key)) return "🗽";
  if (/plan|checklist|timeline/.test(key)) return "🗓";
  if (/home|hous|address/.test(key)) return "🏡";
  return "📦";
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
    pageSize: 13, // 1 featured + 12 grid items
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
    <div className="relative overflow-hidden">
      {/* Soft accent glow bleeding from the top-right corner (design). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-48 h-[600px] w-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-info, #37C2C9) 9%, transparent), transparent 65%)",
        }}
      />

      {/* Hero — "Moving guides" eyebrow + large serif headline. */}
      <section className="border-b border-border/60">
        <div className="container max-w-6xl py-14 sm:py-20">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Moving guides</p>
            <Link
              href="/blog/feed.xml"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            >
              <Rss className="h-3 w-3" />
              RSS
            </Link>
          </div>
          <h1 className="mt-3 max-w-[620px] font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-foreground sm:text-5xl md:text-[3.25rem]">
            Free guides to make your move effortless
          </h1>
          {categoryNav.length > 0 ? (
            <nav className="mt-6 flex flex-wrap gap-2" aria-label="Blog categories">
              {categoryNav.map((c) => (
                <Link
                  key={c.slug}
                  href={blogCategoryPath(c.slug, locale)}
                  className="rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </section>

      <section className="container max-w-6xl py-12 sm:py-16">
        {listing.items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center">
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
            {/* Featured card — widescreen split: copy left, image/emoji right. */}
            {hero ? (
              <Link
                href={blogPostPath(hero.slug, hero.locale)}
                className="group grid items-stretch overflow-hidden rounded-3xl border border-border bg-card transition hover:border-primary/40 md:grid-cols-[1.3fr_1fr]"
              >
                <div className="flex flex-col justify-center gap-3 p-8 sm:p-10">
                  <span className="inline-flex w-fit items-center rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-primary">
                    Featured{hero.category ? ` · ${hero.category.name}` : ""}
                  </span>
                  <h2 className="font-display text-3xl font-bold leading-[1.18] tracking-tight text-foreground">
                    {hero.title}
                  </h2>
                  <p className="text-[15px] leading-relaxed text-muted-foreground line-clamp-3">{hero.excerpt}</p>
                  <div className="mt-1 text-[12.5px] font-semibold text-muted-foreground/80">
                    {hero.readingMinutes} min read · {formatDate(hero.publishedAt, locale)}
                  </div>
                </div>
                <div className="relative min-h-[200px] overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-transparent md:min-h-[300px]">
                  {hero.ogImageUrl ? (
                    <Image
                      src={hero.ogImageUrl}
                      alt={hero.title}
                      fill
                      priority
                      sizes="(min-width: 768px) 42vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-6xl sm:text-7xl">
                      {categoryEmoji(hero.category?.name)}
                    </div>
                  )}
                </div>
              </Link>
            ) : null}

            {/* Three-column grid for the rest. */}
            {rest.length > 0 ? (
              <ul className="mt-6 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
                {rest.map((post) => (
                  <li key={`${post.locale}-${post.slug}`}>
                    <Link
                      href={blogPostPath(post.slug, post.locale)}
                      className="group block overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/40"
                    >
                      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
                        {post.ogImageUrl ? (
                          <Image
                            src={post.ogImageUrl}
                            alt={post.title}
                            fill
                            sizes="(min-width: 768px) 32vw, 100vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[44px]">
                            {categoryEmoji(post.category?.name)}
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.08em] text-primary">
                          {post.category?.name ?? "Field Notes"}
                        </span>
                        <h3 className="mt-3 text-[16.5px] font-bold leading-snug tracking-tight text-foreground transition group-hover:text-primary">
                          {post.title}
                        </h3>
                        <div className="mt-2.5 text-[12px] font-semibold text-muted-foreground/80">
                          {post.readingMinutes} min read · {formatDate(post.publishedAt, locale)}
                        </div>
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
            className="mt-16 flex items-center justify-between border-t border-border pt-8 text-sm"
            aria-label="Blog pagination"
          >
            {page > 1 ? (
              <Link
                href={`/blog?page=${page - 1}`}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-primary"
              >
                ← Newer posts
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={`/blog?page=${page + 1}`}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-primary"
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
