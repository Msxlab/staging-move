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

const MAX_LOGO_BYTES = 1_000_000; // 1 MB hard cap — real logos are well under
const MIN_LOGO_BYTES = 256;       // anything smaller is a 1x1 placeholder
const FETCH_TIMEOUT_MS = 1_500;
const R2_PUT_TIMEOUT_DETAILS = "3000ms";

export type LogoIngestFailureStage =
  | "fetch_homepage"
  | "parse_logo"
  | "download_asset"
  | "upload_storage"
  | "create_candidate";

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
  if (message === "R2_ASSET_STORAGE_NOT_CONFIGURED") {
    return new LogoIngestError({
      code: "LOGO_STORAGE_NOT_CONFIGURED",
      message: "Logo storage is not configured",
      stage: "upload_storage",
      status: 503,
      details:
        "Missing R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY",
    });
  }
  if (message === "R2_PUBLIC_BASE_URL_MISSING") {
    return new LogoIngestError({
      code: "LOGO_STORAGE_PUBLIC_URL_MISSING",
      message: "Logo storage public base URL is not configured",
      stage: "upload_storage",
      status: 503,
      details: "Missing R2_PUBLIC_BASE_URL",
    });
  }
  if (message === "R2_PUT_TIMEOUT") {
    return new LogoIngestError({
      code: "LOGO_STORAGE_UPLOAD_TIMEOUT",
      message: "Logo storage upload timed out",
      stage: "upload_storage",
      status: 504,
      details: `R2 PUT exceeded ${R2_PUT_TIMEOUT_DETAILS}`,
    });
  }
  if (message.startsWith("R2_PUT_FAILED:")) {
    return new LogoIngestError({
      code: "LOGO_STORAGE_UPLOAD_FAILED",
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Some logo CDNs (Clearbit) return a tiny 1x1 transparent PNG when
        // they have no logo, instead of a 404. Sending a UA that looks like
        // a browser doesn't help — we just have to validate the response
        // bytes downstream.
        "User-Agent": "LocateFlow-LogoFetcher/1.0",
        Accept: "image/*",
      },
    });
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
    return {
      status: res.status,
      contentType,
      rawContentType,
      bytes: Buffer.from(await res.arrayBuffer()),
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
      const reason =
        err instanceof LogoIngestError && err.code === "LOGO_DOWNLOAD_TIMEOUT"
          ? "timeout"
          : "fetch_error";
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
      code: "LOGO_STORAGE_PUBLIC_URL_MISSING",
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
  const contentType = normalizeLogoContentType(input.contentType);
  if (input.body.byteLength > MAX_LOGO_BYTES) {
    throw new Error("LOGO_TOO_LARGE");
  }
  if (input.body.byteLength < MIN_LOGO_BYTES) {
    throw new Error("LOGO_TOO_SMALL");
  }

  const objectKey = buildLogoObjectKey(input.providerId, contentType);
  await putAssetObject({ objectKey, body: input.body, contentType });
  const publicUrl = await rawAssetUrl(objectKey);
  if (!publicUrl) throw new Error("R2_PUBLIC_BASE_URL_MISSING");

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
