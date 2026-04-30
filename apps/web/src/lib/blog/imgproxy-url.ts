import "server-only";
import { createHmac } from "node:crypto";

/**
 * Build a signed imgproxy URL for an R2 object key.
 *
 * imgproxy is configured in `docker-compose.prod.yml` with
 * `IMGPROXY_USE_S3=true` and the R2 endpoint, so it pulls the source
 * image directly from the bucket. We sign the processing path with
 * `IMGPROXY_KEY` + `IMGPROXY_SALT` so attackers can't ask the proxy
 * for arbitrary transforms (which is how imgproxy DoS happens in the
 * wild — unbounded resize on a 100MP source).
 *
 * Reference: https://docs.imgproxy.net/signing_the_url
 */

interface ImgproxyParams {
  /** R2 object key, e.g. `blog/2026/04/cover.webp` (no leading slash) */
  key: string;
  width: number;
  height: number;
  /** "fit" preserves aspect, "fill" crops; "fill" matches OG cards. */
  resizingType?: "fit" | "fill";
  format?: "webp" | "png" | "jpg" | "avif";
  /** "sm" gravity centers on smart-detected focal point. */
  gravity?: "ce" | "sm";
}

function getImgproxySecrets(): { key: Buffer; salt: Buffer; baseUrl: string } {
  const keyHex = process.env.IMGPROXY_KEY;
  const saltHex = process.env.IMGPROXY_SALT;
  const baseUrl = process.env.NEXT_PUBLIC_IMGPROXY_URL;
  if (!keyHex || !saltHex || !baseUrl) {
    throw new Error(
      "IMGPROXY_KEY, IMGPROXY_SALT, and NEXT_PUBLIC_IMGPROXY_URL must all be set",
    );
  }
  return {
    key: Buffer.from(keyHex, "hex"),
    salt: Buffer.from(saltHex, "hex"),
    baseUrl: baseUrl.replace(/\/+$/, ""),
  };
}

function urlSafeBase64(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function buildImgproxyUrl(params: ImgproxyParams): string {
  const {
    key,
    width,
    height,
    resizingType = "fill",
    format = "webp",
    gravity = "sm",
  } = params;

  const { key: hmacKey, salt, baseUrl } = getImgproxySecrets();

  // Source URL pattern matches IMGPROXY_USE_S3 mode: `s3://<bucket>/<key>`.
  // We accept the bucket via env and fall back to the configured R2_BUCKET.
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET must be set");
  const source = `s3://${bucket}/${key.replace(/^\/+/, "")}`;
  const encodedSource = urlSafeBase64(Buffer.from(source));

  const path = `/rs:${resizingType}:${width}:${height}:0/g:${gravity}/${encodedSource}.${format}`;

  const signature = urlSafeBase64(
    createHmac("sha256", hmacKey).update(salt).update(path).digest(),
  );

  return `${baseUrl}/${signature}${path}`;
}

/**
 * Standard preset for blog OG images (1200×630 — the size every social
 * platform expects). Centralized so we render the same URL in every
 * surface (web, mobile, RSS) for cache reuse.
 */
export function buildBlogOgImageUrl(key: string): string {
  return buildImgproxyUrl({
    key,
    width: 1200,
    height: 630,
    resizingType: "fill",
    format: "webp",
    gravity: "sm",
  });
}

/**
 * Inline post image preset (max 1200 wide, height auto via "fit").
 */
export function buildBlogContentImageUrl(key: string, width = 1200): string {
  return buildImgproxyUrl({
    key,
    width,
    height: 0,
    resizingType: "fit",
    format: "webp",
  });
}
