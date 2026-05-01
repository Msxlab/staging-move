import type { BlogLocale } from "@locateflow/shared";

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

export function blogHreflangUrls(siteUrl: string, slug: string): Record<string, string> {
  return {
    "en-US": blogPostUrl(siteUrl, slug, "en" satisfies BlogLocale),
    "es-US": blogPostUrl(siteUrl, slug, "es" satisfies BlogLocale),
    "x-default": blogPostUrl(siteUrl, slug, "en" satisfies BlogLocale),
  };
}
