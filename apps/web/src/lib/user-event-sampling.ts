import { isPhase1AnalyticsEvent } from "@locateflow/shared";

export const USER_EVENT_SAMPLING_ENABLED_KEY = "USER_EVENT_SAMPLING_ENABLED";
export const USER_EVENT_SAMPLING_RATE_KEY = "USER_EVENT_SAMPLING_RATE";
export const DEFAULT_USER_EVENT_SAMPLING_RATE = 1;

interface RuntimeValues {
  enabled?: string | null;
  rate?: string | null;
}

export interface UserEventSamplingConfig {
  enabled: boolean;
  sampleRate: number;
}

function parseBoolean(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "enabled";
}

function parseSampleRate(value: string | null | undefined): number {
  if (value === null || value === undefined || value.trim() === "") return DEFAULT_USER_EVENT_SAMPLING_RATE;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_USER_EVENT_SAMPLING_RATE;
  return Math.min(1, Math.max(0, parsed));
}

export function resolveUserEventSamplingConfig(values: RuntimeValues): UserEventSamplingConfig {
  return {
    enabled: parseBoolean(values.enabled),
    sampleRate: parseSampleRate(values.rate),
  };
}

export function shouldPersistUserEvent(
  event: string,
  config: UserEventSamplingConfig,
  random: () => number = Math.random,
): boolean {
  if (isPhase1AnalyticsEvent(event)) return true;
  if (!config.enabled) return true;
  return random() < config.sampleRate;
}
