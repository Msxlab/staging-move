import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/shared-encryption";
import { getRuntimeConfigDefinition, maskRuntimeConfigValue, RUNTIME_CONFIG_DEFINITIONS, type RuntimeConfigDefinition } from "@/lib/shared-runtime-config";

export interface RuntimeConfigCatalogItem {
  key: string;
  label: string;
  description: string;
  scope: string;
  category: string;
  isSecret: boolean;
  requiredInProduction: boolean;
  configured: boolean;
  source: "DB" | "ENV" | "MISSING";
  maskedValue: string | null;
  updatedAt: string | null;
  lastValidatedAt: string | null;
  lastValidationStatus: string | null;
}

interface RuntimeConfigEntryRecord {
  key: string;
  isSecret: boolean;
  valueEncrypted: string | null;
  valuePlain: string | null;
  isActive: boolean;
  source: string;
  updatedAt: Date;
  lastValidatedAt: Date | null;
  lastValidationStatus: string | null;
}

function resolveEntryValue(entry: RuntimeConfigEntryRecord | null | undefined) {
  if (!entry || !entry.isActive) return null;
  if (entry.isSecret) {
    return entry.valueEncrypted ? decrypt(entry.valueEncrypted) : null;
  }
  return entry.valuePlain;
}

function resolveEnvValue(definition: RuntimeConfigDefinition) {
  if (definition.key === "GOOGLE_MAPS_API_KEY") {
    return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;
  }
  return process.env[definition.key] || null;
}

export async function getAdminRuntimeConfigValue(key: string): Promise<string | null> {
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
      updatedAt: true,
      lastValidatedAt: true,
      lastValidationStatus: true,
    },
  }).catch(() => null as RuntimeConfigEntryRecord | null);

  const storedValue = resolveEntryValue(entry);
  if (storedValue) return storedValue;
  if (definition) return resolveEnvValue(definition);
  return process.env[key] || null;
}

export async function getAdminRuntimeConfigValues(keys: string[]) {
  const values = await Promise.all(keys.map(async (key) => [key, await getAdminRuntimeConfigValue(key)] as const));
  return Object.fromEntries(values);
}

function buildCatalogItem(
  definition: RuntimeConfigDefinition,
  entry: RuntimeConfigEntryRecord | null | undefined
): RuntimeConfigCatalogItem {
  const entryValue = resolveEntryValue(entry);
  const envValue = resolveEnvValue(definition);
  const configuredValue = entryValue || envValue;
  const source: RuntimeConfigCatalogItem["source"] = entryValue ? "DB" : envValue ? "ENV" : "MISSING";

  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    scope: definition.scope,
    category: definition.category,
    isSecret: definition.isSecret,
    requiredInProduction: definition.requiredInProduction,
    configured: !!configuredValue,
    source,
    maskedValue: configuredValue ? maskRuntimeConfigValue(configuredValue, definition.maskStrategy) : null,
    updatedAt: entry?.updatedAt?.toISOString() || null,
    lastValidatedAt: entry?.lastValidatedAt?.toISOString() || null,
    lastValidationStatus: entry?.lastValidationStatus || null,
  };
}

export async function listRuntimeConfigCatalog(): Promise<RuntimeConfigCatalogItem[]> {
  const entries = await prisma.runtimeConfigEntry.findMany({
    select: {
      key: true,
      isSecret: true,
      valueEncrypted: true,
      valuePlain: true,
      isActive: true,
      source: true,
      updatedAt: true,
      lastValidatedAt: true,
      lastValidationStatus: true,
    },
  }).catch(() => [] as RuntimeConfigEntryRecord[]);
  const entryMap = new Map<string, RuntimeConfigEntryRecord>(entries.map((entry) => [entry.key, entry]));

  return RUNTIME_CONFIG_DEFINITIONS
    .map((definition) => buildCatalogItem(definition, entryMap.get(definition.key)))
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
}

export async function upsertRuntimeConfigEntry(input: {
  key: string;
  value: string;
  adminId: string;
  note?: string | null;
}) {
  const definition = getRuntimeConfigDefinition(input.key);
  if (!definition) {
    throw new Error("UNKNOWN_RUNTIME_CONFIG_KEY");
  }

  const trimmed = input.value.trim();
  if (!trimmed) {
    throw new Error("EMPTY_RUNTIME_CONFIG_VALUE");
  }

  const data = {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    scope: definition.scope,
    category: definition.category,
    isSecret: definition.isSecret,
    valueEncrypted: definition.isSecret ? encrypt(trimmed) : null,
    valuePlain: definition.isSecret ? null : trimmed,
    isActive: true,
    source: "DB",
    updatedByAdminId: input.adminId,
    rotationNotes: input.note || null,
    lastValidatedAt: new Date(),
    lastValidationStatus: "CONFIGURED",
  };

  return prisma.runtimeConfigEntry.upsert({
    where: { key: definition.key },
    update: data,
    create: data,
  });
}

export async function resetRuntimeConfigEntry(key: string, adminId: string) {
  const definition = getRuntimeConfigDefinition(key);
  if (!definition) {
    throw new Error("UNKNOWN_RUNTIME_CONFIG_KEY");
  }

  const existing = await prisma.runtimeConfigEntry.findUnique({ where: { key } });
  if (!existing) return null;

  return prisma.runtimeConfigEntry.update({
    where: { key },
    data: {
      isActive: false,
      source: "ENV",
      updatedByAdminId: adminId,
      lastValidatedAt: new Date(),
      lastValidationStatus: resolveEnvValue(definition) ? "ENV_FALLBACK" : "MISSING",
    },
  });
}
