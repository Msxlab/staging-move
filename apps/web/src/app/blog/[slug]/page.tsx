/**
 * Public /blog/<slug> — detail page.
 *
 * Server component, ISR'd at 1 hour with on-demand revalidation when
 * the admin publishes/unpublishes. Renders the sanitized HTML
 * (already cleaned at write time), emits per-post JSON-LD (Article +
 * Breadcrumb), and sets canonical + hreflang.
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { isBlogLocale } from "@locateflow/shared";
import {
  getPublicPostBySlug,
  listPublishedLocalesForSlug,
  listPublishedSlugs,
} from "@/lib/blog/queries";
import { blogHreflangUrls, blogPostUrl } from "@/lib/blog/urls";
import {
  JsonLd,
  articleSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";
import { BlogViewTracker } from "@/components/blog/view-tracker";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

export async function generateStaticParams() {
  // Pre-render the most recent posts at build time. Older posts still
  // resolve at request time via ISR — `dynamicParams` defaults to
  // true, so anything outside this list rebuilds on demand.
  try {
    const slugs = await listPublishedSlugs(200);
    // De-duplicate by slug (different locales share the URL).
    const unique = Array.from(new Map(slugs.map((s) => [s.slug, s])).values());
    return unique.map((s) => ({ slug: s.slug }));
  } catch {
    return [];
  }
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
      images: post.ogImageUrl
        ? [{ url: post.ogImageUrl, width: 1200, height: 630, alt: post.ogImageAlt ?? post.title }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.seo.title,
      description: post.seo.description,
      images: post.ogImageUrl ? [post.ogImageUrl] : undefined,
    },
  };
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

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <BlogViewTracker slug={post.slug} locale={post.locale} />
      <JsonLd
        id="ld-article"
        data={articleSchema(ctx, {
          url,
          headline: post.title,
          description: post.excerpt,
          image: post.ogImageUrl,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          authorName: post.author.name,
          inLanguage,
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

      <nav className="text-xs text-zinc-500 mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:underline">
          Home
        </Link>{" "}
        ·{" "}
        <Link href="/blog" className="hover:underline">
          Blog
        </Link>
      </nav>

      <header className="mb-8">
        {post.category ? (
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            {post.category.name}
          </span>
        ) : null}
        <h1 className="mt-1 text-4xl font-semibold tracking-tight leading-tight">
          {post.title}
        </h1>
        <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
          {post.excerpt}
        </p>
        <p className="mt-4 text-xs text-zinc-500">
          By {post.author.name} · {new Date(post.publishedAt).toLocaleDateString(locale, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}{" "}
          · {post.readingMinutes} min read
        </p>
      </header>

      {post.ogImageUrl ? (
        <div className="aspect-[1200/630] relative overflow-hidden rounded-lg mb-10 bg-zinc-100 dark:bg-zinc-800">
          <Image
            src={post.ogImageUrl}
            alt={post.ogImageAlt ?? post.title}
            fill
            priority
            sizes="(min-width: 1024px) 768px, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      {/*
        contentHtml was sanitized at write time by `renderBlogContent`
        in the admin pipeline (Tiptap JSON → HTML → sanitize-html
        whitelist → DB). Injecting it here is safe because no public
        write path can put unsanitized HTML in the column.
      */}
      <article
        className="prose prose-zinc dark:prose-invert max-w-none"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />

      {post.tags.length > 0 ? (
        <footer className="mt-12 pt-6 border-t flex flex-wrap gap-2 text-xs">
          {post.tags.map((t) => (
            <span
              key={t.slug}
              className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            >
              {t.name}
            </span>
          ))}
        </footer>
      ) : null}
    </main>
  );
}
