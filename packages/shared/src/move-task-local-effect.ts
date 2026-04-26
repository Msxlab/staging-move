import type { MoveTaskEffectType } from "./provider-move-domain";

export interface MoveTaskLocalEffect {
  effectType?: MoveTaskEffectType | string;
  addressContext?: string;
  localOnly?: boolean;
  noExternalAutomation?: boolean;
  appliedAt?: string;
  appliedBy?: string;
  selectedDestinationProviderId?: string | null;
  selectedCustomProviderId?: string | null;
  createdServiceId?: string | null;
  updatedServiceId?: string | null;
  completionMeaning?: string;
}

function stringOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

export function parseMoveTaskLocalEffect(value: unknown): MoveTaskLocalEffect | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const parsed: MoveTaskLocalEffect = {};

  if (typeof source.effectType === "string") parsed.effectType = source.effectType;
  if (typeof source.addressContext === "string") parsed.addressContext = source.addressContext;
  if (typeof source.appliedAt === "string") parsed.appliedAt = source.appliedAt;
  if (typeof source.appliedBy === "string") parsed.appliedBy = source.appliedBy;
  if (typeof source.completionMeaning === "string") parsed.completionMeaning = source.completionMeaning;

  for (const key of ["localOnly", "noExternalAutomation"] as const) {
    if (typeof source[key] === "boolean") parsed[key] = source[key];
  }

  for (const key of [
    "selectedDestinationProviderId",
    "selectedCustomProviderId",
    "createdServiceId",
    "updatedServiceId",
  ] as const) {
    const normalized = stringOrNull(source[key]);
    if (normalized !== undefined) parsed[key] = normalized;
  }

  return parsed;
}
