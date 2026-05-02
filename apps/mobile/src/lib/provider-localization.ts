import type { TFunction } from "i18next";
import { getCategoryLabel } from "@/lib/recommendation-engine";

type CoverageLike = {
  confidence?: string | null;
  label?: string | null;
  message?: string | null;
};

type ProviderLike = {
  name?: string | null;
  category?: string | null;
  description?: string | null;
  matchReasons?: string[] | null;
};

export function isSpanishLocale(language?: string | null): boolean {
  return (language || "").toLowerCase().startsWith("es");
}

export function getLocalizedCategoryLabel(
  t: TFunction,
  category?: string | null,
  fallback?: string | null,
): string {
  const key = category || "";
  const defaultValue = fallback || (key ? getCategoryLabel(key) : "");
  return String(t(`categories.${key}`, { defaultValue }));
}

export function getLocalizedProviderDescription(
  t: TFunction,
  language: string | undefined,
  provider: ProviderLike,
): string {
  const original = provider.description?.trim() || "";
  if (!isSpanishLocale(language)) return original;

  const providerName = provider.name?.trim() || String(t("providers.title"));
  const category = getLocalizedCategoryLabel(t, provider.category, provider.category || "");
  return String(t("providers.genericDescription", { provider: providerName, category }));
}

export function getLocalizedProviderReason(
  t: TFunction,
  language: string | undefined,
  provider: ProviderLike,
  fallback?: string | null,
): string {
  const original =
    provider.matchReasons?.find((reason) => Boolean(reason?.trim()))?.trim() ||
    fallback?.trim() ||
    getLocalizedCategoryLabel(t, provider.category, provider.category || "");
  if (!isSpanishLocale(language)) return original;

  const category = getLocalizedCategoryLabel(t, provider.category, provider.category || "");
  return String(t("providers.genericRecommendationReason", { category }));
}

export function getLocalizedCoverageLabel(
  t: TFunction,
  language: string | undefined,
  coverage?: CoverageLike | null,
): string {
  if (!coverage) return "";
  if (!isSpanishLocale(language)) return coverage.label || "";
  const confidence = coverage.confidence || "UNKNOWN";
  return String(t(`coverage.${confidence}.label`, { defaultValue: coverage.label || "" }));
}

export function getLocalizedCoverageMessage(
  t: TFunction,
  language: string | undefined,
  coverage?: CoverageLike | null,
): string {
  if (!coverage) return "";
  if (!isSpanishLocale(language)) return coverage.message || "";
  const confidence = coverage.confidence || "UNKNOWN";
  return String(t(`coverage.${confidence}.message`, { defaultValue: coverage.message || "" }));
}
