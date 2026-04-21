/**
 * imgproxy signed URL builder.
 *
 * imgproxy is configured with IMGPROXY_KEY + IMGPROXY_SALT (hex). Every URL
 * we hand to the browser is HMAC-SHA256 signed with those so anyone who
 * tries to request an unsigned / tampered URL is rejected at the proxy
 * layer (returns 403). That protects us from a DoS where someone pounds
 * the service with bogus transform parameters on our dime.
 *
 * URL shape (imgproxy v3 enc-path mode):
 *   {NEXT_PUBLIC_IMGPROXY_URL}/{signature}/{processing_options}/plain/{source}
 *
 * We use the `plain` source syntax (no URL-base64) for legibility; the
 * source is always an `s3://bucket/key` pointing at our R2 bucket, which
 * the imgproxy container fetches using its own R2 credentials.
 */

import { createHmac } from "crypto";

export interface ImgproxyTransform {
  /** Resize width in CSS pixels. Pass null to keep aspect from height. */
  width?: number | null;
  /** Resize height in CSS pixels. Pass null to keep aspect from width. */
  height?: number | null;
  /** "fit" keeps aspect inside box; "fill" crops. Default "fit". */
  resizeType?: "fit" | "fill" | "auto";
  /** Output format. `auto` lets imgproxy pick WEBP/AVIF when supported. */
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  /** Quality 1-100. Default 82 is a good web sweet spot. */
  quality?: number;
  /** DPR multiplier for retina screens. */
  dpr?: 1 | 2 | 3;
}

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

function urlSafeBase64(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function sign(path: string): string {
  const key = process.env.IMGPROXY_KEY;
  const salt = process.env.IMGPROXY_SALT;
  if (!key || !salt) {
    throw new Error("IMGPROXY_KEY and IMGPROXY_SALT must be set");
  }
  const hmac = createHmac("sha256", hexToBuffer(key));
  hmac.update(hexToBuffer(salt));
  hmac.update(path);
  return urlSafeBase64(hmac.digest());
}

function buildProcessingOptions(t: ImgproxyTransform): string {
  const parts: string[] = [];

  // Resize: `rs:<type>:<w>:<h>:0`  (0 = don't enlarge beyond source)
  if (t.width != null || t.height != null) {
    const type = t.resizeType ?? "fit";
    const w = t.width ?? 0;
    const h = t.height ?? 0;
    parts.push(`rs:${type}:${w}:${h}:0`);
  }

  if (t.dpr && t.dpr !== 1) parts.push(`dpr:${t.dpr}`);
  if (typeof t.quality === "number") {
    parts.push(`q:${Math.max(1, Math.min(100, Math.round(t.quality)))}`);
  }
  // Always strip metadata (EXIF GPS coords) — imgproxy respects its
  // IMGPROXY_STRIP_METADATA env too but belt-and-suspenders.
  parts.push("sm:1");

  return parts.length > 0 ? parts.join("/") : "";
}

/**
 * Build a signed imgproxy URL for an object stored in R2.
 *
 * @param objectKey  The R2 object key (e.g. "avatar/user_123/abc.jpg").
 * @param transform  Resize / format / quality knobs.
 * @returns Absolute URL ready to put in `<img src>` or `next/image`.
 */
export function imgproxyUrl(
  objectKey: string,
  transform: ImgproxyTransform = {},
): string {
  const base = (process.env.NEXT_PUBLIC_IMGPROXY_URL || "").replace(/\/+$/, "");
  const bucket = process.env.R2_BUCKET;
  if (!base) throw new Error("NEXT_PUBLIC_IMGPROXY_URL must be set");
  if (!bucket) throw new Error("R2_BUCKET must be set");

  const options = buildProcessingOptions(transform);
  const format = transform.format && transform.format !== "auto" ? `@${transform.format}` : "";
  const source = `s3://${bucket}/${objectKey}`;

  // Path to sign: everything AFTER the signature placeholder.
  const pathToSign = options
    ? `/${options}/plain/${source}${format}`
    : `/plain/${source}${format}`;

  const signature = sign(pathToSign);
  return `${base}/${signature}${pathToSign}`;
}

/**
 * Preset helpers — encode the common sizes used across the product so we
 * don't sprinkle magic numbers around.
 */
export const imgpreset = {
  avatar: (key: string) =>
    imgproxyUrl(key, { width: 96, height: 96, resizeType: "fill", quality: 82, format: "auto" }),
  avatarLarge: (key: string) =>
    imgproxyUrl(key, { width: 256, height: 256, resizeType: "fill", quality: 85, format: "auto" }),
  providerLogo: (key: string) =>
    imgproxyUrl(key, { width: 128, height: 128, resizeType: "fit", quality: 88, format: "auto" }),
  documentThumb: (key: string) =>
    imgproxyUrl(key, { width: 320, height: 400, resizeType: "fit", quality: 80, format: "auto" }),
  documentFull: (key: string) =>
    imgproxyUrl(key, { width: 1600, quality: 88, format: "auto" }),
};
