import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/shared-encryption";
import {
  getRuntimeConfigEnvValue,
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

function normalizeConfigValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }
  return trimmed;
}

export async function getRuntimeConfigValue(key: string): Promise<string | null> {
  const envValue = normalizeConfigValue(getRuntimeConfigEnvValue(key, process.env));
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

  const storedValue = normalizeConfigValue(resolveStoredValue(entry));
  if (storedValue) return storedValue;

  if (envValue) return envValue;

  return null;
}

export async function getRequiredRuntimeConfigValues(keys: string[]) {
  const values = await Promise.all(keys.map(async (key) => [key, await getRuntimeConfigValue(key)] as const));
  return Object.fromEntries(values);
}
