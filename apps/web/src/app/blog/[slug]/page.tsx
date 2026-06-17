/**
 * Public /blog/<slug> — detail page (magazine layout).
 *
 * Server component rendered per request because locale resolution and
 * JSON-LD nonce handling read request cookies/headers. Renders the
 * sanitized HTML (already cleaned at write time), emits per-post JSON-LD
 * (Article + Breadcrumb), sets canonical + hreflang, and surfaces a
 * "Keep reading" rail of category-related posts so the visit doesn't
 * dead-end at the article footer.
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getLocale } from "next-intl/server";
import { isBlogLocale } from "@locateflow/shared";
import {
  getPublicPostBySlug,
  listPublishedLocalesForSlug,
  listRelatedPosts,
} from "@/lib/blog/queries";
import { blogCategoryPath, blogHreflangUrls, blogPostPath, blogPostUrl } from "@/lib/blog/urls";
import {
  JsonLd,
  articleSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";
import { BlogViewTracker } from "@/components/blog/view-tracker";
import { BlogHeroFallback } from "@/components/blog/blog-hero-fallback";
import { Button } from "@/components/ui/button";
import { SITE_URL, absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Approximate word count from sanitized article HTML, for JSON-LD. */
function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  const words = text.split(/\s+/).filter(Boolean);
  return words.length;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ locale?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const currentLocale = await getLocale();
  const requestLocale = isBlogLocale(sp.locale)
    ? sp.locale
    : isBlogLocale(currentLocale)
      ? currentLocale
      : "en";
  let post = await getPublicPostBySlug(slug, requestLocale).catch(() => null);
  if (!post && requestLocale !== "en") {
    post = await getPublicPostBySlug(slug, "en").catch(() => null);
  }
  if (!post) return { title: "Not found" };

  const url = blogPostUrl(SITE_URL, post.slug, post.locale);
  const publishedLocales = await listPublishedLocalesForSlug(post.slug).catch(() => [post.locale]);
  const hreflangLocales = publishedLocales.length > 0 ? publishedLocales : [post.locale];

  const ogImageUrl = post.ogImageUrl ?? absoluteUrl(`/blog/${post.slug}/opengraph-image`);
  const ogImageAlt = post.ogImageUrl ? (post.ogImageAlt ?? post.title) : post.title;

  return {
    title: post.seo.title,
    description: post.seo.description,
    robots: post.seo.noIndex ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: post.seo.canonicalUrl || url,
      languages: blogHreflangUrls(SITE_URL, post.slug, hreflangLocales),
    },
    openGraph: {
      type: "article",
      url,
      title: post.seo.title,
      description: post.seo.description,
      siteName: "LocateFlow",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: ogImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.seo.title,
      description: post.seo.description,
      images: [ogImageUrl],
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

export default async function BlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const requestLocale = isBlogLocale(sp.locale) ? sp.locale : isBlogLocale(locale) ? locale : "en";
  let post = await getPublicPostBySlug(slug, requestLocale).catch(() => null);
  if (!post && requestLocale !== "en") {
    post = await getPublicPostBySlug(slug, "en").catch(() => null);
  }
  if (!post) notFound();

  const url = blogPostUrl(SITE_URL, post.slug, post.locale);
  const ctx = {
    siteUrl: SITE_URL,
    siteName: "LocateFlow",
    logoUrl: `${SITE_URL}/logo.svg`,
  };
  const inLanguage = post.locale === "es" ? "es-US" : "en-US";

  // Related posts — same locale, prefer same category, fall back to recent.
  const related = await listRelatedPosts({
    excludePostId: post.id,
    locale: post.locale,
    categoryId: post.categoryId,
    limit: 3,
  }).catch(() => []);

  return (
    <article>
      <BlogViewTracker slug={post.slug} locale={post.locale} />
      <JsonLd
        id="ld-article"
        data={articleSchema(ctx, {
          url,
          headline: post.title,
          description: post.excerpt,
          image: post.ogImageUrl ?? absoluteUrl(`/blog/${post.slug}/opengraph-image`),
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          authorName: post.author.name,
          inLanguage,
          wordCount: countWords(post.contentHtml),
          keywords: post.tags.map((t) => t.name),
          articleSection: post.category?.name,
        })}
      />
      <JsonLd
        id="ld-breadcrumb"
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Blog", url: `${SITE_URL}/blog` },
          { name: post.title, url },
        ])}
      />

      {/* Article header — narrow column, magazine-grade typography */}
      <header className="border-b border-border/60 bg-gradient-to-b from-primary/[0.04] to-transparent">
        <div className="container max-w-3xl py-12 sm:py-16">
          <nav className="mb-8 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/blog" className="inline-flex items-center gap-1.5 transition hover:text-primary">
              <ArrowLeft className="h-3 w-3" />
              All stories
            </Link>
            {post.category ? (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  href={blogCategoryPath(post.category.slug, post.locale)}
                  className="text-primary/80 transition hover:text-primary"
                >
                  {post.category.name}
                </Link>
              </>
            ) : null}
          </nav>
          <h1 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {post.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {post.excerpt}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold uppercase text-primary"
              >
                {post.author.name.slice(0, 1)}
              </span>
              <span className="font-medium text-foreground">{post.author.name}</span>
            </span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
            <span aria-hidden="true">·</span>
            <span>{post.readingMinutes} min read</span>
          </div>
        </div>
      </header>

      {/* Cover image — full-bleed but capped so the article retains its column
          rhythm. With no uploaded cover we fall back to the illustrated
          reading-raccoon banner so the article still opens on something
          branded instead of jumping straight into prose. */}
      <div className="container max-w-5xl pt-8 sm:pt-12">
        <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-border/60 bg-card/40">
          {post.ogImageUrl ? (
            <Image
              src={post.ogImageUrl}
              alt={post.ogImageAlt ?? post.title}
              fill
              priority
              sizes="(min-width: 1024px) 960px, 100vw"
              className="object-cover"
            />
          ) : (
            <BlogHeroFallback variant="hero" />
          )}
        </div>
      </div>

      {/* Body — sanitized HTML rendered into our prose styles. The
          `blog-prose` class is defined in globals.css with rose-tinted
          links, foil-toned blockquotes, and Fraunces headings to match
          the rest of the marketing surface. */}
      <div className="container max-w-3xl py-12 sm:py-16">
        <div
          className="blog-prose prose prose-zinc max-w-none dark:prose-invert"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {post.tags.length > 0 ? (
          <div className="mt-14 flex flex-wrap items-center gap-2 border-t border-border pt-8">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Tags
            </span>
            {post.tags.map((t) => (
              <span
                key={t.slug}
                className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground"
              >
                {t.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* CTA bar — every article funnels back to the product. Rendered
          before related posts so even bouncing readers see the offer. */}
      <section className="border-y border-border bg-card/40">
        <div className="container max-w-4xl py-14 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            Try LocateFlow
          </p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Keep provider records, addresses, and renewal reminders in one place.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Create an account in a minute. Trial length, renewal date, price, and any payment requirement are shown before checkout.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg" className="px-8">
              <Link href="/sign-up">
                Start free access
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Keep reading — same-category first, then recents in same locale */}
      {related.length > 0 ? (
        <section className="container max-w-6xl py-16">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Keep reading
            </h2>
            <Link
              href="/blog"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition hover:text-primary"
            >
              All stories →
            </Link>
          </div>
          <ul className="grid gap-x-8 gap-y-12 md:grid-cols-3">
            {related.map((p) => (
              <li key={`${p.locale}-${p.slug}`}>
                <Link href={blogPostPath(p.slug, p.locale)} className="group block">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-card/40">
                    {p.ogImageUrl ? (
                      <Image
                        src={p.ogImageUrl}
                        alt={p.title}
                        fill
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <BlogHeroFallback variant="card" />
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {p.category ? p.category.name : "Field Notes"} · {p.readingMinutes} min
                    </div>
                    <h3 className="font-display text-lg font-semibold leading-tight text-foreground transition group-hover:text-primary">
                      {p.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
