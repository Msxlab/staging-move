import { LEGAL_CONSENT_EVENT, ONBOARDING_COMPLETED_EVENT } from "@/lib/legal";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const USER_EVENT_RETENTION_DAYS_KEY = "USER_EVENT_RETENTION_DAYS";
export const USER_EVENT_RETENTION_ENABLED_KEY = "USER_EVENT_RETENTION_ENABLED";
export const USER_EVENT_RETENTION_BATCH_SIZE_KEY = "USER_EVENT_RETENTION_BATCH_SIZE";
export const DEFAULT_USER_EVENT_RETENTION_DAYS = 180;
export const DEFAULT_USER_EVENT_RETENTION_BATCH_SIZE = 1000;
export const DEFAULT_USER_EVENT_RETENTION_MAX_BATCHES = 20;

const RETAINED_USER_EVENT_NAMES = [LEGAL_CONSENT_EVENT, ONBOARDING_COMPLETED_EVENT] as const;

interface RuntimeValues {
  retentionDays?: string | null;
  enabled?: string | null;
  batchSize?: string | null;
}

export interface UserEventRetentionConfig {
  retentionDays: number;
  enabled: boolean;
  batchSize: number;
  maxBatches: number;
}

interface UserEventRetentionStore {
  count(args: unknown): Promise<number>;
  findMany(args: unknown): Promise<Array<{ id: string }>>;
  deleteMany(args: unknown): Promise<{ count: number }>;
}

export interface UserEventRetentionResult {
  enabled: boolean;
  retentionDays: number;
  cutoffIso: string;
  batchSize: number;
  maxBatches: number;
  eligibleCount: number;
  ageBuckets: {
    retentionToPlus90Days: number;
    plus90ToPlus365Days: number;
    plus365Days: number;
  };
  deletedCount: number;
  batches: number;
  batchLimitReached: boolean;
}

function parseBoolean(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "enabled";
}

function parsePositiveInteger(
  value: string | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

function baseEligibleWhere(createdAt: Record<string, Date>) {
  return {
    createdAt,
    event: { notIn: [...RETAINED_USER_EVENT_NAMES] },
  };
}

export function resolveUserEventRetentionConfig(values: RuntimeValues): UserEventRetentionConfig {
  return {
    retentionDays: parsePositiveInteger(
      values.retentionDays,
      DEFAULT_USER_EVENT_RETENTION_DAYS,
      30,
      3650,
    ),
    enabled: parseBoolean(values.enabled),
    batchSize: parsePositiveInteger(
      values.batchSize,
      DEFAULT_USER_EVENT_RETENTION_BATCH_SIZE,
      1,
      5000,
    ),
    maxBatches: DEFAULT_USER_EVENT_RETENTION_MAX_BATCHES,
  };
}

export async function pruneOldUserEvents(
  userEvent: UserEventRetentionStore,
  config: UserEventRetentionConfig,
  now = new Date(),
): Promise<UserEventRetentionResult> {
  const cutoff = daysAgo(now, config.retentionDays);
  const plus90Cutoff = daysAgo(now, config.retentionDays + 90);
  const plus365Cutoff = daysAgo(now, config.retentionDays + 365);

  const ageBuckets = {
    retentionToPlus90Days: await userEvent.count({
      where: baseEligibleWhere({ lt: cutoff, gte: plus90Cutoff }),
    }),
    plus90ToPlus365Days: await userEvent.count({
      where: baseEligibleWhere({ lt: plus90Cutoff, gte: plus365Cutoff }),
    }),
    plus365Days: await userEvent.count({
      where: baseEligibleWhere({ lt: plus365Cutoff }),
    }),
  };
  const eligibleCount =
    ageBuckets.retentionToPlus90Days + ageBuckets.plus90ToPlus365Days + ageBuckets.plus365Days;

  let deletedCount = 0;
  let batches = 0;
  let batchLimitReached = false;

  if (config.enabled) {
    for (let batch = 0; batch < config.maxBatches; batch += 1) {
      const rows = await userEvent.findMany({
        where: baseEligibleWhere({ lt: cutoff }),
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: config.batchSize,
      });
      if (rows.length === 0) break;

      const deleted = await userEvent.deleteMany({
        where: {
          id: { in: rows.map((row) => row.id) },
          ...baseEligibleWhere({ lt: cutoff }),
        },
      });
      deletedCount += deleted.count;
      batches += 1;

      if (rows.length < config.batchSize) break;
      if (batch === config.maxBatches - 1) batchLimitReached = true;
    }
  }

  return {
    enabled: config.enabled,
    retentionDays: config.retentionDays,
    cutoffIso: cutoff.toISOString(),
    batchSize: config.batchSize,
    maxBatches: config.maxBatches,
    eligibleCount,
    ageBuckets,
    deletedCount,
    batches,
    batchLimitReached,
  };
}
