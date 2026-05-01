import "server-only";
import sanitizeHtml from "sanitize-html";
import { htmlToText } from "html-to-text";

/**
 * Server-side HTML sanitization for blog content.
 *
 * The Tiptap editor's JSON output is rendered to HTML on the SERVER
 * (never trusting the client to pre-render), then passed through this
 * sanitizer. The sanitized string is what we persist in
 * `BlogPost.contentHtml` and inject into pages — so anything that
 * survives this function is what every reader sees.
 *
 * Whitelist philosophy: minimum viable expressive markup. Anything not
 * explicitly allowed is dropped. Iframes, scripts, styles, event
 * handlers, data URLs, and JS-protocol links are all stripped.
 *
 * Why sanitize-html (vs DOMPurify): pure-Node, no jsdom shim, runs on
 * the Edge runtime (in case we move admin write-paths there) and
 * inside Vitest without environment plumbing. We do NOT sanitize on
 * the client — never give an attacker two passes at the parser.
 */

// Hosts we trust to serve <img> from. Adding a host here means any
// post can embed images from it, so be conservative. R2 + imgproxy are
// our only first-party image origins.
const ALLOWED_IMAGE_HOST_PATTERNS: RegExp[] = [
  // R2 public bucket URL
  /^https:\/\/[a-z0-9.-]+\.r2\.cloudflarestorage\.com\//i,
  // imgproxy host (production)
  /^https:\/\/img\.[a-z0-9.-]+\//i,
  // Configured imgproxy URL via env (handled at call site)
];

const ALLOWED_LINK_PROTOCOLS = ["http", "https", "mailto"];

// Canonical export so admin/web/test can all reach the same config and
// inspection helpers can verify what was applied to a stored post.
export const BLOG_SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "u",
    "s",
    "blockquote",
    "code",
    "pre",
    "a",
    "img",
    "figure",
    "figcaption",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "width", "height", "loading"],
    code: ["class"], // hljs-* language hints
    pre: ["class"],
    th: ["scope"],
  },
  allowedSchemes: ALLOWED_LINK_PROTOCOLS,
  allowedSchemesByTag: {
    img: ["https"], // forbid http/data/javascript on <img>
  },
  // Drop anything else entirely; do NOT escape it back into the output.
  disallowedTagsMode: "discard",
  // Strip empty elements that the editor might leave behind.
  exclusiveFilter(frame) {
    if (frame.tag === "p" && !frame.text.trim() && !frame.mediaChildren.length) {
      return true;
    }
    return false;
  },
  transformTags: {
    // Force every external link to safe defaults. UGC marker tells
    // search engines this is editor-supplied — it's a softer signal
    // than nofollow but we add nofollow too for hardening.
    a: sanitizeHtml.simpleTransform("a", {
      rel: "nofollow ugc noopener noreferrer",
      target: "_blank",
    }),
    // Force lazy loading + missing-alt fallback on every <img>.
    img: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        loading: attribs.loading ?? "lazy",
        alt: attribs.alt ?? "",
      },
    }),
  },
};

function isAllowedImageSrc(src: string): boolean {
  if (!src) return false;
  // Relative URLs are allowed (we serve them from same origin).
  if (src.startsWith("/")) return true;
  return ALLOWED_IMAGE_HOST_PATTERNS.some((re) => re.test(src));
}

/**
 * Sanitize a raw HTML string for storage.
 *
 * Pass `imgproxyHost` so we can extend the host whitelist with the
 * runtime imgproxy host (set in `NEXT_PUBLIC_IMGPROXY_URL`). Without
 * the env present, we still accept R2 URLs.
 */
export function sanitizeBlogHtml(rawHtml: string, opts: { imgproxyHost?: string } = {}): string {
  const config: sanitizeHtml.IOptions = {
    ...BLOG_SANITIZE_CONFIG,
    transformTags: {
      ...BLOG_SANITIZE_CONFIG.transformTags,
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        const ok =
          isAllowedImageSrc(src) ||
          (opts.imgproxyHost && src.startsWith(opts.imgproxyHost));
        if (!ok) {
          // Drop the image silently — replace with an inert span the
          // editor preview can highlight. We force a uniform attrs
          // shape across both branches so sanitize-html's Transformer
          // signature stays single-typed.
          const stripAttrs: Record<string, string> = { "data-stripped-img": "1" };
          return { tagName: "span", attribs: stripAttrs };
        }
        const safeAttrs: Record<string, string> = {
          ...attribs,
          loading: attribs.loading ?? "lazy",
          alt: attribs.alt ?? "",
        };
        return { tagName, attribs: safeAttrs };
      },
    },
  };
  return sanitizeHtml(rawHtml, config);
}

/**
 * Strip all HTML to a plain-text representation. Used for:
 *   - `BlogPost.contentText` (search index, AI crawlers via /llms.txt)
 *   - reading-time calculation
 *   - default excerpt fallback
 *
 * `htmlToText` is configured to skip images and tables (which produce
 * noisy text output) and to keep links as `Anchor (URL)`.
 */
export function htmlToPlainText(html: string): string {
  return htmlToText(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      { selector: "h2", options: { uppercase: false } },
      { selector: "h3", options: { uppercase: false } },
      { selector: "h4", options: { uppercase: false } },
    ],
  });
}
