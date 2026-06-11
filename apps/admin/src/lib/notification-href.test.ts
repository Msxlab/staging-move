import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeNotificationHref, isValidNotificationHref } from "./notification-href";

const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL;

describe("sanitizeNotificationHref", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.locateflow.com";
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL;
    vi.restoreAllMocks();
  });

  it("treats null / empty as no href", () => {
    expect(sanitizeNotificationHref(null)).toEqual({ ok: true, value: null });
    expect(sanitizeNotificationHref(undefined)).toEqual({ ok: true, value: null });
    expect(sanitizeNotificationHref("   ")).toEqual({ ok: true, value: null });
  });

  it("allows in-app relative paths", () => {
    expect(sanitizeNotificationHref("/dashboard")).toEqual({ ok: true, value: "/dashboard" });
    expect(sanitizeNotificationHref("/moving/plan/abc?tab=1#x")).toEqual({
      ok: true,
      value: "/moving/plan/abc?tab=1#x",
    });
    expect(sanitizeNotificationHref("/")).toEqual({ ok: true, value: "/" });
  });

  it("allows same-origin https absolute URLs", () => {
    const r = sanitizeNotificationHref("https://app.locateflow.com/settings");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("https://app.locateflow.com/settings");
  });

  it("rejects javascript: / data: / vbscript: schemes (stored XSS)", () => {
    expect(sanitizeNotificationHref("javascript:alert(1)").ok).toBe(false);
    expect(sanitizeNotificationHref("JaVaScRiPt:alert(1)").ok).toBe(false);
    expect(sanitizeNotificationHref("data:text/html,<script>1</script>").ok).toBe(false);
    expect(sanitizeNotificationHref("vbscript:msgbox(1)").ok).toBe(false);
  });

  it("rejects control-char obfuscation like 'java\\tscript:'", () => {
    expect(sanitizeNotificationHref("java\tscript:alert(1)").ok).toBe(false);
    expect(sanitizeNotificationHref("java\nscript:alert(1)").ok).toBe(false);
  });

  it("rejects off-origin and downgraded URLs (open redirect)", () => {
    expect(sanitizeNotificationHref("https://evil.example/phish").ok).toBe(false);
    expect(sanitizeNotificationHref("http://app.locateflow.com/x").ok).toBe(false);
    expect(sanitizeNotificationHref("mailto:a@b.com").ok).toBe(false);
  });

  it("rejects protocol-relative and backslash bypasses", () => {
    expect(sanitizeNotificationHref("//evil.example").ok).toBe(false);
    expect(sanitizeNotificationHref("/\\evil.example").ok).toBe(false);
    expect(sanitizeNotificationHref("\\\\evil.example").ok).toBe(false);
  });

  it("fails closed for absolute URLs when no app origin is configured", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(sanitizeNotificationHref("https://app.locateflow.com/settings").ok).toBe(false);
    // relative paths still allowed without an origin
    expect(sanitizeNotificationHref("/dashboard").ok).toBe(true);
  });

  it("isValidNotificationHref mirrors sanitize result", () => {
    expect(isValidNotificationHref("/ok")).toBe(true);
    expect(isValidNotificationHref("javascript:1")).toBe(false);
  });
});
