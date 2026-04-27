/**
 * Provider logo ingestion. Coordinates:
 *   1. Build candidate URLs (logo-fetcher).
 *   2. Try each candidate — fetch bytes, sniff/normalize content-type,
 *      reject obviously-bad responses (HTML 200s, oversized payloads,
 *      transparent-pixel "always returns success" placeholders).
 *   3. PUT bytes to R2 under `provider-logo/<providerId>/<uuid>.<ext>`.
 *   4. Return the final public CDN URL the caller should write to
 *      `ServiceProvider.logoUrl`.
 *
 * All network I/O lives here; logo-fetcher.ts stays pure.
 */
import { buildLogoCandidates, type LogoCandidate, type LogoSource } from "@/lib/logo-fetcher";
import {
  buildLogoObjectKey,
  normalizeLogoContentType,
  putAssetObject,
  rawAssetUrl,
} from "@/lib/r2-asset-storage";

const MAX_LOGO_BYTES = 1_000_000; // 1 MB hard cap — real logos are well under
const MIN_LOGO_BYTES = 256;       // anything smaller is a 1x1 placeholder
const FETCH_TIMEOUT_MS = 5_000;

export interface IngestedLogo {
  publicUrl: string;
  objectKey: string;
  source: LogoSource;
  contentType: string;
  bytes: number;
}

export interface IngestFailure {
  attempted: Array<{ source: LogoCandidate["source"]; reason: string }>;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
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
      const res = await fetchWithTimeout(candidate.url);
      if (!res.ok) {
        attempted.push({ source: candidate.source, reason: `http_${res.status}` });
        continue;
      }
      const contentType = normalizeContentType(res.headers.get("content-type"));
      if (!contentType) {
        attempted.push({ source: candidate.source, reason: "unsupported_content_type" });
        continue;
      }

      const buf = Buffer.from(await res.arrayBuffer());
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

      return { candidate, contentType, bytes: buf };
    } catch (err: any) {
      const reason = err?.name === "AbortError" ? "timeout" : "fetch_error";
      attempted.push({ source: candidate.source, reason });
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
  await putAssetObject({
    objectKey,
    body: result.bytes,
    contentType: result.contentType,
  });

  const publicUrl = await rawAssetUrl(objectKey);
  if (!publicUrl) {
    // The bytes are stored, but without R2_PUBLIC_BASE_URL we can't surface
    // a viewable URL. Treat as misconfiguration — operator should set the
    // public base before backfilling.
    throw new Error("R2_PUBLIC_BASE_URL_MISSING");
  }

  return {
    publicUrl,
    objectKey,
    source: result.candidate.source,
    contentType: result.contentType,
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
    contentType,
    bytes: input.body.byteLength,
  };
}
