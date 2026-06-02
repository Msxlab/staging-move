import { describe, expect, it } from "vitest";
import { renderBlogContent } from "./blog-content";

function doc(content: unknown[]) {
  return { type: "doc", content };
}

function paragraph(text: string, marks?: unknown[]) {
  return {
    type: "paragraph",
    content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
  };
}

describe("renderBlogContent", () => {
  it("rejects malformed editor documents at the API boundary", () => {
    expect(() => renderBlogContent({ json: null })).toThrow("INVALID_TIPTAP_JSON");
    expect(() => renderBlogContent({ json: { type: "paragraph" } })).toThrow("INVALID_TIPTAP_JSON");
  });

  it("sanitizes unsafe links while preserving safe editorial markup", () => {
    const rendered = renderBlogContent({
      json: doc([
        paragraph("Safe heading"),
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "unsafe link",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
        paragraph("safe link", [{ type: "link", attrs: { href: "https://example.com/path" } }]),
      ]),
    });

    expect(rendered.html).not.toContain("javascript:");
    expect(rendered.html).toContain('href="https://example.com/path"');
    expect(rendered.html).toContain('rel="nofollow ugc noopener noreferrer"');
    expect(rendered.html).toContain('target="_blank"');
    expect(rendered.text).toContain("Safe heading");
  });

  it("allows first-party blog images and strips data-url images", () => {
    const rendered = renderBlogContent({
      json: doc([
        {
          type: "image",
          attrs: {
            src: "/api/blog/image?key=blog/2026/cover.webp",
            alt: "cover",
          },
        },
        {
          type: "image",
          attrs: {
            src: "https://assets.r2.cloudflarestorage.com/blog/cover.webp",
            alt: "r2 cover",
          },
        },
        {
          type: "image",
          attrs: {
            src: "data:image/svg+xml,%3Csvg%20onload=alert(1)%3E%3C/svg%3E",
            alt: "evil",
          },
        },
      ]),
    });

    expect(rendered.html).toContain('src="/api/blog/image?key=blog/2026/cover.webp"');
    expect(rendered.html).toContain('src="https://assets.r2.cloudflarestorage.com/blog/cover.webp"');
    expect(rendered.html).not.toContain("data:image");
    expect(rendered.html).not.toContain("onload");
  });
});
