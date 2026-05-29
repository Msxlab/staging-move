/**
 * Public /blog/category/<slug> — category landing page.
 *
 * Groups the field guide by topic so both readers and crawlers get a
 * topical hub: an indexable page per category with its own canonical,
 * CollectionPage + Breadcrumb JSON-LD, and internal links to every post
 * in the category. Mirrors the /blog index's locale resolution and
 * English fallback so a category is never an empty shell in a locale
 * that simply hasn't published into it yet.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { isBlogLocale } from "@locateflow/shared";
import { getPublicCategoryBySlug, listPublicPosts } from "@/lib/blog/queries";
import { blogPostPath } from "@/lib/blog/urls";
import { JsonLd, breadcrumbSchema, collectionPageSchema } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

function normalizePageParam(value: string | undefined): number {
  return Math.max(parseInt(value ?? "1", 10) || 1, 1);
}

function categoryCanonical(slug: string, locale: string, page: number): string {
  const params = new URLSearchParams();
  if (locale === "es") params.set("locale", "es");
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `${SITE_URL}/blog/category/${slug}${qs ? `?${qs}` : ""}`;
}

async function resolveLocale(spLocale: string | undefined): Promise<string> {
  const currentLocale = await getLocale();
  return isBlogLocale(spLocale)
    ? spLocale
    : isBlogLocale(currentLocale)
      ? currentLocale
      : "en";
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; locale?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = await resolveLocale(sp.locale);
  const page = normalizePageParam(sp.page);

  const category = await getPublicCategoryBySlug(slug).catch(() => null);
  if (!category) return { title: "Not found" };

  const canonical = categoryCanonical(slug, locale, page);
  const title = page > 1 ? `${category.name} — Page ${page}` : `${category.name}`;
  const description =
    category.description ||
    `Field-tested ${category.name.toLowerCase()} guides for moving smarter and keeping your address-tied accounts in order.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "LocateFlow",
      title: `${category.name} — LocateFlow Blog`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${category.name} — LocateFlow Blog`,
      description,
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

export default async function BlogCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; locale?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = await resolveLocale(sp.locale);
  const page = normalizePageParam(sp.page);

  const category = await getPublicCategoryBySlug(slug).catch(() => null);
  if (!category) notFound();

  let listing = await listPublicPosts({
    locale,
    page,
    pageSize: PAGE_SIZE,
    categoryId: category.id,
  }).catch(() => null);
  // Fall back to English if this locale hasn't published into the category yet.
  if ((!listing || listing.items.length === 0) && locale !== "en") {
    listing = await listPublicPosts({
      locale: "en",
      page,
      pageSize: PAGE_SIZE,
      categoryId: category.id,
    }).catch(() => null);
  }

  if (!listing || listing.total === 0) notFound();

  const totalPages = Math.max(1, Math.ceil(listing.total / listing.pageSize));
  const canonical = categoryCanonical(slug, locale, page);
  const inLanguage = locale === "es" ? "es-US" : "en-US";
  const ctx = {
    siteUrl: SITE_URL,
    siteName: "LocateFlow",
    logoUrl: `${SITE_URL}/logo.svg`,
  };
  const description =
    category.description ||
    `Field-tested ${category.name.toLowerCase()} guides for moving smarter.`;

  return (
    <div>
      <JsonLd
        id="ld-collection"
        data={collectionPageSchema(ctx, {
          url: canonical,
          name: `${category.name} — LocateFlow Blog`,
          description,
          inLanguage,
        })}
      />
      <JsonLd
        id="ld-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Blog", url: `${SITE_URL}/blog` },
          { name: category.name, url: `${SITE_URL}/blog/category/${slug}` },
        ])}
      />

      <section className="border-b border-border/60 bg-gradient-to-b from-primary/[0.04] to-transparent">
        <div className="container max-w-5xl py-16 sm:py-20">
          <nav className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/blog" className="inline-flex items-center gap-1.5 transition hover:text-primary">
              <ArrowLeft className="h-3 w-3" />
              All stories
            </Link>
          </nav>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Category
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            {category.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {listing.total} {listing.total === 1 ? "story" : "stories"}
          </p>
        </div>
      </section>

      <section className="container max-w-6xl py-14 sm:py-20">
        <ul className="grid gap-x-10 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          {listing.items.map((post) => (
            <li key={`${post.locale}-${post.slug}`}>
              <Link href={blogPostPath(post.slug, post.locale)} className="group block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-card/40">
                  {post.ogImageUrl ? (
                    <Image
                      src={post.ogImageUrl}
                      alt={post.title}
                      fill
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(circle_at_75%_75%,var(--foil-c,hsl(var(--primary)/0.06)),transparent_55%)]"
                    />
                  )}
                </div>
                <div className="mt-5 space-y-2">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {post.readingMinutes} min read
                  </div>
                  <h2 className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground transition group-hover:text-primary">
                    {post.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
                    {post.excerpt}
                  </p>
                  <time dateTime={post.publishedAt} className="block text-xs text-muted-foreground">
                    {formatDate(post.publishedAt, locale)}
                  </time>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {totalPages > 1 ? (
          <nav
            className="mt-20 flex items-center justify-between border-t border-border pt-8 text-sm"
            aria-label="Category pagination"
          >
            {page > 1 ? (
              <Link
                href={`/blog/category/${slug}?page=${page - 1}`}
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
                href={`/blog/category/${slug}?page=${page + 1}`}
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
