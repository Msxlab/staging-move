import { createHash } from "crypto";
import { Prisma } from "@locateflow/db";
import { BACKUP_TABLE_ORDER, BACKUP_TABLES } from "@/lib/backup-tables";

export interface BackupEnvironmentMetadata {
  name: string;
  nodeEnv: string;
  appEnv: string | null;
  vercelEnv: string | null;
  digitalOceanAppIdPresent: boolean;
  databaseFingerprint: string;
}

export interface BackupCompatibilityMetadata {
  appVersion: string;
  buildId: string | null;
  gitCommit: string | null;
  schemaHash: string;
  schemaHashAlgorithm: "sha256-prisma-dmmf-v1";
  backupTableCatalogHash: string;
}

export interface BackupRuntimeMetadata {
  environment: BackupEnvironmentMetadata;
  compatibility: BackupCompatibilityMetadata;
}

const SECRET_ENV_NAME_PATTERN =
  /(SECRET|TOKEN|PASSWORD|PRIVATE|DATABASE_URL|ENCRYPTION_KEY|ACCESS_KEY|API_KEY|WEBHOOK|DSN)/i;

function sha256Hex(value: unknown) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
}

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveEnvironmentName(env: NodeJS.ProcessEnv) {
  return (
    normalizeEnvValue(env.APP_ENV) ||
    normalizeEnvValue(env.VERCEL_ENV) ||
    normalizeEnvValue(env.NODE_ENV) ||
    "development"
  ).toLowerCase();
}

function getSafeDatabaseIdentity(env: NodeJS.ProcessEnv) {
  const rawUrl = env.DATABASE_URL || env.MYSQL_DATABASE_URL || "";
  if (!rawUrl) return { present: false };

  try {
    const parsed = new URL(rawUrl);
    return {
      present: true,
      protocol: parsed.protocol.replace(/:$/, "").toLowerCase(),
      hostname: parsed.hostname.toLowerCase(),
      port: parsed.port || "",
      database: parsed.pathname.replace(/^\/+/, ""),
    };
  } catch {
    return { present: true, parseable: false };
  }
}

export function getCurrentBackupEnvironmentMetadata(
  env: NodeJS.ProcessEnv = process.env,
): BackupEnvironmentMetadata {
  const name = resolveEnvironmentName(env);
  return {
    name,
    nodeEnv: normalizeEnvValue(env.NODE_ENV) || "development",
    appEnv: normalizeEnvValue(env.APP_ENV),
    vercelEnv: normalizeEnvValue(env.VERCEL_ENV),
    digitalOceanAppIdPresent: Boolean(normalizeEnvValue(env.DIGITALOCEAN_APP_ID)),
    databaseFingerprint: sha256Hex({
      environment: name,
      database: getSafeDatabaseIdentity(env),
    }),
  };
}

export function getBackupSchemaHash(): string {
  const models = Prisma.dmmf.datamodel.models
    .map((model) => ({
      name: model.name,
      fields: model.fields.map((field) => ({
        name: field.name,
        kind: field.kind,
        type: field.type,
        isList: field.isList,
        isRequired: field.isRequired,
        isUnique: field.isUnique,
        relationName: field.relationName || null,
        dbName: field.dbName || null,
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return sha256Hex({
    prismaClientVersion: Prisma.prismaVersion.client,
    models,
  });
}

function getBackupTableCatalogHash() {
  return sha256Hex({
    order: BACKUP_TABLE_ORDER,
    tables: Object.fromEntries(
      Object.entries(BACKUP_TABLES).map(([key, value]) => [
        key,
        { model: value.model, label: value.label },
      ]),
    ),
  });
}

export function getBackupCompatibilityMetadata(
  env: NodeJS.ProcessEnv = process.env,
): BackupCompatibilityMetadata {
  return {
    appVersion: normalizeEnvValue(env.npm_package_version) || "0.1.0",
    buildId:
      normalizeEnvValue(env.NEXT_BUILD_ID) ||
      normalizeEnvValue(env.BUILD_ID) ||
      null,
    gitCommit:
      normalizeEnvValue(env.VERCEL_GIT_COMMIT_SHA) ||
      normalizeEnvValue(env.GITHUB_SHA) ||
      normalizeEnvValue(env.SOURCE_VERSION) ||
      normalizeEnvValue(env.COMMIT_SHA) ||
      null,
    schemaHash: getBackupSchemaHash(),
    schemaHashAlgorithm: "sha256-prisma-dmmf-v1",
    backupTableCatalogHash: getBackupTableCatalogHash(),
  };
}

export function getBackupRuntimeMetadata(
  env: NodeJS.ProcessEnv = process.env,
): BackupRuntimeMetadata {
  return {
    environment: getCurrentBackupEnvironmentMetadata(env),
    compatibility: getBackupCompatibilityMetadata(env),
  };
}

export function redactBackupSecretText(input: unknown): string {
  const text = input instanceof Error ? input.message : String(input ?? "");
  let redacted = text
    .replace(
      /\b(mysql|postgres(?:ql)?):\/\/[^@\s]+@/gi,
      "$1://[redacted]@",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
    .replace(/\b(signature|token|secret|password|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]");

  for (const [name, value] of Object.entries(process.env)) {
    if (!value || value.length < 8 || !SECRET_ENV_NAME_PATTERN.test(name)) {
      continue;
    }
    redacted = redacted.split(value).join("[redacted]");
  }

  return redacted;
}

function redactMetadataValue(value: unknown): unknown {
  if (typeof value === "string") return redactBackupSecretText(value);
  if (Array.isArray(value)) return value.map(redactMetadataValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, redactMetadataValue(nested)]),
  );
}

export function redactBackupMetadata<T>(value: T): T {
  return redactMetadataValue(value) as T;
}

