import { createHash, createHmac } from "crypto";
import { getAdminRuntimeConfigValues } from "@/lib/runtime-config";

const BACKUP_STORAGE_KEYS = [
  "BACKUP_STORAGE_PROVIDER",
  "BACKUP_STORAGE_BUCKET",
  "BACKUP_STORAGE_REGION",
  "BACKUP_STORAGE_ENDPOINT",
  "BACKUP_STORAGE_ACCESS_KEY_ID",
  "BACKUP_STORAGE_SECRET_ACCESS_KEY",
] as const;

type BackupStorageProvider =
  | "s3"
  | "s3-compatible"
  | "aws-s3"
  | "r2"
  | "cloudflare-r2";

export interface BackupOffsiteMetadata {
  status: "stored" | "disabled" | "failed";
  provider: string | null;
  bucket: string | null;
  region: string | null;
  endpoint: string | null;
  objectKey: string | null;
  location: string | null;
  uploadedAt: string | null;
  reason: string | null;
}

export interface BackupArchiveRecordMetadata {
  encrypted: boolean;
  signature: boolean;
  totalRecords: number | null;
  tableCounts: Record<string, number>;
  archiveSizeWarning?: string | null;
  // Names of tables whose rowcount hit the per-table ceiling. Omitted
  // for FULL archives; populated when the archive is PARTIAL so the
  // record's metadata matches the archive's own self-description.
  truncatedTables?: string[];
  failedTables?: string[];
  maxRowsPerTable?: number;
}

export interface BackupRecordMetadata {
  offsite?: BackupOffsiteMetadata | null;
  archive?: BackupArchiveRecordMetadata | null;
  error?: string | null;
}

export interface BackupStorageSummary {
  provider: string | null;
  bucket: string | null;
  region: string | null;
  endpoint: string | null;
  configured: boolean;
  credentialsConfigured: boolean;
  ready: boolean;
  unsupportedProvider: boolean;
}

interface BackupStorageConfig {
  provider: string | null;
  bucket: string | null;
  region: string | null;
  endpoint: string | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
}

function normalizeValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeProvider(
  value: string | null | undefined,
): BackupStorageProvider | null {
  const normalized = normalizeValue(value)?.toLowerCase();
  if (
    normalized === "s3" ||
    normalized === "s3-compatible" ||
    normalized === "aws-s3" ||
    normalized === "r2" ||
    normalized === "cloudflare-r2"
  ) {
    return normalized;
  }
  return null;
}

async function resolveBackupStorageConfig(): Promise<BackupStorageConfig> {
  const values = await getAdminRuntimeConfigValues([...BACKUP_STORAGE_KEYS]);
  return {
    provider: normalizeProvider(values.BACKUP_STORAGE_PROVIDER),
    bucket: normalizeValue(values.BACKUP_STORAGE_BUCKET),
    region: normalizeValue(values.BACKUP_STORAGE_REGION),
    endpoint: normalizeValue(values.BACKUP_STORAGE_ENDPOINT),
    accessKeyId: normalizeValue(values.BACKUP_STORAGE_ACCESS_KEY_ID),
    secretAccessKey: normalizeValue(values.BACKUP_STORAGE_SECRET_ACCESS_KEY),
  };
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function buildObjectUrl(baseUrl: URL, bucket: string, objectKey: string) {
  const encodedObjectKey = objectKey.split("/").map(encodeRfc3986).join("/");
  const prefix = baseUrl.pathname.replace(/\/+$/, "");
  const pathname = `${prefix}/${bucket}/${encodedObjectKey}`.replace(
    /\/+/g,
    "/",
  );
  const target = new URL(baseUrl.toString());
  target.pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return target;
}

function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function getSignatureKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
) {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function buildSignedStorageRequest(input: {
  config: BackupStorageConfig;
  method: "PUT" | "GET";
  objectKey: string;
  payloadHash: string;
  requestDate?: Date;
}) {
  const endpointValue =
    input.config.endpoint || `https://s3.${input.config.region}.amazonaws.com`;
  const baseUrl = new URL(
    endpointValue.startsWith("http://") || endpointValue.startsWith("https://")
      ? endpointValue
      : `https://${endpointValue}`,
  );
  const date = input.requestDate || new Date();
  const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = `${dateStamp}T${date.toISOString().slice(11, 19).replace(/:/g, "")}Z`;
  const requestUrl = buildObjectUrl(
    baseUrl,
    input.config.bucket!,
    input.objectKey,
  );
  const canonicalHeaders = `host:${requestUrl.host}\nx-amz-content-sha256:${input.payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    input.method,
    requestUrl.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${input.config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = getSignatureKey(
    input.config.secretAccessKey!,
    dateStamp,
    input.config.region!,
    "s3",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${input.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    requestUrl,
    authorization,
    amzDate,
  };
}

function createOffsiteMetadata(
  status: BackupOffsiteMetadata["status"],
  config: BackupStorageConfig,
  overrides: Partial<BackupOffsiteMetadata> = {},
): BackupOffsiteMetadata {
  return {
    status,
    provider: config.provider,
    bucket: config.bucket,
    region: config.region,
    endpoint: config.endpoint,
    objectKey: null,
    location: null,
    uploadedAt: null,
    reason: null,
    ...overrides,
  };
}

function normalizeOffsiteMetadata(input: any): BackupOffsiteMetadata | null {
  if (!input || typeof input !== "object") return null;
  if (!["stored", "disabled", "failed"].includes(input.status)) return null;
  return {
    status: input.status,
    provider: typeof input.provider === "string" ? input.provider : null,
    bucket: typeof input.bucket === "string" ? input.bucket : null,
    region: typeof input.region === "string" ? input.region : null,
    endpoint: typeof input.endpoint === "string" ? input.endpoint : null,
    objectKey: typeof input.objectKey === "string" ? input.objectKey : null,
    location: typeof input.location === "string" ? input.location : null,
    uploadedAt: typeof input.uploadedAt === "string" ? input.uploadedAt : null,
    reason: typeof input.reason === "string" ? input.reason : null,
  };
}

function normalizeArchiveRecordMetadata(
  input: any,
): BackupArchiveRecordMetadata | null {
  if (!input || typeof input !== "object") return null;
  const tableCounts =
    input.tableCounts && typeof input.tableCounts === "object"
      ? Object.fromEntries(
          Object.entries(input.tableCounts).filter(
            (entry): entry is [string, number] =>
              typeof entry[0] === "string" && typeof entry[1] === "number",
          ),
        )
      : {};

  return {
    encrypted: Boolean(input.encrypted),
    signature: Boolean(input.signature),
    totalRecords:
      typeof input.totalRecords === "number" ? input.totalRecords : null,
    tableCounts,
    archiveSizeWarning:
      typeof input.archiveSizeWarning === "string"
        ? input.archiveSizeWarning
        : null,
  };
}

export function parseBackupRecordMetadata(
  raw: string | null | undefined,
): BackupRecordMetadata {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { error: raw };
    return {
      offsite: normalizeOffsiteMetadata((parsed as any).offsite),
      archive: normalizeArchiveRecordMetadata((parsed as any).archive),
      error:
        typeof (parsed as any).error === "string"
          ? (parsed as any).error
          : null,
    };
  } catch {
    return { error: raw };
  }
}

export function serializeBackupRecordMetadata(
  metadata: BackupRecordMetadata,
): string | null {
  const payload: BackupRecordMetadata = {};
  if (metadata.offsite) payload.offsite = metadata.offsite;
  if (metadata.archive) payload.archive = metadata.archive;
  if (metadata.error) payload.error = metadata.error;
  return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
}

export async function getBackupStorageSummary(): Promise<BackupStorageSummary> {
  const config = await resolveBackupStorageConfig();
  const provider = normalizeProvider(config.provider);
  const unsupportedProvider = Boolean(config.provider && !provider);
  const configured = Boolean(config.provider && config.bucket && config.region);
  const credentialsConfigured = Boolean(
    config.accessKeyId && config.secretAccessKey,
  );

  return {
    provider: config.provider,
    bucket: config.bucket,
    region: config.region,
    endpoint: config.endpoint,
    configured,
    credentialsConfigured,
    ready: Boolean(provider && configured && credentialsConfigured),
    unsupportedProvider,
  };
}

export async function uploadBackupArchive(input: {
  backupId: string;
  fileName: string;
  archiveBody: string | Buffer;
}): Promise<BackupOffsiteMetadata> {
  const config = await resolveBackupStorageConfig();
  const provider = normalizeProvider(config.provider);

  if (!config.provider) {
    return createOffsiteMetadata("disabled", config, {
      reason: "Offsite backup storage is not configured.",
    });
  }

  if (!provider) {
    return createOffsiteMetadata("failed", config, {
      reason: `Unsupported backup storage provider: ${config.provider}`,
    });
  }

  if (!config.bucket || !config.region) {
    return createOffsiteMetadata("failed", config, {
      reason: "Backup storage bucket or region is missing.",
    });
  }

  if (!config.accessKeyId || !config.secretAccessKey) {
    return createOffsiteMetadata("failed", config, {
      reason: "Backup storage credentials are missing.",
    });
  }

  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const objectKey = `backups/${dateStamp}/${input.backupId}/${input.fileName}`;
  const payload = Buffer.isBuffer(input.archiveBody)
    ? input.archiveBody
    : Buffer.from(input.archiveBody, "utf-8");
  const requestBody = new Uint8Array(payload);
  const payloadHash = sha256Hex(payload);
  const signedRequest = buildSignedStorageRequest({
    config,
    method: "PUT",
    objectKey,
    payloadHash,
  });

  try {
    const response = await fetch(signedRequest.requestUrl, {
      method: "PUT",
      headers: {
        Authorization: signedRequest.authorization,
        "Content-Type": "application/json",
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": signedRequest.amzDate,
      },
      body: requestBody,
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => ""))
        .slice(0, 300)
        .trim();
      return createOffsiteMetadata("failed", config, {
        objectKey,
        location: `s3://${config.bucket}/${objectKey}`,
        reason: detail
          ? `Upload failed (${response.status}): ${detail}`
          : `Upload failed with status ${response.status}.`,
      });
    }

    return createOffsiteMetadata("stored", config, {
      objectKey,
      location: `s3://${config.bucket}/${objectKey}`,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return createOffsiteMetadata("failed", config, {
      objectKey,
      location: `s3://${config.bucket}/${objectKey}`,
      reason: error?.message || "Backup upload failed.",
    });
  }
}

export async function downloadBackupArchive(
  offsite: BackupOffsiteMetadata,
): Promise<{ content: string; contentType: string | null }> {
  const config = await resolveBackupStorageConfig();
  const provider = normalizeProvider(config.provider);

  if (offsite.status !== "stored" || !offsite.objectKey) {
    throw new Error("BACKUP_NOT_AVAILABLE_OFFSITE");
  }

  if (
    !provider ||
    !config.bucket ||
    !config.region ||
    !config.accessKeyId ||
    !config.secretAccessKey
  ) {
    throw new Error("BACKUP_STORAGE_NOT_READY");
  }

  const payloadHash = sha256Hex("");
  const signedRequest = buildSignedStorageRequest({
    config,
    method: "GET",
    objectKey: offsite.objectKey,
    payloadHash,
  });

  const response = await fetch(signedRequest.requestUrl, {
    method: "GET",
    headers: {
      Authorization: signedRequest.authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": signedRequest.amzDate,
    },
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300).trim();
    throw new Error(
      detail
        ? `BACKUP_DOWNLOAD_FAILED:${detail}`
        : `BACKUP_DOWNLOAD_FAILED:${response.status}`,
    );
  }

  return {
    content: await response.text(),
    contentType: response.headers.get("content-type"),
  };
}
