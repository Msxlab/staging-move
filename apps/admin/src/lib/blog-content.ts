/**
 * Blog content pipeline (admin-side).
 *
 * Single entry point: takes the editor's Tiptap JSON, renders it to
 * HTML on the server using the canonical schema, sanitizes via the
 * same whitelist the public site uses, and extracts plain text. The
 * three derived strings (`html`, `text`, `readingMinutes`) are
 * persisted together so the storage row is internally consistent.
 *
 * Anything that touches user-supplied content goes through here. The
 * route handlers never bypass it — they don't even import sanitize-
 * html directly. That single funnel is the security guarantee.
 */

import { generateHTML } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import sanitizeHtml from "sanitize-html";
import { htmlToText } from "html-to-text";
import { calculateReadingMinutes } from "@locateflow/shared";

const TIPTAP_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    protocols: ["http", "https", "mailto"],
  }),
  Image.configure({ allowBase64: false }),
];

// Same image-source whitelist as `apps/web/src/lib/blog/sanitize.ts`.
// Kept literal here to avoid a cross-app dependency; if either side
// drifts, the test suite below catches it (see blog-content.test.ts).
const ALLOWED_IMAGE_HOST_PATTERNS: RegExp[] = [
  /^https:\/\/[a-z0-9.-]+\.r2\.cloudflarestorage\.com\//i,
  /^https:\/\/img\.[a-z0-9.-]+\//i,
  /^\/api\/blog\/image\?key=/, // server-rendered passthrough route
];

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h2", "h3", "h4",
    "ul", "ol", "li",
    "strong", "em", "u", "s",
    "blockquote", "code", "pre",
    "a", "img", "figure", "figcaption", "hr",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "width", "height", "loading"],
    code: ["class"],
    pre: ["class"],
    th: ["scope"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  disallowedTagsMode: "discard",
  exclusiveFilter(frame) {
    return frame.tag === "p" && !frame.text.trim() && !frame.mediaChildren.length;
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "nofollow ugc noopener noreferrer",
      target: "_blank",
    }),
    img: (tagName, attribs) => {
      const src = attribs.src ?? "";
      const ok =
        src.startsWith("/") ||
        ALLOWED_IMAGE_HOST_PATTERNS.some((re) => re.test(src));
      const safeAttrs: Record<string, string> = ok
        ? {
            ...attribs,
            loading: attribs.loading ?? "lazy",
            alt: attribs.alt ?? "",
          }
        : { "data-stripped-img": "1" };
      return ok
        ? { tagName, attribs: safeAttrs }
        : { tagName: "span", attribs: safeAttrs };
    },
  },
};

export interface RenderedContent {
  html: string;
  text: string;
  readingMinutes: number;
}

export interface RenderInput {
  /** Raw Tiptap JSON document from the editor. */
  json: unknown;
}

/**
 * Validate, render, sanitize, and extract text. Throws on a malformed
 * Tiptap document so route handlers can return 400.
 */
export function renderBlogContent(input: RenderInput): RenderedContent {
  // Defensive: Tiptap JSON must have a top-level `type: "doc"`.
  // generateHTML throws on malformed input but the message is opaque;
  // we want a clean 400 with a hint at the API boundary.
  const json = input.json as { type?: string; content?: unknown };
  if (!json || typeof json !== "object" || json.type !== "doc") {
    throw new Error("INVALID_TIPTAP_JSON");
  }

  let rawHtml: string;
  try {
    rawHtml = generateHTML(json as Parameters<typeof generateHTML>[0], TIPTAP_EXTENSIONS);
  } catch {
    throw new Error("INVALID_TIPTAP_JSON");
  }

  const html = sanitizeHtml(rawHtml, SANITIZE_OPTS);
  const text = htmlToText(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      { selector: "h2", options: { uppercase: false } },
      { selector: "h3", options: { uppercase: false } },
      { selector: "h4", options: { uppercase: false } },
    ],
  });

  return {
    html,
    text,
    readingMinutes: calculateReadingMinutes(text),
  };
}
