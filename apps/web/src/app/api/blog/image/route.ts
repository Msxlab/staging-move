/**
 * GET /api/blog/image?key=<r2-key>&w=<width>
 *
 * Same-origin redirect to a signed imgproxy URL. The Tiptap editor
 * inserts `<img src="/api/blog/image?key=..."/>` so the page stays
 * portable across environments (the editor never has to know the
 * runtime imgproxy host) and so the public CSP can keep
 * `img-src 'self'` for the editor passthrough while still allowing
 * the imgproxy host directly for hot-path renders.
 *
 * Hard validations:
 *   - `key` must match `blog/<yyyy-mm>/<adminId>/<uuid>.<ext>` shape
 *   - `w` (width) is clamped to 320..1600
 * Any mismatch returns 400 — never 302 — so we don't burn CDN cache
 * on bad inputs.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { buildBlogContentImageUrl } from "@/lib/blog/imgproxy-url";

const KEY_PATTERN = /^blog\/\d{4}-\d{2}\/[a-z0-9]+\/[a-f0-9-]+\.(jpg|png|webp|avif)$/i;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const widthParam = url.searchParams.get("w");

  if (!key || !KEY_PATTERN.test(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  let width = parseInt(widthParam ?? "1200", 10) || 1200;
  width = Math.min(Math.max(width, 320), 1600);

  let target: string;
  try {
    target = buildBlogContentImageUrl(key, width);
  } catch {
    return NextResponse.json({ error: "Image proxy not configured" }, { status: 503 });
  }

  // 302 — the resulting URL is HMAC-signed and stable for the input,
  // so CDNs cache by the original `?key=&w=` (which we redirect with
  // a long max-age below).
  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      "cache-control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
