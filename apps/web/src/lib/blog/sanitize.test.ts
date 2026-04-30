import { describe, expect, it } from "vitest";
import { htmlToPlainText, sanitizeBlogHtml } from "./sanitize";

describe("sanitizeBlogHtml — XSS payload battery", () => {
  // The list below is curated from common XSS cheat sheets (OWASP,
  // cure53). Every payload here MUST come out either dropped or inert.

  it("strips <script> tags", () => {
    expect(sanitizeBlogHtml("<p>hi</p><script>alert(1)</script>")).not.toContain("script");
  });

  it("strips inline event handlers", () => {
    const out = sanitizeBlogHtml('<p onclick="alert(1)">hi</p>');
    expect(out).not.toMatch(/onclick/i);
  });

  it("strips javascript: links", () => {
    const out = sanitizeBlogHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it("strips data: URLs on images (data-image XSS via SVG)", () => {
    const out = sanitizeBlogHtml('<img src="data:image/svg+xml;base64,PHN2Zz4=">');
    expect(out).not.toMatch(/data:/);
  });

  it("strips <iframe>", () => {
    expect(sanitizeBlogHtml("<iframe src=//evil.com></iframe>")).not.toContain("iframe");
  });

  it("strips <style> (CSS-based exfil + clickjack overlays)", () => {
    expect(sanitizeBlogHtml("<style>body{background:url(//evil)}</style><p>x</p>")).not.toContain(
      "style",
    );
  });

  it("strips <object>, <embed>, <form>", () => {
    const out = sanitizeBlogHtml('<object data="x"></object><embed src="x"><form></form>');
    expect(out).not.toMatch(/<(object|embed|form)/i);
  });

  it("strips <meta http-equiv=refresh> redirect injection", () => {
    expect(sanitizeBlogHtml('<meta http-equiv="refresh" content="0;url=//evil">')).toBe("");
  });

  it("strips images from non-whitelisted hosts", () => {
    const out = sanitizeBlogHtml('<p><img src="https://evil.com/track.gif"></p>');
    expect(out).not.toMatch(/evil\.com/);
  });

  it("keeps images from R2", () => {
    const out = sanitizeBlogHtml(
      '<p><img src="https://account.r2.cloudflarestorage.com/bucket/x.webp" alt="x"></p>',
    );
    expect(out).toMatch(/r2\.cloudflarestorage\.com/);
  });

  it("keeps relative same-origin images", () => {
    const out = sanitizeBlogHtml('<p><img src="/uploads/blog/x.webp" alt="x"></p>');
    expect(out).toMatch(/\/uploads\/blog\/x\.webp/);
  });

  it("forces nofollow + noopener on every link", () => {
    const out = sanitizeBlogHtml('<a href="https://example.com">x</a>');
    expect(out).toMatch(/rel="nofollow ugc noopener noreferrer"/);
    expect(out).toMatch(/target="_blank"/);
  });

  it("keeps allowed structural tags", () => {
    const out = sanitizeBlogHtml(
      "<h2>Title</h2><p><strong>bold</strong> and <em>italic</em></p><blockquote>q</blockquote>",
    );
    expect(out).toContain("<h2>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<em>");
    expect(out).toContain("<blockquote>");
  });

  it("drops empty paragraphs", () => {
    const out = sanitizeBlogHtml("<p></p><p>real content</p><p>   </p>");
    expect(out).toBe("<p>real content</p>");
  });

  it("forces lazy loading on images", () => {
    const out = sanitizeBlogHtml('<img src="/x.webp" alt="x">');
    expect(out).toMatch(/loading="lazy"/);
  });

  it("does not double-decode entity-smuggled scripts", () => {
    // A common bypass attempt: &lt;script&gt;alert(1)&lt;/script&gt; left
    // in attribute values. After sanitize, this is encoded and inert.
    const out = sanitizeBlogHtml('<p title="&lt;script&gt;">x</p>');
    expect(out).not.toMatch(/<script/);
  });
});

describe("htmlToPlainText", () => {
  it("strips all tags", () => {
    expect(htmlToPlainText("<p>hello <strong>world</strong></p>")).toContain("hello world");
  });

  it("skips images", () => {
    const out = htmlToPlainText('<p>before</p><img src="/x" alt="img"><p>after</p>');
    expect(out).not.toMatch(/img|alt/i);
    expect(out).toMatch(/before/);
    expect(out).toMatch(/after/);
  });
});
