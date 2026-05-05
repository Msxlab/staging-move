import { isBillingProductionLike } from "@/lib/billing-config";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export async function getConfiguredAppUrl(): Promise<string> {
  const appUrl =
    normalizeBaseUrl(await getRuntimeConfigValue("APP_URL")) ||
    normalizeBaseUrl(await getRuntimeConfigValue("NEXT_PUBLIC_APP_URL"));
  if (appUrl) return appUrl;

  if (isBillingProductionLike(process.env)) {
    const error = new Error("APP_URL or NEXT_PUBLIC_APP_URL is required in production billing environments");
    error.name = "APP_URL_CONFIG_ERROR";
    throw error;
  }

  return "http://localhost:3000";
}
