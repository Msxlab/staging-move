/**
 * Per-post Open Graph image for /blog/<slug>.
 *
 * Generates a 1200x630 branded card with the post's title and category
 * so social/AI link previews show the actual article — not the generic
 * sitewide OG image. Runs on the Node runtime (not edge) because it
 * reads the post from the database via Prisma. When a post has a real
 * R2 cover, the page metadata points at that instead and this route is
 * the fallback (see generateMetadata in ./page.tsx).
 */
import { ImageResponse } from "next/og";
import { getPublicPostBySlug } from "@/lib/blog/queries";

export const alt = "LocateFlow blog article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function clampTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 116 ? `${trimmed.slice(0, 113).trimEnd()}…` : trimmed;
}

export default async function BlogPostOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublicPostBySlug(slug).catch(() => null);

  const title = clampTitle(post?.title ?? "Field-tested guides for your move");
  const category = post?.category?.name ?? "The Field Guide";
  const titleSize = title.length > 72 ? 60 : 70;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "80px",
          background:
            "linear-gradient(135deg, #0A0F18 0%, #0E1521 50%, #131C2C 100%)",
          color: "#ECF1F8",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(135deg, #B49BFF 0%, #5C9DDC 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 40px rgba(127, 182, 232, 0.40)",
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 800, color: "#ECF1F8" }}>L</span>
          </div>
          <span
            style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.2, color: "#ECF1F8" }}
          >
            LocateFlow
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#A5C9F0",
            }}
          >
            {category}
          </span>
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -2,
              color: "#ECF1F8",
              maxWidth: 1040,
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 20px",
            borderRadius: 999,
            background: "rgba(127, 182, 232, 0.10)",
            border: "1px solid rgba(127, 182, 232, 0.30)",
            alignSelf: "flex-start",
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7FB6E8" }} />
          <span style={{ fontSize: 20, color: "#A5C9F0", fontWeight: 600 }}>
            locateflow.com/blog
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
