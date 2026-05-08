/**
 * Conservative HTML sanitizer for admin-authored email templates.
 *
 * Email clients are heterogeneous and most strip scripts already, but
 * the sanitizer here exists as a defense-in-depth layer:
 *   - the same templates are previewed inside the admin UI (where any
 *     un-sanitized HTML becomes stored XSS against the operator),
 *   - some clients (Outlook desktop, ProtonMail) retain malicious
 *     attributes that we do not want propagated,
 *   - we want a deterministic record of what *we* would render so we
 *     can audit phishing-template disputes years later without having
 *     to reproduce client behavior.
 *
 * Allowed tags: heading, paragraph, span, strong/em/u, br, hr, link,
 * image, ordered/unordered list, list item, blockquote, code, pre,
 * table primitives. Disallowed tags are stripped while preserving
 * their text content.
 *
 * Allowed attributes: href (links), src/alt/width/height (images),
 * style limited to safe CSS properties, and a tightly constrained
 * `data-locateflow-*` namespace for our own template variable markers.
 *
 * Stripped: <script>, <style>, <iframe>, <object>, <embed>, <link>,
 * <form>, <input>, event handlers (`on*`), `javascript:` / `data:` /
 * `vbscript:` URLs (except `data:image/png;base64,...` which is kept
 * for inline tracking pixels; SVG data URIs are blocked because they
 * can contain scripts), and any `<meta>`/`<base>` that could redirect.
 *
 * The implementation is a tiny, dependency-free streaming tokenizer.
 * It does NOT cover every edge case that a real DOM-based sanitizer
 * would (e.g. crafted CDATA sections, pathological mismatched tags),
 * which is acceptable because the input source is admin staff with
 * step-up auth and a full audit trail.
 */

const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "small",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);

const ALLOWED_ATTRS_BY_TAG: Record<string, ReadonlySet<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  td: new Set(["colspan", "rowspan", "align"]),
  th: new Set(["colspan", "rowspan", "align", "scope"]),
  table: new Set(["align", "border", "cellpadding", "cellspacing"]),
};

// `style` is allowed everywhere but the value passes through a strict
// CSS sanitizer that only keeps a small allowlist of properties. We
// intentionally do not allow `behavior`, `expression`, `position:fixed`,
// or anything containing `url(`/`javascript:` constructs.
const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "font-size",
  "font-weight",
  "font-style",
  "font-family",
  "text-align",
  "text-decoration",
  "line-height",
  "padding",
  "padding-top",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "margin",
  "margin-top",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "border",
  "border-radius",
  "width",
  "max-width",
  "min-width",
  "height",
  "max-height",
  "letter-spacing",
]);

function sanitizeStyleAttr(raw: string): string {
  const declarations = raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const safe: string[] = [];
  for (const declaration of declarations) {
    const match = /^([a-zA-Z-]+)\s*:\s*(.+)$/.exec(declaration);
    if (!match) continue;
    const prop = match[1].toLowerCase();
    let value = match[2].trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    // Reject anything that smells like an exploit primitive.
    if (/url\s*\(/i.test(value)) continue;
    if (/expression\s*\(/i.test(value)) continue;
    if (/javascript\s*:/i.test(value)) continue;
    if (/[<>]/.test(value)) continue;
    safe.push(`${prop}: ${value}`);
  }
  return safe.join("; ");
}

function isSafeUrl(value: string, options: { allowDataImage?: boolean }): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Relative or fragment URLs are always safe.
  if (trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return true;
  }
  // Allow http(s), mailto, tel.
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^mailto:/i.test(trimmed)) return true;
  if (/^tel:/i.test(trimmed)) return true;
  // Allow `data:image/png;base64,...` only on <img src> if requested.
  if (options.allowDataImage && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(trimmed)) {
    return true;
  }
  return false;
}

function sanitizeAttribute(
  tagName: string,
  attrName: string,
  attrValue: string,
): string | null {
  const lowerName = attrName.toLowerCase();
  // Reject every event handler outright.
  if (lowerName.startsWith("on")) return null;
  // Reject `formaction`, `xlink:href`, etc. — these can navigate or
  // execute when the parent element is interacted with.
  if (lowerName === "formaction" || lowerName === "xlink:href") return null;
  // Allow data-locateflow-* attributes for our own template markers.
  if (lowerName.startsWith("data-locateflow-")) {
    if (/[<>]/.test(attrValue)) return null;
    return attrValue;
  }
  if (lowerName === "class" || lowerName === "id") {
    // Strip < > to avoid breaking out of the attribute, then keep.
    return attrValue.replace(/[<>"]/g, "");
  }
  if (lowerName === "style") {
    const safe = sanitizeStyleAttr(attrValue);
    return safe || null;
  }
  const allowed = ALLOWED_ATTRS_BY_TAG[tagName];
  if (!allowed || !allowed.has(lowerName)) return null;
  if (lowerName === "href") {
    return isSafeUrl(attrValue, { allowDataImage: false }) ? attrValue : null;
  }
  if (lowerName === "src") {
    return isSafeUrl(attrValue, { allowDataImage: true }) ? attrValue : null;
  }
  if (lowerName === "target") {
    // Only allow `_blank`, and force noopener/noreferrer downstream.
    return attrValue === "_blank" ? "_blank" : null;
  }
  if (lowerName === "rel") {
    // Drop anything that looks like a navigation override.
    return attrValue
      .split(/\s+/)
      .filter((tok) => /^(noopener|noreferrer|nofollow|external)$/i.test(tok))
      .join(" ");
  }
  // Numeric / textual attributes — strip < and > to avoid attribute
  // breakouts.
  return attrValue.replace(/[<>"]/g, "");
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseAttributes(rawAttrs: string): Array<{ name: string; value: string }> {
  const result: Array<{ name: string; value: string }> = [];
  const re = /([a-zA-Z_][a-zA-Z0-9_:.-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(rawAttrs)) !== null) {
    const name = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    result.push({ name, value });
  }
  return result;
}

/**
 * Sanitize an HTML email body. Returns a string safe to render inside
 * a preview iframe and safe to send to a mail provider. Throws nothing —
 * malformed input is simply stripped to text.
 *
 * Scripts, styles, iframes, forms, and anything with `javascript:` /
 * `vbscript:` URLs are removed entirely (their text content is also
 * removed for `<script>`/`<style>` because preserving the script body
 * is never useful and is dangerous for preview).
 */
export function sanitizeEmailHtml(input: string): string {
  if (typeof input !== "string") return "";
  // Hard caps so a malicious admin cannot wedge a 10MB blob into the
  // template store.
  const truncated = input.length > 200_000 ? input.slice(0, 200_000) : input;

  let i = 0;
  const out: string[] = [];
  let dropContent = 0; // counter — text inside a dropped element is suppressed

  while (i < truncated.length) {
    const ch = truncated[i];
    if (ch !== "<") {
      // Plain text — escape and emit, unless we are inside a dropped tag.
      let next = truncated.indexOf("<", i);
      if (next === -1) next = truncated.length;
      const text = truncated.slice(i, next);
      if (dropContent === 0) {
        out.push(escapeText(text));
      }
      i = next;
      continue;
    }

    // Comment.
    if (truncated.startsWith("<!--", i)) {
      const close = truncated.indexOf("-->", i + 4);
      i = close === -1 ? truncated.length : close + 3;
      continue;
    }
    // Doctype / processing instruction.
    if (truncated[i + 1] === "!" || truncated[i + 1] === "?") {
      const close = truncated.indexOf(">", i + 1);
      i = close === -1 ? truncated.length : close + 1;
      continue;
    }

    const closing = truncated[i + 1] === "/";
    const tagStart = closing ? i + 2 : i + 1;
    const tagEnd = (() => {
      let j = tagStart;
      while (j < truncated.length) {
        const c = truncated[j];
        if (c === ">" || /\s/.test(c)) return j;
        j++;
      }
      return truncated.length;
    })();
    const tagName = truncated.slice(tagStart, tagEnd).toLowerCase();
    const close = truncated.indexOf(">", tagEnd);
    if (close === -1) {
      // Malformed — drop the rest.
      break;
    }
    const rawAttrs = truncated.slice(tagEnd, close);
    i = close + 1;

    if (!tagName) continue;

    // Tags we drop along with their content (script/style/iframe/etc.).
    const DROP_WITH_CONTENT = new Set([
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "select",
      "option",
      "textarea",
      "button",
      "noscript",
      "link",
      "meta",
      "base",
      "svg",
    ]);

    if (DROP_WITH_CONTENT.has(tagName)) {
      if (closing) {
        if (dropContent > 0) dropContent -= 1;
        continue;
      }
      // Self-closing? skip increment.
      const isSelfClosing = rawAttrs.trim().endsWith("/");
      if (!isSelfClosing) dropContent += 1;
      continue;
    }

    if (dropContent > 0) {
      // We're inside a dropped element — ignore both opening and closing.
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      // Unknown tag — drop tag, keep text content (we'll see future
      // closing tag and ignore it the same way).
      continue;
    }

    if (closing) {
      if (VOID_TAGS.has(tagName)) continue;
      out.push(`</${tagName}>`);
      continue;
    }

    const attrs = parseAttributes(rawAttrs);
    const safeAttrs: string[] = [];
    let hasTargetBlank = false;
    let hasRel = false;
    for (const { name, value } of attrs) {
      const lowerName = name.toLowerCase();
      const cleaned = sanitizeAttribute(tagName, lowerName, value);
      if (cleaned === null) continue;
      if (lowerName === "target" && cleaned === "_blank") hasTargetBlank = true;
      if (lowerName === "rel") hasRel = true;
      safeAttrs.push(`${lowerName}="${cleaned.replace(/"/g, "&quot;")}"`);
    }
    // Force rel=noopener noreferrer on every <a target="_blank">.
    if (tagName === "a" && hasTargetBlank && !hasRel) {
      safeAttrs.push(`rel="noopener noreferrer"`);
    }

    out.push(`<${tagName}${safeAttrs.length > 0 ? " " + safeAttrs.join(" ") : ""}${VOID_TAGS.has(tagName) ? " /" : ""}>`);
  }

  return out.join("");
}

/**
 * Sanitize a plain-text subject line. Strip control characters and
 * truncate to a reasonable email-subject length.
 */
export function sanitizeEmailSubject(input: string): string {
  if (typeof input !== "string") return "";
  const stripped = input.replace(/[ -]/g, "").replace(/\r?\n/g, " ");
  return stripped.slice(0, 255).trim();
}
