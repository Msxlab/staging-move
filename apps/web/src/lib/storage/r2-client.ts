/**
 * R2 (S3-compatible) upload client. Uses AWS SigV4 signed PUTs via fetch;
 * no @aws-sdk dependency — keeps the bundle small and matches the pattern
 * already used in apps/admin/src/lib/backup-storage.ts.
 *
 * Safety:
 *   - Credentials are read from env only (server-only, never exposed to
 *     the browser).
 *   - Content-Type is required on upload — prevents browser sniffing.
 *   - Object keys are scoped by `kind/userId/uuid` so a user's objects can
 *     never collide with another user's namespace.
 */

import { createHash, createHmac, randomUUID } from "crypto";

export interface R2Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export type UploadKind = "avatar" | "document" | "provider-logo" | "backup";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function getR2Config(): R2Config {
  return {
    endpoint: requireEnv("R2_ENDPOINT"),
    region: process.env.R2_REGION || "auto",
    bucket: requireEnv("R2_BUCKET"),
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
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

function buildObjectUrl(cfg: R2Config, objectKey: string): URL {
  const encodedKey = objectKey.split("/").map(encodeRfc3986).join("/");
  const base = new URL(cfg.endpoint);
  const prefix = base.pathname.replace(/\/+$/, "");
  base.pathname = `${prefix}/${cfg.bucket}/${encodedKey}`.replace(/\/+/g, "/");
  return base;
}

function signRequest(input: {
  cfg: R2Config;
  method: "PUT" | "GET" | "DELETE";
  objectKey: string;
  payloadHash: string;
  contentType?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = `${dateStamp}T${now.toISOString().slice(11, 19).replace(/:/g, "")}Z`;
  const url = buildObjectUrl(input.cfg, input.objectKey);

  // Canonical headers must be sorted alphabetically.
  const headers: Array<[string, string]> = [
    ["host", url.host],
    ["x-amz-content-sha256", input.payloadHash],
    ["x-amz-date", amzDate],
  ];
  if (input.contentType) headers.push(["content-type", input.contentType]);
  headers.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalHeaders = headers.map(([k, v]) => `${k}:${v}\n`).join("");
  const signedHeaders = headers.map(([k]) => k).join(";");

  const canonicalRequest = [
    input.method,
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

/**
 * Build a namespaced, collision-free object key. Format:
 *   <kind>/<userId>/<uuid>.<ext>
 * Caller chooses the extension; we sanitize it to [a-z0-9]{1,6}.
 */
export function buildObjectKey(
  kind: UploadKind,
  userId: string,
  fileExt: string,
): string {
  const cleanExt = fileExt.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 6);
  const id = randomUUID();
  return `${kind}/${userId}/${id}${cleanExt ? `.${cleanExt}` : ""}`;
}

/**
 * Server-side upload. Pass a Buffer (e.g. from `await req.arrayBuffer()`).
 * Returns the object key, which is what you should persist in the DB —
 * not the full URL. URLs are generated on read via `imgproxyUrl()` or
 * `rawObjectUrl()`.
 */
export async function putObject(input: {
  objectKey: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const cfg = getR2Config();
  const payloadHash = sha256Hex(input.body);
  const signed = signRequest({
    cfg,
    method: "PUT",
    objectKey: input.objectKey,
    payloadHash,
    contentType: input.contentType,
  });

  const res = await fetch(signed.url, {
    method: "PUT",
    headers: {
      Authorization: signed.authorization,
      "Content-Type": input.contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": signed.amzDate,
    },
    body: new Uint8Array(input.body),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`R2 PUT failed: ${res.status} ${detail}`);
  }
}

/**
 * Server-side delete. Used by account deletion + document removal.
 * Returns true when the object is gone (or was never there).
 */
export async function deleteObject(objectKey: string): Promise<boolean> {
  const cfg = getR2Config();
  const signed = signRequest({
    cfg,
    method: "DELETE",
    objectKey,
    // DELETE has an empty body, so payload hash is the hash of an empty string.
    payloadHash: sha256Hex(""),
  });
  const res = await fetch(signed.url, {
    method: "DELETE",
    headers: {
      Authorization: signed.authorization,
      "x-amz-content-sha256": sha256Hex(""),
      "x-amz-date": signed.amzDate,
    },
  });
  // R2 returns 204 on success, 404 if missing — both are "gone".
  return res.ok || res.status === 404;
}

/**
 * For a handful of public, low-cardinality assets (provider logos), you may
 * choose to expose the raw R2 public URL instead of routing through imgproxy.
 * Returns null when no public base is configured — caller should fall back
 * to imgproxy.
 */
export function rawObjectUrl(objectKey: string): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!base) return null;
  const clean = base.replace(/\/+$/, "");
  const encoded = objectKey.split("/").map(encodeRfc3986).join("/");
  return `${clean}/${encoded}`;
}
