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

async function resolveAssetConfig(): Promise<R2AssetConfig> {
  const values = await getAdminRuntimeConfigValues([...R2_ASSET_KEYS]);
  const endpoint = values.R2_ENDPOINT?.trim();
  const bucket = values.R2_BUCKET?.trim();
  const accessKeyId = values.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = values.R2_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_ASSET_STORAGE_NOT_CONFIGURED");
  }
  return {
    endpoint,
    region: values.R2_REGION?.trim() || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: values.R2_PUBLIC_BASE_URL?.trim() || null,
  };
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
