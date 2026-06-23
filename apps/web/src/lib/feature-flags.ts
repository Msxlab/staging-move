import { prisma } from "@/lib/db";
import { CONSUMER_FREE_FLAG } from "@locateflow/shared";

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  targetType: string;
  targetValue: string | null;
}

let flagCache: Map<string, FeatureFlag> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

function parseOptionalBoolean(value: string | undefined): boolean | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function defaultFlagEnabled(flagName: string): boolean {
  if (flagName !== CONSUMER_FREE_FLAG) return false;
  return parseOptionalBoolean(process.env.CONSUMER_FREE_DEFAULT) ?? false;
}

async function loadFlags(): Promise<Map<string, FeatureFlag>> {
  if (Date.now() - cacheTimestamp < CACHE_TTL && flagCache.size > 0) {
    return flagCache;
  }

  try {
    const flags = await prisma.featureFlag.findMany();
    const map = new Map<string, FeatureFlag>();
    flags.forEach((flag) => map.set(flag.name, {
      name: flag.name,
      enabled: flag.enabled,
      targetType: flag.targetType,
      targetValue: flag.targetValue,
    }));
    flagCache = map;
    cacheTimestamp = Date.now();
    return map;
  } catch {
    return flagCache;
  }
}

export async function isFeatureEnabled(
  flagName: string,
  context?: { userId?: string; plan?: string }
): Promise<boolean> {
  const flags = await loadFlags();
  const flag = flags.get(flagName);
  if (!flag) return defaultFlagEnabled(flagName);
  if (!flag.enabled) return false;

  if (flag.targetType === "ALL") return true;

  if (flag.targetValue) {
    try {
      const target = JSON.parse(flag.targetValue);

      if (flag.targetType === "PERCENTAGE" && target.percentage != null) {
        // Deterministic hash based on userId + flagName
        if (context?.userId) {
          let hash = 0;
          const str = context.userId + flagName;
          for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
          }
          return Math.abs(hash % 100) < target.percentage;
        }
        return Math.random() * 100 < target.percentage;
      }

      if (flag.targetType === "USER_LIST" && target.userIds) {
        return context?.userId ? target.userIds.includes(context.userId) : false;
      }

      if (flag.targetType === "PLAN" && target.plans) {
        return context?.plan ? target.plans.includes(context.plan) : false;
      }
    } catch {
      // Unparseable targetValue → fall through to "no match" below.
    }
  }

  // A targeted flag (targetType !== "ALL") that reaches here could not be evaluated
  // for this context: missing/invalid targetValue, an unknown target type, an empty
  // userIds/plans list, or a parse failure. Match NOBODY rather than letting an
  // enabled-but-targeted flag silently behave as 100%-on. Operators who want a
  // blanket rollout use targetType "ALL" (handled above).
  return false;
}

export function invalidateFlagCache() {
  cacheTimestamp = 0;
  flagCache.clear();
}
