/**
 * R2 upload helper for blog content (cover images + inline post images).
 *
 * Mirrors the SigV4 implementation in
 * apps/web/src/lib/storage/r2-client.ts but lives in the admin app
 * because the upload endpoint is admin-only. Code duplication is
 * intentional and minimal — extracting an `aws-sigv4` package would
 * pay for itself only once a third app needs R2.
 *
 * Hard limits enforced here:
 *   - mime whitelist: jpeg / png / webp / avif (NO svg — script surface)
 *   - max bytes: 5 MiB (oversized images are a DoS lever on imgproxy)
 * The caller already does RBAC + rate-limit; this module is pure I/O.
 */

import { createHash, createHmac, randomUUID } from "crypto";

export const ALLOWED_BLOG_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export const MAX_BLOG_IMAGE_BYTES = 5 * 1024 * 1024;

interface R2Cfg {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function getR2Cfg(): R2Cfg {
  return {
    endpoint: requireEnv("R2_ENDPOINT"),
    region: process.env.R2_REGION || "auto",
    bucket: requireEnv("R2_BUCKET"),
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  };
}

function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function getSigningKey(secret: string, dateStamp: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function objectUrl(cfg: R2Cfg, key: string): URL {
  const encodedKey = key.split("/").map(rfc3986).join("/");
  const u = new URL(cfg.endpoint);
  const prefix = u.pathname.replace(/\/+$/, "");
  u.pathname = `${prefix}/${cfg.bucket}/${encodedKey}`.replace(/\/+/g, "/");
  return u;
}

interface SignedRequest {
  url: URL;
  headers: Record<string, string>;
}

function sign(input: {
  cfg: R2Cfg;
  method: "PUT" | "DELETE";
  key: string;
  payloadHash: string;
  contentType?: string;
}): SignedRequest {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = `${dateStamp}T${now.toISOString().slice(11, 19).replace(/:/g, "")}Z`;
  const url = objectUrl(input.cfg, input.key);

  const headerPairs: Array<[string, string]> = [
    ["host", url.host],
    ["x-amz-content-sha256", input.payloadHash],
    ["x-amz-date", amzDate],
  ];
  if (input.contentType) headerPairs.push(["content-type", input.contentType]);
  headerPairs.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalHeaders = headerPairs.map(([k, v]) => `${k}:${v}\n`).join("");
  const signedHeaders = headerPairs.map(([k]) => k).join(";");

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

  const signingKey = getSigningKey(input.cfg.secretAccessKey, dateStamp, input.cfg.region);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${input.cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    Authorization: authorization,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": amzDate,
  };
  if (input.contentType) headers["Content-Type"] = input.contentType;
  return { url, headers };
}

export interface BlogUploadResult {
  /** Object key (the value stored in `BlogPost.ogImageKey` etc.) */
  key: string;
  bytes: number;
  contentType: string;
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

function hasExpectedMagicBytes(body: Buffer, mime: string): boolean {
  if (mime === "image/jpeg") {
    return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  }
  if (mime === "image/png") {
    return body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mime === "image/webp") {
    return body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (mime === "image/avif") {
    const box = body.subarray(4, 12).toString("ascii");
    const brands = body.subarray(8, 32).toString("ascii");
    return box.startsWith("ftyp") && /avif|avis/.test(brands);
  }
  return false;
}

/**
 * Upload a blog image to R2. Returns the object key — never the URL,
 * since render time goes through imgproxy with a fresh signed URL.
 */
export async function uploadBlogImage(input: {
  body: Buffer;
  contentType: string;
  /** AdminUser.id of the uploader, used for the key prefix + audit. */
  adminId: string;
}): Promise<BlogUploadResult> {
  const mime = input.contentType.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_BLOG_IMAGE_MIME.has(mime)) {
    throw new Error(`UNSUPPORTED_MIME:${mime}`);
  }
  if (input.body.byteLength > MAX_BLOG_IMAGE_BYTES) {
    throw new Error(`TOO_LARGE:${input.body.byteLength}`);
  }
  if (!hasExpectedMagicBytes(input.body, mime)) {
    throw new Error(`UNSUPPORTED_BYTES:${mime}`);
  }

  const ext = MIME_TO_EXT[mime];
  const yyyymm = new Date().toISOString().slice(0, 7); // 2026-04
  const key = `blog/${yyyymm}/${input.adminId}/${randomUUID()}.${ext}`;

  const cfg = getR2Cfg();
  const signed = sign({
    cfg,
    method: "PUT",
    key,
    payloadHash: sha256Hex(input.body),
    contentType: mime,
  });

  const res = await fetch(signed.url, {
    method: "PUT",
    headers: signed.headers,
    body: new Uint8Array(input.body),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`R2_PUT_FAILED:${res.status}:${detail}`);
  }

  return { key, bytes: input.body.byteLength, contentType: mime };
}

/** Best-effort delete (used when admin replaces or deletes a cover). */
export async function deleteBlogImage(key: string): Promise<boolean> {
  const cfg = getR2Cfg();
  const signed = sign({
    cfg,
    method: "DELETE",
    key,
    payloadHash: sha256Hex(""),
  });
  const res = await fetch(signed.url, { method: "DELETE", headers: signed.headers });
  return res.ok || res.status === 404;
}
