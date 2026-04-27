/**
 * R2 upload client for public assets (provider logos for now). Uses the
 * R2_* runtime config keys — same env vars as the web app's
 * `apps/web/src/lib/storage/r2-client.ts`. Kept separate from the backup
 * storage client (`backup-storage.ts`) because backup uses a different
 * bucket / set of credentials (BACKUP_STORAGE_*).
 *
 * Two helpers exposed:
 *   - putAssetObject({ objectKey, body, contentType }) — server-side PUT
 *   - rawAssetUrl(objectKey) — turns a key into a public CDN URL (or null
 *     if R2_PUBLIC_BASE_URL is not set, in which case the caller has no
 *     way to surface the asset and should treat it as unconfigured)
 */
import { createHash, createHmac, randomUUID } from "crypto";
import { getAdminRuntimeConfigValues } from "@/lib/runtime-config";

interface R2AssetConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string | null;
}

const R2_ASSET_KEYS = [
  "R2_ENDPOINT",
  "R2_REGION",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_BASE_URL",
] as const;

const R2_PUT_TIMEOUT_MS = 3_000;
const TINY_TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

export interface R2AssetConfigShapeInput {
  endpoint?: string | null;
  region?: string | null;
  bucket?: string | null;
  accessKeyId?: string | null;
  secretAccessKey?: string | null;
  publicBaseUrl?: string | null;
}

export interface R2AssetConfigSummary {
  endpointHost: string | null;
  endpointPath: string | null;
  publicBaseUrlHost: string | null;
  bucket: string | null;
  region: string | null;
  hasAccessKeyId: boolean;
  hasSecretAccessKey: boolean;
}

export interface R2AssetConfigValidation {
  ok: boolean;
  errors: string[];
  config?: R2AssetConfig;
  summary: R2AssetConfigSummary;
}

export interface R2AssetStorageHealth {
  ready: boolean;
  errors: string[];
  summary: R2AssetConfigSummary;
  testUpload?: {
    attempted: boolean;
    ok: boolean;
    objectKey?: string;
    errorName?: string;
    errorMessage?: string;
  };
}

export const ALLOWED_LOGO_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

export type LogoContentType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "image/x-icon";

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export function normalizeLogoContentType(raw: string): LogoContentType {
  const mediaType = raw.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_LOGO_CONTENT_TYPES.has(mediaType)) {
    throw new Error(`UNSUPPORTED_LOGO_CONTENT_TYPE:${raw}`);
  }
  // Microsoft's variant collapses to ico for extension purposes.
  if (mediaType === "image/vnd.microsoft.icon") return "image/x-icon";
  return mediaType as LogoContentType;
}

export function logoExtensionFor(contentType: string): string {
  return CONTENT_TYPE_TO_EXT[contentType.toLowerCase()] || "bin";
}

/**
 * `provider-logo/<providerId>/<uuid>.<ext>` — colocated with the
 * upload-kind convention the web app uses, so a future migration to a
 * shared util doesn't shuffle keys around.
 */
export function buildLogoObjectKey(providerId: string, contentType: string): string {
  const ext = logoExtensionFor(contentType);
  const uuid = randomUUID();
  const safeProviderId = providerId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `provider-logo/${safeProviderId}/${uuid}.${ext}`;
}

function normalizeValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function parseUrl(value: string | null): URL | null {
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function urlHost(value: string | null): string | null {
  return parseUrl(value)?.host ?? null;
}

function summarizeConfig(input: R2AssetConfigShapeInput): R2AssetConfigSummary {
  const endpointUrl = parseUrl(normalizeValue(input.endpoint));
  return {
    endpointHost: endpointUrl?.host ?? null,
    endpointPath: endpointUrl?.pathname && endpointUrl.pathname !== "/" ? endpointUrl.pathname : null,
    publicBaseUrlHost: urlHost(normalizeValue(input.publicBaseUrl)),
    bucket: normalizeValue(input.bucket),
    region: normalizeValue(input.region) || "auto",
    hasAccessKeyId: Boolean(normalizeValue(input.accessKeyId)),
    hasSecretAccessKey: Boolean(normalizeValue(input.secretAccessKey)),
  };
}

export function validateR2AssetStorageConfigShape(
  input: R2AssetConfigShapeInput,
): R2AssetConfigValidation {
  const endpointValue = normalizeValue(input.endpoint);
  const bucket = normalizeValue(input.bucket);
  const accessKeyId = normalizeValue(input.accessKeyId);
  const secretAccessKey = normalizeValue(input.secretAccessKey);
  const publicBaseUrl = normalizeValue(input.publicBaseUrl);
  const region = normalizeValue(input.region) || "auto";
  const errors: string[] = [];

  if (!endpointValue) errors.push("missing R2_ENDPOINT");
  if (!bucket) errors.push("missing R2_BUCKET");
  if (!accessKeyId) errors.push("missing R2_ACCESS_KEY_ID");
  if (!secretAccessKey) errors.push("missing R2_SECRET_ACCESS_KEY");

  const endpointUrl = parseUrl(endpointValue);
  if (endpointValue && !endpointUrl) {
    errors.push("R2_ENDPOINT must be a valid URL or hostname");
  }
  if (endpointUrl && !["https:", "http:"].includes(endpointUrl.protocol)) {
    errors.push("R2_ENDPOINT must use http or https");
  }

  const publicBaseUrlUrl = parseUrl(publicBaseUrl);
  if (publicBaseUrl && !publicBaseUrlUrl) {
    errors.push("R2_PUBLIC_BASE_URL must be a valid URL or hostname");
  }

  if (bucket && /[\\/]/.test(bucket)) {
    errors.push("R2_BUCKET must be a bucket name, not a path");
  }

  if (endpointUrl && bucket) {
    const normalizedBucket = bucket.toLowerCase();
    const endpointPathParts = endpointUrl.pathname
      .split("/")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    if (endpointPathParts.includes(normalizedBucket)) {
      errors.push("R2_ENDPOINT must not include the bucket path");
    }
    if (endpointUrl.hostname.toLowerCase().startsWith(`${normalizedBucket}.`)) {
      errors.push("R2_ENDPOINT must not include the bucket as a host prefix");
    }
  }

  if (
    endpointUrl &&
    publicBaseUrlUrl &&
    endpointUrl.host.toLowerCase() === publicBaseUrlUrl.host.toLowerCase()
  ) {
    errors.push("R2_ENDPOINT must be the S3 API endpoint, not the public asset domain");
  }

  const summary = summarizeConfig(input);
  if (errors.length > 0 || !endpointUrl || !bucket || !accessKeyId || !secretAccessKey) {
    return { ok: false, errors, summary };
  }

  endpointUrl.search = "";
  endpointUrl.hash = "";
  endpointUrl.pathname = endpointUrl.pathname.replace(/\/+$/, "");

  return {
    ok: true,
    errors: [],
    summary,
    config: {
      endpoint: endpointUrl.toString().replace(/\/+$/, ""),
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl,
    },
  };
}

async function resolveAssetConfig(): Promise<R2AssetConfig> {
  const values = await getAdminRuntimeConfigValues([...R2_ASSET_KEYS]);
  const validation = validateR2AssetStorageConfigShape({
    endpoint: values.R2_ENDPOINT,
    region: values.R2_REGION,
    bucket: values.R2_BUCKET,
    accessKeyId: values.R2_ACCESS_KEY_ID,
    secretAccessKey: values.R2_SECRET_ACCESS_KEY,
    publicBaseUrl: values.R2_PUBLIC_BASE_URL,
  });
  if (!validation.ok || !validation.config) {
    throw new Error(
      `R2_ASSET_STORAGE_NOT_CONFIGURED:${validation.errors.join("; ")}`,
    );
  }
  return validation.config;
}

function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function getSignatureKey(secret: string, dateStamp: string, region: string) {
  const kDate = hmacSha256(`AWS4${secret}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "s3");
  return hmacSha256(kService, "aws4_request");
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function buildObjectUrl(cfg: R2AssetConfig, objectKey: string): URL {
  const encodedKey = objectKey.split("/").map(encodeRfc3986).join("/");
  const base = new URL(cfg.endpoint);
  const prefix = base.pathname.replace(/\/+$/, "");
  base.pathname = `${prefix}/${cfg.bucket}/${encodedKey}`.replace(/\/+/g, "/");
  return base;
}

function signPutRequest(input: {
  cfg: R2AssetConfig;
  objectKey: string;
  payloadHash: string;
  contentType: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = `${dateStamp}T${now.toISOString().slice(11, 19).replace(/:/g, "")}Z`;
  const url = buildObjectUrl(input.cfg, input.objectKey);

  const headers: Array<[string, string]> = [
    ["content-type", input.contentType],
    ["host", url.host],
    ["x-amz-content-sha256", input.payloadHash],
    ["x-amz-date", amzDate],
  ];
  headers.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalHeaders = headers.map(([k, v]) => `${k}:${v}\n`).join("");
  const signedHeaders = headers.map(([k]) => k).join(";");
  const canonicalRequest = [
    "PUT",
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${input.cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = getSignatureKey(input.cfg.secretAccessKey, dateStamp, input.cfg.region);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${input.cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { url, authorization, amzDate };
}

export async function putAssetObject(input: {
  objectKey: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const cfg = await resolveAssetConfig();
  const contentType = normalizeLogoContentType(input.contentType);
  const payloadHash = sha256Hex(input.body);
  const signed = signPutRequest({
    cfg,
    objectKey: input.objectKey,
    payloadHash,
    contentType,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), R2_PUT_TIMEOUT_MS);
  try {
    const res = await fetch(signed.url, {
      method: "PUT",
      signal: controller.signal,
      headers: {
        Authorization: signed.authorization,
        "Content-Type": contentType,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": signed.amzDate,
      },
      body: new Uint8Array(input.body),
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`R2_PUT_FAILED:${res.status}:${detail}`);
    }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("R2_PUT_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function rawAssetUrl(objectKey: string): Promise<string | null> {
  const cfg = await resolveAssetConfig();
  if (!cfg.publicBaseUrl) return null;
  const clean = cfg.publicBaseUrl.replace(/\/+$/, "");
  const encoded = objectKey.split("/").map(encodeRfc3986).join("/");
  return `${clean}/${encoded}`;
}

export async function isAssetStorageConfigured(): Promise<boolean> {
  try {
    const cfg = await resolveAssetConfig();
    return Boolean(cfg.publicBaseUrl);
  } catch {
    return false;
  }
}

export async function getR2AssetStorageHealth(options: {
  attemptUpload?: boolean;
} = {}): Promise<R2AssetStorageHealth> {
  const values = await getAdminRuntimeConfigValues([...R2_ASSET_KEYS]);
  const validation = validateR2AssetStorageConfigShape({
    endpoint: values.R2_ENDPOINT,
    region: values.R2_REGION,
    bucket: values.R2_BUCKET,
    accessKeyId: values.R2_ACCESS_KEY_ID,
    secretAccessKey: values.R2_SECRET_ACCESS_KEY,
    publicBaseUrl: values.R2_PUBLIC_BASE_URL,
  });
  const health: R2AssetStorageHealth = {
    ready: validation.ok,
    errors: validation.errors,
    summary: validation.summary,
  };

  if (!options.attemptUpload) return health;

  const objectKey = `health/provider-logo/${randomUUID()}.png`;
  try {
    await putAssetObject({
      objectKey,
      body: TINY_TEST_PNG,
      contentType: "image/png",
    });
    health.testUpload = { attempted: true, ok: true, objectKey };
  } catch (error) {
    health.ready = false;
    health.testUpload = {
      attempted: true,
      ok: false,
      objectKey,
      errorName: errorName(error),
      errorMessage: errorMessage(error).slice(0, 500),
    };
  }

  return health;
}
