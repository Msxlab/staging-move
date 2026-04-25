import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/shared-encryption";
import { getRuntimeConfigDefinition } from "@/lib/shared-runtime-config";

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
  const definition = getRuntimeConfigDefinition(key);
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

  const envValue = normalizeConfigValue(process.env[key]);
  if (envValue) return envValue;

  if (definition?.key === "GOOGLE_MAPS_API_KEY") {
    return normalizeConfigValue(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  }

  return null;
}

export async function getRequiredRuntimeConfigValues(keys: string[]) {
  const values = await Promise.all(keys.map(async (key) => [key, await getRuntimeConfigValue(key)] as const));
  return Object.fromEntries(values);
}
