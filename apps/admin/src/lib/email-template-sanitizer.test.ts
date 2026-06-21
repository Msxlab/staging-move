import { describe, expect, it } from "vitest";
import {
  sanitizeEmailHtml,
  sanitizeEmailSubject,
} from "@/lib/email-template-sanitizer";

describe("sanitizeEmailHtml", () => {
  it("preserves basic safe markup", () => {
    const out = sanitizeEmailHtml("<p>Hello <strong>world</strong></p>");
    expect(out).toBe("<p>Hello <strong>world</strong></p>");
  });

  it("strips <script> tags and their content", () => {
    const out = sanitizeEmailHtml(
      "<p>Hi</p><script>alert(1)</script><p>Bye</p>",
    );
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>Hi</p>");
    expect(out).toContain("<p>Bye</p>");
  });

  it("strips event handlers", () => {
    const out = sanitizeEmailHtml('<a href="https://example.com" onclick="alert(1)">x</a>');
    expect(out).not.toContain("onclick");
    expect(out).toContain('href="https://example.com"');
  });

  it("blocks javascript: URLs", () => {
    const out = sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript");
  });

  it("blocks data: URLs except inline images", () => {
    expect(sanitizeEmailHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>'))
      .not.toContain("data:");
    const imgOut = sanitizeEmailHtml(
      '<img src="data:image/png;base64,AAAA" alt="logo">',
    );
    expect(imgOut).toContain("data:image/png");
  });

  it("blocks SVG data URLs in images", () => {
    const out = sanitizeEmailHtml(
      '<img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E">',
    );
    expect(out).not.toContain("data:image/svg");
  });

  it("strips <style> blocks", () => {
    const out = sanitizeEmailHtml(
      "<style>body{display:none}</style><p>visible</p>",
    );
    expect(out).not.toContain("display:none");
    expect(out).toContain("<p>visible</p>");
  });

  it("strips <iframe>, <object>, <embed>", () => {
    const out = sanitizeEmailHtml(
      '<iframe src="https://evil.com"></iframe><object></object><embed>',
    );
    expect(out).not.toContain("iframe");
    expect(out).not.toContain("object");
    expect(out).not.toContain("embed");
  });

  it("strips <form>, <input>, <button>", () => {
    const out = sanitizeEmailHtml(
      '<form><input type="text" name="evil"><button>click</button></form>',
    );
    expect(out).not.toContain("<form");
    expect(out).not.toContain("<input");
    expect(out).not.toContain("<button");
  });

  it("forces rel=noopener noreferrer on target=_blank links", () => {
    const out = sanitizeEmailHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("preserves existing rel tokens while adding noopener noreferrer for target=_blank links", () => {
    const out = sanitizeEmailHtml('<a href="https://example.com" target="_blank" rel="nofollow ugc">x</a>');
    expect(out).toContain('rel="nofollow ugc noopener noreferrer"');
  });

  it("only allows target=_blank value", () => {
    const out = sanitizeEmailHtml('<a href="https://example.com" target="_top">x</a>');
    expect(out).not.toContain('target="_top"');
  });

  it("strips dangerous style values", () => {
    const out = sanitizeEmailHtml(
      '<p style="color: red; behavior:url(\'evil.htc\'); background:url(\'javascript:alert(1)\');">x</p>',
    );
    expect(out).toContain("color: red");
    expect(out).not.toContain("behavior");
    expect(out).not.toContain("javascript");
  });

  it("HTML-escapes ampersand and right-angle in text", () => {
    // Note: `<` in text is parsed as a possible tag start. Authors are
    // expected to encode it as `&lt;` already; the sanitizer escapes
    // `&` and `>` defensively.
    const out = sanitizeEmailHtml("<p>20 > 15 & true</p>");
    expect(out).toContain("20 &gt; 15 &amp; true");
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeEmailHtml(null as any)).toBe("");
    expect(sanitizeEmailHtml(undefined as any)).toBe("");
  });
});

describe("sanitizeEmailSubject", () => {
  it("strips control characters", () => {
    const out = sanitizeEmailSubject("hello\nworld\r\nNew header injection");
    expect(out).not.toMatch(/[\r\n]/);
  });

  it("trims whitespace", () => {
    expect(sanitizeEmailSubject("   hi   ")).toBe("hi");
  });

  it("truncates to 255 chars", () => {
    const long = "x".repeat(300);
    expect(sanitizeEmailSubject(long).length).toBe(255);
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeEmailSubject(null as any)).toBe("");
  });
});
