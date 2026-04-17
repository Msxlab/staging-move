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

  const storedValue = resolveStoredValue(entry);
  if (storedValue) return storedValue;

  const envValue = process.env[key];
  if (envValue) return envValue;

  if (definition?.key === "GOOGLE_MAPS_API_KEY") {
    return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;
  }

  return null;
}

export async function getRequiredRuntimeConfigValues(keys: string[]) {
  const values = await Promise.all(keys.map(async (key) => [key, await getRuntimeConfigValue(key)] as const));
  return Object.fromEntries(values);
}
