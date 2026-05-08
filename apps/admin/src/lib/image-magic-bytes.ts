/**
 * Magic-byte sniffer for image uploads.
 *
 * Browser-supplied MIME types are advisory — a malicious uploader can
 * send `Content-Type: image/png` with arbitrary bytes (HTML, SVG with
 * scripts, executable). Sniff the first 16 bytes of the buffer to
 * determine the actual format and require it to match the declared
 * content-type before accepting the upload.
 *
 * Supported formats: PNG, JPEG, WEBP, GIF, ICO. SVG is intentionally
 * not supported — SVG can contain scripts and is rejected outright.
 */

export type SniffedImageFormat = "png" | "jpeg" | "webp" | "gif" | "ico";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function startsWith(buf: Buffer, sig: Buffer): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

/**
 * Inspect buffer header bytes and return the detected image format,
 * or null if the bytes are not a recognized image. The check is
 * intentionally strict — only formats listed in `SniffedImageFormat`
 * are accepted.
 */
export function sniffImageFormat(buf: Buffer): SniffedImageFormat | null {
  if (!buf || buf.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, PNG_SIGNATURE)) return "png";

  // JPEG: FF D8 FF (followed by E0/E1/EE/DB/...)
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";

  // WEBP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "webp";
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return "gif";
  }

  // ICO: 00 00 01 00 (icon resource type 1)
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) {
    return "ico";
  }

  return null;
}

/**
 * Return the Content-Type the sniffed format should use. Mapping is
 * 1:1 with `LogoContentType` in r2-asset-storage.ts so the result can
 * be passed straight into `normalizeLogoContentType` without surprise.
 */
export function contentTypeForSniffed(format: SniffedImageFormat): string {
  switch (format) {
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "ico":
      return "image/x-icon";
  }
}

/**
 * Reject obvious non-image / dangerous payloads early — SVG, HTML,
 * scripts. Returns the rejection reason (string) or null when the
 * buffer is safe to feed to the magic-byte sniffer.
 */
export function detectDangerousPayload(buf: Buffer): string | null {
  if (!buf || buf.length === 0) return "empty_payload";

  // Reject anything that starts with whitespace then `<` — SVG, HTML,
  // XML, etc. The PNG/JPEG/WEBP/GIF/ICO signatures all start with
  // non-`<` bytes, so this gate is safe to apply before sniffing.
  let i = 0;
  while (i < Math.min(buf.length, 16) && (buf[i] === 0x20 || buf[i] === 0x09 || buf[i] === 0x0a || buf[i] === 0x0d)) {
    i++;
  }
  if (buf[i] === 0x3c) {
    // `<` — angle bracket. Reject as XML/HTML/SVG.
    return "xml_or_html_payload";
  }

  // Reject UTF-8 BOM followed by `<` (common with hand-crafted SVG).
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf && buf[3] === 0x3c) {
    return "xml_or_html_payload";
  }

  return null;
}
