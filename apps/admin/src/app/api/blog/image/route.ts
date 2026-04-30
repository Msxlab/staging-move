/**
 * Admin-side passthrough for blog editor images.
 *
 * Stored content uses `/api/blog/image?key=...` so it remains portable
 * on the public web app. The admin app mirrors that route and redirects
 * to the public web origin, letting editor previews render the same URL
 * shape without teaching Tiptap about deployment hostnames.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const KEY_PATTERN = /^blog\/\d{4}-\d{2}\/[a-z0-9]+\/[a-f0-9-]+\.(jpg|png|webp|avif)$/i;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const width = url.searchParams.get("w") || "1200";
  if (!key || !KEY_PATTERN.test(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const webUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (!webUrl) {
    return NextResponse.json({ error: "Image proxy not configured" }, { status: 503 });
  }

  const target = new URL("/api/blog/image", webUrl);
  target.searchParams.set("key", key);
  target.searchParams.set("w", width);
  return NextResponse.redirect(target, { status: 302 });
}
