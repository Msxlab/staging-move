import { getRuntimeConfigValue } from "@/lib/runtime-config";
import type { ScoringWeights } from "@/lib/recommendation-engine";

const RUNTIME_CONFIG_KEY = "RECOMMENDATION_SCORING_WEIGHTS";
const CACHE_TTL_MS = 60_000;

let cachedOverrides: Partial<ScoringWeights> | undefined;
let cachedAt = 0;

function sanitizeNumberRecord(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && Number.isFinite(raw)) out[key] = raw;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeOverrides(parsed: unknown): Partial<ScoringWeights> | undefined {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const source = parsed as Record<string, unknown>;
  const overrides: Partial<ScoringWeights> = {};

  const urgencyTier = sanitizeNumberRecord(source.urgencyTier);
  if (urgencyTier) overrides.urgencyTier = urgencyTier as ScoringWeights["urgencyTier"];

  const coverageScore = sanitizeNumberRecord(source.coverageScore);
  if (coverageScore) overrides.coverageScore = coverageScore as ScoringWeights["coverageScore"];

  const addressSensitivePenalty = sanitizeNumberRecord(source.addressSensitivePenalty);
  if (addressSensitivePenalty) overrides.addressSensitivePenalty = addressSensitivePenalty;

  const essentialCategories = sanitizeNumberRecord(source.essentialCategories);
  if (essentialCategories) overrides.essentialCategories = essentialCategories;

  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

/**
 * Reads optional scoring-weight overrides from runtime config.
 * Fully defensive: any failure (missing config, bad JSON, unavailable DB)
 * resolves to undefined so the recommendations route falls back to the
 * engine's built-in defaults instead of erroring.
 */
export async function getScoringWeightOverrides(): Promise<Partial<ScoringWeights> | undefined> {
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS) return cachedOverrides;

  let resolved: Partial<ScoringWeights> | undefined;
  try {
    const raw = await getRuntimeConfigValue(RUNTIME_CONFIG_KEY);
    if (raw) resolved = sanitizeOverrides(JSON.parse(raw));
  } catch {
    resolved = undefined;
  }

  cachedOverrides = resolved;
  cachedAt = now;
  return resolved;
}
