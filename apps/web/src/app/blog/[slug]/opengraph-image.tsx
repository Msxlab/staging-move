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

export const alt = "Move blog article";
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
            "linear-gradient(135deg, #070B14 0%, #121B2D 50%, #18233A 100%)",
          color: "#EFF3FA",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(135deg, #DCBC7C 0%, #B0852F 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 40px rgba(203, 164, 94, 0.40)",
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 800, color: "#EFF3FA" }}>M</span>
          </div>
          <span
            style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.2, color: "#EFF3FA" }}
          >
            Move
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#DCBC7C",
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
              color: "#EFF3FA",
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
            background: "rgba(203, 164, 94, 0.10)",
            border: "1px solid rgba(203, 164, 94, 0.30)",
            alignSelf: "flex-start",
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#CBA45E" }} />
          <span style={{ fontSize: 20, color: "#DCBC7C", fontWeight: 600 }}>
            locateflow.com/blog
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
