/**
 * Provider logo ingestion. Coordinates:
 *   1. Build candidate URLs (logo-fetcher).
 *   2. Try each candidate — fetch bytes, sniff/normalize content-type,
 *      reject obviously-bad responses (HTML 200s, oversized payloads,
 *      transparent-pixel "always returns success" placeholders).
 *   3. PUT bytes to R2 under `provider-logo/<providerId>/<uuid>.<ext>`.
 *   4. Return the final public CDN URL and provenance. Callers should store
 *      this as a reviewable ProviderLogoCandidate before publishing it to
 *      `ServiceProvider.logoUrl`.
 *
 * All network I/O lives here; logo-fetcher.ts stays pure.
 */
import { createHash } from "crypto";
import { buildLogoCandidates, type LogoCandidate, type LogoSource } from "@/lib/logo-fetcher";
import {
  buildLogoObjectKey,
  normalizeLogoContentType,
  putAssetObject,
  rawAssetUrl,
} from "@/lib/r2-asset-storage";
import {
  contentTypeForSniffed,
  detectDangerousPayload,
  sniffImageFormat,
} from "@/lib/image-magic-bytes";
import { assertSafeOutboundUrl, SsrfBlockedError } from "@/lib/ssrf-guard";

// Only these third-party hosts are allowed for logo fetches. Provider-
// supplied URLs (or any future redirect targets) are rejected if they
// don't resolve to one of these hostnames. The DNS lookup inside
// `assertSafeOutboundUrl` also rejects private/loopback/link-local IPs
// even for these hosts — defense in depth in case DNS is misconfigured
// or attacker-controlled.
const ALLOWED_LOGO_HOSTNAMES = [
  "logo.clearbit.com",
  "icons.duckduckgo.com",
  "www.google.com",
];

const MAX_LOGO_BYTES = 1_000_000; // 1 MB hard cap — real logos are well under
const MIN_LOGO_BYTES = 256;       // anything smaller is a 1x1 placeholder
const FETCH_TIMEOUT_MS = 1_500;
const R2_PUT_TIMEOUT_DETAILS = "3000ms";

export type LogoIngestFailureStage =
  | "validate_request"
  | "parse_multipart"
  | "fetch_homepage"
  | "parse_logo"
  | "download_asset"
  | "upload_storage"
  | "create_candidate"
  | "audit_log";

export class LogoIngestError extends Error {
  code: string;
  stage: LogoIngestFailureStage;
  status: number;
  details?: string;

  constructor(input: {
    code: string;
    message: string;
    stage: LogoIngestFailureStage;
    status?: number;
    details?: string;
  }) {
    super(input.message);
    this.name = "LogoIngestError";
    this.code = input.code;
    this.stage = input.stage;
    this.status = input.status ?? 500;
    this.details = input.details;
  }
}

export interface IngestedLogo {
  publicUrl: string;
  objectKey: string;
  source: LogoSource;
  sourceUrl: string | null;
  contentType: string;
  contentHash: string;
  bytes: number;
}

export interface IngestFailure {
  attempted: Array<{
    source: LogoCandidate["source"];
    reason: string;
    status?: number;
    message?: string;
  }>;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function mapStorageError(error: unknown): LogoIngestError | null {
  const message = errorMessage(error);
  if (
    message === "R2_ASSET_STORAGE_NOT_CONFIGURED" ||
    message.startsWith("R2_ASSET_STORAGE_NOT_CONFIGURED:")
  ) {
    const detail = message.includes(":") ? message.split(":").slice(1).join(":") : "";
    return new LogoIngestError({
      code: "LOGO_STORAGE_NOT_CONFIGURED",
      message: "Logo storage is not configured",
      stage: "upload_storage",
      status: 503,
      details:
        detail ||
        "Missing R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY",
    });
  }
  if (message === "R2_PUBLIC_BASE_URL_MISSING") {
    return new LogoIngestError({
      code: "LOGO_STORAGE_NOT_CONFIGURED",
      message: "Logo storage public base URL is not configured",
      stage: "upload_storage",
      status: 503,
      details: "Missing R2_PUBLIC_BASE_URL",
    });
  }
  if (message === "R2_PUT_TIMEOUT") {
    return new LogoIngestError({
      code: "LOGO_UPLOAD_FAILED",
      message: "Logo storage upload timed out",
      stage: "upload_storage",
      status: 504,
      details: `R2 PUT exceeded ${R2_PUT_TIMEOUT_DETAILS}`,
    });
  }
  if (message.startsWith("R2_PUT_FAILED:")) {
    return new LogoIngestError({
      code: "LOGO_UPLOAD_FAILED",
      message: "Logo storage upload failed",
      stage: "upload_storage",
      status: 502,
      details: message.slice(0, 500),
    });
  }
  return null;
}

async function fetchLogoAsset(url: string): Promise<{
  status: number;
  contentType: string | null;
  rawContentType: string | null;
  bytes: Buffer | null;
}> {
  // SSRF guard. Even though `buildLogoCandidates` constructs URLs from
  // a fixed list of third-party hosts, this gate is a defense-in-depth
  // check: it rejects schemes other than http(s), private/loopback/
  // link-local IPs, cloud-metadata hostnames, and any host outside the
  // allowlist. Future code paths that pass admin-supplied URLs through
  // here will be safely blocked.
  try {
    await assertSafeOutboundUrl(url, { allowedHostnames: ALLOWED_LOGO_HOSTNAMES });
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      throw new LogoIngestError({
        code: "LOGO_URL_BLOCKED",
        message: "Logo source URL was blocked by the network safety policy.",
        stage: "download_asset",
        status: 400,
        details: error.reason,
      });
    }
    throw error;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // `redirect: "manual"` ensures fetch returns the 3xx response
    // unfollowed; we re-validate any Location through the SSRF guard
    // before manually issuing the next hop.
    let currentUrl = url;
    let res: Response | null = null;
    let redirects = 0;
    const maxRedirects = 3;
    while (redirects <= maxRedirects) {
      res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "LocateFlow-LogoFetcher/1.0",
          Accept: "image/*",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) break;
        const next = new URL(location, currentUrl).toString();
        // Re-validate the redirect target — same allowlist + private-IP
        // checks. A response that 301s to `http://169.254.169.254/...`
        // or a private host will be rejected here.
        try {
          await assertSafeOutboundUrl(next, { allowedHostnames: ALLOWED_LOGO_HOSTNAMES });
        } catch (error) {
          if (error instanceof SsrfBlockedError) {
            throw new LogoIngestError({
              code: "LOGO_URL_BLOCKED",
              message: "Logo source redirected to a blocked URL.",
              stage: "download_asset",
              status: 400,
              details: `${error.reason}:${next}`,
            });
          }
          throw error;
        }
        currentUrl = next;
        redirects += 1;
        continue;
      }
      break;
    }
    if (!res) {
      throw new Error("Empty response from logo fetcher");
    }
    if (!res.ok) {
      return {
        status: res.status,
        contentType: null,
        rawContentType: res.headers.get("content-type"),
        bytes: null,
      };
    }
    const rawContentType = res.headers.get("content-type");
    const contentType = normalizeContentType(rawContentType);
    if (!contentType) {
      return { status: res.status, contentType: null, rawContentType, bytes: null };
    }

    // Pre-check Content-Length so a server that advertises an oversized
    // payload is rejected without spending bandwidth at all.
    const declaredLength = Number(res.headers.get("content-length") || "0");
    if (declaredLength > MAX_LOGO_BYTES) {
      try {
        await res.body?.cancel();
      } catch {}
      throw new LogoIngestError({
        code: "LOGO_TOO_LARGE",
        message: "Logo response exceeds maximum size.",
        stage: "download_asset",
        status: 413,
        details: `content-length ${declaredLength} > ${MAX_LOGO_BYTES}`,
      });
    }

    // Streaming size enforcement: even if Content-Length is missing or
    // lies, count bytes off the body reader and abort once we cross the
    // cap so a 500 MB blob can't pin our memory.
    const reader = res.body?.getReader();
    if (!reader) {
      // Fallback for runtimes where body streaming is unavailable —
      // accept arrayBuffer but reject after the fact if too large. Real
      // production runtimes (Node 22, edge) all expose a reader.
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > MAX_LOGO_BYTES) {
        throw new LogoIngestError({
          code: "LOGO_TOO_LARGE",
          message: "Logo response exceeds maximum size.",
          stage: "download_asset",
          status: 413,
          details: `${buf.byteLength} > ${MAX_LOGO_BYTES}`,
        });
      }
      return { status: res.status, contentType, rawContentType, bytes: buf };
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > MAX_LOGO_BYTES) {
          try {
            await reader.cancel();
          } catch {}
          throw new LogoIngestError({
            code: "LOGO_TOO_LARGE",
            message: "Logo response exceeds maximum size.",
            stage: "download_asset",
            status: 413,
            details: `streamed ${total} > ${MAX_LOGO_BYTES}`,
          });
        }
        chunks.push(value);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }

    return {
      status: res.status,
      contentType,
      rawContentType,
      bytes: Buffer.concat(chunks.map((c) => Buffer.from(c))),
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new LogoIngestError({
        code: "LOGO_DOWNLOAD_TIMEOUT",
        message: "Logo asset download timed out",
        stage: "download_asset",
        status: 504,
        details: `${url} exceeded ${FETCH_TIMEOUT_MS}ms`,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeContentType(headerValue: string | null): string | null {
  if (!headerValue) return null;
  try {
    return normalizeLogoContentType(headerValue);
  } catch {
    return null;
  }
}

function sha256Hex(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Try each candidate URL until one returns a usable image. Returns the
 * fetched bytes + content type so the caller can decide whether to upload.
 */
async function tryCandidates(
  candidates: LogoCandidate[],
): Promise<
  | {
      candidate: LogoCandidate;
      contentType: string;
      bytes: Buffer;
    }
  | { error: IngestFailure }
> {
  const attempted: IngestFailure["attempted"] = [];
  for (const candidate of candidates) {
    try {
      const res = await fetchLogoAsset(candidate.url);
      if (res.status < 200 || res.status >= 300) {
        attempted.push({
          source: candidate.source,
          reason: `http_${res.status}`,
          status: res.status,
        });
        continue;
      }
      if (!res.contentType || !res.bytes) {
        attempted.push({
          source: candidate.source,
          reason: "unsupported_content_type",
          message: (res.rawContentType || "missing").slice(0, 120),
        });
        continue;
      }

      const buf = res.bytes;
      if (buf.byteLength > MAX_LOGO_BYTES) {
        attempted.push({ source: candidate.source, reason: "too_large" });
        continue;
      }
      if (buf.byteLength < MIN_LOGO_BYTES) {
        // Clearbit returns ~280-byte 1x1 PNGs for unknown domains. Anything
        // genuinely small enough to fall under that bound isn't a useful
        // logo at any rendered size we care about.
        attempted.push({ source: candidate.source, reason: "too_small" });
        continue;
      }

      return { candidate, contentType: res.contentType, bytes: buf };
    } catch (err: any) {
      let reason: string;
      if (err instanceof LogoIngestError) {
        if (err.code === "LOGO_DOWNLOAD_TIMEOUT") reason = "timeout";
        else if (err.code === "LOGO_TOO_LARGE") reason = "too_large";
        else if (err.code === "LOGO_URL_BLOCKED") reason = "blocked";
        else reason = "fetch_error";
      } else {
        reason = "fetch_error";
      }
      attempted.push({
        source: candidate.source,
        reason,
        message: errorMessage(err).slice(0, 160),
      });
    }
  }
  return { error: { attempted } };
}

/**
 * High-level: given a provider's website, find a logo and store it.
 * Returns null when no candidate produced a usable image — the caller
 * should surface this to the operator (try a different domain / manual
 * upload) rather than treat it as a system error.
 */
export async function ingestLogoFromWebsite(input: {
  providerId: string;
  website: string | null;
}): Promise<IngestedLogo | { failed: IngestFailure }> {
  const candidates = buildLogoCandidates(input.website);
  if (candidates.length === 0) {
    return { failed: { attempted: [] } };
  }

  const result = await tryCandidates(candidates);
  if ("error" in result) return { failed: result.error };

  const objectKey = buildLogoObjectKey(input.providerId, result.contentType);
  try {
    await putAssetObject({
      objectKey,
      body: result.bytes,
      contentType: result.contentType,
    });
  } catch (error) {
    const mapped = mapStorageError(error);
    if (mapped) throw mapped;
    throw error;
  }

  const publicUrl = await rawAssetUrl(objectKey).catch((error) => {
    const mapped = mapStorageError(error);
    if (mapped) throw mapped;
    throw error;
  });
  if (!publicUrl) {
    // The bytes are stored, but without R2_PUBLIC_BASE_URL we can't surface
    // a viewable URL. Treat as misconfiguration — operator should set the
    // public base before backfilling.
    throw new LogoIngestError({
      code: "LOGO_STORAGE_NOT_CONFIGURED",
      message: "Logo storage public base URL is not configured",
      stage: "upload_storage",
      status: 503,
      details: "Missing R2_PUBLIC_BASE_URL",
    });
  }

  return {
    publicUrl,
    objectKey,
    source: result.candidate.source,
    sourceUrl: result.candidate.url,
    contentType: result.contentType,
    contentHash: sha256Hex(result.bytes),
    bytes: result.bytes.byteLength,
  };
}

/**
 * Upload a manually-provided file (admin browser upload). Caller already
 * has a Buffer + content-type from `request.formData()`.
 */
export async function ingestLogoFromUpload(input: {
  providerId: string;
  body: Buffer;
  contentType: string;
}): Promise<IngestedLogo> {
  if (input.body.byteLength > MAX_LOGO_BYTES) {
    throw new LogoIngestError({
      code: "INVALID_LOGO_FILE",
      message: "File too large",
      stage: "validate_request",
      status: 413,
      details: `Max ${MAX_LOGO_BYTES} bytes`,
    });
  }
  if (input.body.byteLength < MIN_LOGO_BYTES) {
    throw new LogoIngestError({
      code: "INVALID_LOGO_FILE",
      message: "File too small to be a usable logo",
      stage: "validate_request",
      status: 400,
      details: `Min ${MIN_LOGO_BYTES} bytes`,
    });
  }

  // Magic-byte gate. Browser-supplied content-type is advisory only —
  // an attacker can send `Content-Type: image/png` with arbitrary bytes
  // (HTML, SVG with scripts, executable). Sniff the first bytes and
  // require the result to (a) be a recognized image format and (b)
  // match the declared content-type prefix. Reject SVG/HTML/XML
  // payloads outright before sniffing.
  const dangerous = detectDangerousPayload(input.body);
  if (dangerous) {
    throw new LogoIngestError({
      code: "INVALID_LOGO_FILE",
      message:
        "Unsupported file type. Use PNG, JPEG, WEBP, GIF, or ICO. SVG/HTML/XML uploads are not accepted.",
      stage: "validate_request",
      status: 415,
      details: dangerous,
    });
  }
  const sniffed = sniffImageFormat(input.body);
  if (!sniffed) {
    throw new LogoIngestError({
      code: "INVALID_LOGO_FILE",
      message: "File is not a recognized image. Use PNG, JPEG, WEBP, GIF, or ICO.",
      stage: "validate_request",
      status: 415,
      details: `magic_bytes_unrecognized`,
    });
  }
  // Use the sniffed content-type as the source of truth; the declared
  // type is only used to confirm the caller's expectation matched.
  const sniffedContentType = contentTypeForSniffed(sniffed);
  let contentType: string;
  try {
    contentType = normalizeLogoContentType(sniffedContentType);
  } catch (error) {
    throw new LogoIngestError({
      code: "INVALID_LOGO_FILE",
      message: "Unsupported file type. Use PNG, JPEG, WEBP, GIF, or ICO.",
      stage: "validate_request",
      status: 415,
      details: errorMessage(error).slice(0, 500),
    });
  }
  // Confirm declared content-type isn't lying about the format.
  // Accept variants ("image/jpg" -> jpeg, "image/x-icon" / "image/vnd.microsoft.icon" -> ico).
  const declaredFamily = (() => {
    const decl = (input.contentType || "").split(";")[0].trim().toLowerCase();
    if (decl === "image/jpg" || decl === "image/jpeg") return "image/jpeg";
    if (decl === "image/vnd.microsoft.icon" || decl === "image/x-icon") return "image/x-icon";
    return decl;
  })();
  if (declaredFamily && declaredFamily !== contentType) {
    throw new LogoIngestError({
      code: "INVALID_LOGO_FILE",
      message: "Declared file type does not match file contents.",
      stage: "validate_request",
      status: 415,
      details: `declared=${declaredFamily} actual=${contentType}`,
    });
  }

  const objectKey = buildLogoObjectKey(input.providerId, contentType);
  try {
    await putAssetObject({ objectKey, body: input.body, contentType });
  } catch (error) {
    const mapped = mapStorageError(error);
    if (mapped) throw mapped;
    throw error;
  }
  const publicUrl = await rawAssetUrl(objectKey).catch((error) => {
    const mapped = mapStorageError(error);
    if (mapped) throw mapped;
    throw error;
  });
  if (!publicUrl) {
    throw new LogoIngestError({
      code: "LOGO_STORAGE_NOT_CONFIGURED",
      message: "Logo storage public base URL is not configured",
      stage: "upload_storage",
      status: 503,
      details: "Missing R2_PUBLIC_BASE_URL",
    });
  }

  return {
    publicUrl,
    objectKey,
    source: "manual-upload",
    sourceUrl: null,
    contentType,
    contentHash: sha256Hex(input.body),
    bytes: input.body.byteLength,
  };
}
