import { describe, expect, it } from "vitest";
import { sanitizeEmailHtml, sanitizeEmailSubject } from "./email-html-sanitizer";

describe("sanitizeEmailHtml", () => {
  it("forces rel=noopener noreferrer on target=_blank links", () => {
    const out = sanitizeEmailHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("preserves existing rel tokens while adding noopener noreferrer for target=_blank links", () => {
    const out = sanitizeEmailHtml('<a href="https://example.com" target="_blank" rel="nofollow ugc">x</a>');
    expect(out).toContain('rel="nofollow ugc noopener noreferrer"');
  });

  it("keeps non-blank rel values unchanged when target is not _blank", () => {
    const out = sanitizeEmailHtml('<a href="https://example.com" rel="nofollow">x</a>');
    expect(out).toContain('rel="nofollow"');
    expect(out).not.toContain("noopener");
  });

  it("blocks javascript URLs", () => {
    const out = sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript");
  });
});

describe("sanitizeEmailSubject", () => {
  it("strips newline characters", () => {
    const out = sanitizeEmailSubject("hello\r\nbcc: person@example.com");
    expect(out).toBe("hellobcc: person@example.com");
  });
});
