import type {
  BackupCompatibilityMetadata,
  BackupEnvironmentMetadata,
} from "@/lib/backup-metadata";

export interface BackupArchiveMetadata {
  backupId: string;
  fileName: string;
  createdAt: string;
  createdBy: string;
  type: string;
  format: string;
  tables: string[];
  tableCount: number;
  totalRecords: number;
  tableCounts: Record<string, number>;
  // Names of tables whose rowcount hit the per-table ceiling and were
  // truncated. Empty/omitted for FULL archives. P0-4 keeps this field
  // in archive metadata so a restore tool can refuse to merge a
  // PARTIAL backup over a FULL one without an explicit override.
  truncatedTables?: string[];
  // Tables the cron path could not enumerate (the per-table fetcher
  // threw — usually a Prisma client/schema mismatch). Distinct from
  // truncatedTables so a restore tool can tell "we tried and failed"
  // vs. "we hit the row ceiling and stopped early."
  failedTables?: string[];
  maxRowsPerTable?: number;
  environment?: BackupEnvironmentMetadata | null;
  compatibility?: BackupCompatibilityMetadata | null;
}

export type BackupArchivePayload =
  | {
      type: "plain";
      rawContent: string;
      data: Record<string, any[]>;
    }
  | {
      type: "encrypted";
      encryptedData: string;
      iv: string;
      authTag: string;
    };

export interface BackupArchive {
  version: 1;
  metadata: BackupArchiveMetadata;
  signature: string | null;
  payload: BackupArchivePayload;
}

function normalizeDataMap(raw: any): Record<string, any[]> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, any[]] => Array.isArray(entry[1]))
  );
}

function normalizeStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((value): value is string => typeof value === "string")
    : [];
}

function normalizeEnvironmentMetadata(raw: any): BackupEnvironmentMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  if (
    typeof raw.name !== "string" ||
    typeof raw.nodeEnv !== "string" ||
    typeof raw.databaseFingerprint !== "string"
  ) {
    return null;
  }

  return {
    name: raw.name,
    nodeEnv: raw.nodeEnv,
    appEnv: typeof raw.appEnv === "string" ? raw.appEnv : null,
    vercelEnv: typeof raw.vercelEnv === "string" ? raw.vercelEnv : null,
    digitalOceanAppIdPresent: Boolean(raw.digitalOceanAppIdPresent),
    databaseFingerprint: raw.databaseFingerprint,
  };
}

function normalizeCompatibilityMetadata(raw: any): BackupCompatibilityMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  if (
    typeof raw.appVersion !== "string" ||
    typeof raw.schemaHash !== "string" ||
    typeof raw.backupTableCatalogHash !== "string"
  ) {
    return null;
  }

  return {
    appVersion: raw.appVersion,
    buildId: typeof raw.buildId === "string" ? raw.buildId : null,
    gitCommit: typeof raw.gitCommit === "string" ? raw.gitCommit : null,
    schemaHash: raw.schemaHash,
    schemaHashAlgorithm: "sha256-prisma-dmmf-v1",
    backupTableCatalogHash: raw.backupTableCatalogHash,
  };
}

function normalizeArchiveMetadata(metadata: any): BackupArchiveMetadata {
  const tables = normalizeStringArray(metadata.tables);
  const tableCounts =
    metadata.tableCounts && typeof metadata.tableCounts === "object"
      ? Object.fromEntries(
          Object.entries(metadata.tableCounts).filter(
            (entry): entry is [string, number] =>
              typeof entry[0] === "string" && typeof entry[1] === "number",
          ),
        )
      : {};

  return {
    backupId: typeof metadata.backupId === "string" ? metadata.backupId : "unknown",
    fileName: typeof metadata.fileName === "string" ? metadata.fileName : "backup.json",
    createdAt:
      typeof metadata.createdAt === "string"
        ? metadata.createdAt
        : new Date(0).toISOString(),
    createdBy: typeof metadata.createdBy === "string" ? metadata.createdBy : "unknown",
    type: typeof metadata.type === "string" ? metadata.type : "FULL",
    format: typeof metadata.format === "string" ? metadata.format : "JSON",
    tables,
    tableCount:
      typeof metadata.tableCount === "number" ? metadata.tableCount : tables.length,
    totalRecords:
      typeof metadata.totalRecords === "number" ? metadata.totalRecords : 0,
    tableCounts,
    truncatedTables: normalizeStringArray(metadata.truncatedTables),
    failedTables: normalizeStringArray(metadata.failedTables),
    maxRowsPerTable:
      typeof metadata.maxRowsPerTable === "number"
        ? metadata.maxRowsPerTable
        : undefined,
    environment: normalizeEnvironmentMetadata(metadata.environment),
    compatibility: normalizeCompatibilityMetadata(metadata.compatibility),
  };
}

export function createBackupArchive(input: {
  metadata: BackupArchiveMetadata;
  rawContent: string;
  signature: string | null;
  encrypted?: {
    encryptedData: string;
    iv: string;
    authTag: string;
  } | null;
}): BackupArchive {
  if (input.encrypted) {
    return {
      version: 1,
      metadata: input.metadata,
      signature: input.signature,
      payload: {
        type: "encrypted",
        encryptedData: input.encrypted.encryptedData,
        iv: input.encrypted.iv,
        authTag: input.encrypted.authTag,
      },
    };
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(input.rawContent);
  } catch {
    parsed = null;
  }

  return {
    version: 1,
    metadata: input.metadata,
    signature: input.signature,
    payload: {
      type: "plain",
      rawContent: input.rawContent,
      data: normalizeDataMap(parsed?.data ?? parsed),
    },
  };
}

export function parseBackupArchive(input: unknown): BackupArchive | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, any>;
  const metadata = value.metadata;
  const payload = value.payload;

  if (value.version !== 1 || !metadata || typeof metadata !== "object" || !payload || typeof payload !== "object") {
    return null;
  }

  const normalizedMetadata = normalizeArchiveMetadata(metadata);

  if (payload.type === "encrypted") {
    if (
      typeof payload.encryptedData !== "string" ||
      typeof payload.iv !== "string" ||
      typeof payload.authTag !== "string"
    ) {
      return null;
    }

    return {
      version: 1,
      metadata: normalizedMetadata,
      signature: typeof value.signature === "string" ? value.signature : null,
      payload: {
        type: "encrypted",
        encryptedData: payload.encryptedData,
        iv: payload.iv,
        authTag: payload.authTag,
      },
    };
  }

  if (payload.type === "plain") {
    if (typeof payload.rawContent !== "string") return null;
    return {
      version: 1,
      metadata: normalizedMetadata,
      signature: typeof value.signature === "string" ? value.signature : null,
      payload: {
        type: "plain",
        rawContent: payload.rawContent,
        data: normalizeDataMap(payload.data),
      },
    };
  }

  return null;
}

export function extractBackupPreview(input: unknown): {
  archive: BackupArchive | null;
  isEncrypted: boolean;
  tables: string[];
  tableCounts: Record<string, number>;
  totalRecords: number;
  data: Record<string, any[]> | null;
} {
  const archive = parseBackupArchive(input);
  if (archive) {
    return {
      archive,
      isEncrypted: archive.payload.type === "encrypted",
      tables: archive.metadata.tables,
      tableCounts: archive.metadata.tableCounts,
      totalRecords: archive.metadata.totalRecords,
      data: archive.payload.type === "plain" ? archive.payload.data : null,
    };
  }

  const raw = input as any;
  const data = normalizeDataMap(raw?.data ?? raw);
  const tableCounts = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length]));
  return {
    archive: null,
    isEncrypted: false,
    tables: Object.keys(tableCounts),
    tableCounts,
    totalRecords: Object.values(tableCounts).reduce((sum, count) => sum + count, 0),
    data,
  };
}
