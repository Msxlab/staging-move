import type { BlogLocale } from "@locateflow/shared";

const BLOG_LOCALES: BlogLocale[] = ["en", "es"];

export function blogPostPath(slug: string, locale: string | null | undefined): string {
  return locale === "es" ? `/blog/${slug}?locale=es` : `/blog/${slug}`;
}

export function blogPostUrl(
  siteUrl: string,
  slug: string,
  locale: string | null | undefined,
): string {
  return `${siteUrl.replace(/\/+$/, "")}${blogPostPath(slug, locale)}`;
}

export function blogCategoryPath(slug: string, locale?: string | null): string {
  return locale === "es" ? `/blog/category/${slug}?locale=es` : `/blog/category/${slug}`;
}

export function blogCategoryUrl(
  siteUrl: string,
  slug: string,
  locale?: string | null,
): string {
  return `${siteUrl.replace(/\/+$/, "")}${blogCategoryPath(slug, locale)}`;
}

export function blogHreflangUrls(
  siteUrl: string,
  slug: string,
  publishedLocales: Array<string | null | undefined> = BLOG_LOCALES,
): Record<string, string> {
  const locales = BLOG_LOCALES.filter((locale) => publishedLocales.includes(locale));
  const fallbackLocale = locales.includes("en") ? "en" : locales[0] || "en";
  const urls: Record<string, string> = {
    "x-default": blogPostUrl(siteUrl, slug, fallbackLocale),
  };
  if (locales.includes("en")) {
    urls["en-US"] = blogPostUrl(siteUrl, slug, "en");
  }
  if (locales.includes("es")) {
    urls["es-US"] = blogPostUrl(siteUrl, slug, "es");
  }
  return urls;
}
