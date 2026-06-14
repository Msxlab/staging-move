import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/shared-encryption";
import {
  getRuntimeConfigDefinition,
  getRuntimeConfigEnvValue,
  isRuntimeConfigDbBackedKeyAllowed,
  normalizeRuntimeConfigValue,
  shouldPreferEnvRuntimeConfigValue,
} from "@/lib/shared-runtime-config";

interface RuntimeConfigEntryRecord {
  key: string;
  isSecret: boolean;
  valueEncrypted: string | null;
  valuePlain: string | null;
  isActive: boolean;
  source: string;
}

function resolveStoredValue(entry: RuntimeConfigEntryRecord | null | undefined) {
  if (!entry || !entry.isActive) return null;
  if (entry.isSecret) {
    return entry.valueEncrypted ? decrypt(entry.valueEncrypted) : null;
  }
  return entry.valuePlain;
}

export async function getRuntimeConfigValue(key: string): Promise<string | null> {
  const definition = getRuntimeConfigDefinition(key);
  const envValue = normalizeRuntimeConfigValue(getRuntimeConfigEnvValue(key, process.env));
  const preferEnv = shouldPreferEnvRuntimeConfigValue(key, process.env);
  if (preferEnv && envValue) return envValue;

  const entry = await prisma.runtimeConfigEntry.findUnique({
    where: { key },
    select: {
      key: true,
      isSecret: true,
      valueEncrypted: true,
      valuePlain: true,
      isActive: true,
      source: true,
    },
  }).catch(() => null as RuntimeConfigEntryRecord | null);

  const storedValue = normalizeRuntimeConfigValue(resolveStoredValue(entry));
  if (storedValue && definition && isRuntimeConfigDbBackedKeyAllowed(definition)) {
    return storedValue;
  }

  if (envValue) return envValue;

  return null;
}

export async function getRequiredRuntimeConfigValues(keys: string[]) {
  const uniqueKeys = Array.from(new Set(keys));
  const values = new Map<string, string | null>();
  const dbBackedKeys: string[] = [];

  for (const key of uniqueKeys) {
    const envValue = normalizeRuntimeConfigValue(getRuntimeConfigEnvValue(key, process.env));
    if (shouldPreferEnvRuntimeConfigValue(key, process.env) && envValue) {
      values.set(key, envValue);
      continue;
    }
    values.set(key, envValue);
    const definition = getRuntimeConfigDefinition(key);
    if (definition && isRuntimeConfigDbBackedKeyAllowed(definition)) {
      dbBackedKeys.push(key);
    }
  }

  const entries =
    dbBackedKeys.length > 0
      ? await prisma.runtimeConfigEntry
          .findMany({
            where: { key: { in: dbBackedKeys } },
            select: {
              key: true,
              isSecret: true,
              valueEncrypted: true,
              valuePlain: true,
              isActive: true,
              source: true,
            },
          })
          .catch(() => [] as RuntimeConfigEntryRecord[])
      : [];

  for (const entry of entries) {
    const storedValue = normalizeRuntimeConfigValue(resolveStoredValue(entry));
    if (storedValue) values.set(entry.key, storedValue);
  }

  return Object.fromEntries(uniqueKeys.map((key) => [key, values.get(key) ?? null]));
}
