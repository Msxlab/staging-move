/**
 * GET /api/blog/indexnow-key/<key>
 *
 * IndexNow protocol requires the publisher to host the key as a
 * plain-text file at a known URL so Bing/Yandex can verify ownership.
 * We don't want to drop a static file at the repo root, so we serve
 * the key dynamically from this route and reference it as
 * `keyLocation` in every ping. The path includes the key so a
 * scanner randomly probing the host gets a 404 unless they already
 * know it.
 *
 * Security: the key is not a secret — it's published with every
 * ping. The only abuse vector is misuse for brand impersonation,
 * which IndexNow blocks via the host-match check on its side.
 */

export const dynamic = "force-static";
export const revalidate = 86400;

import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const expected = process.env.INDEXNOW_KEY;
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(expected, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
