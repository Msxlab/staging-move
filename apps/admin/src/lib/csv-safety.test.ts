import { describe, expect, it } from "vitest";
import { buildCsv, csvField, csvRow } from "@/lib/csv-safety";

describe("csvField", () => {
  it("returns plain text unchanged", () => {
    expect(csvField("hello")).toBe("hello");
  });

  it("neutralizes formula-trigger characters", () => {
    expect(csvField("=cmd|' /C calc'!A1")).toBe("'=cmd|' /C calc'!A1");
    expect(csvField("+1+1")).toBe("'+1+1");
    expect(csvField("-2*3")).toBe("'-2*3");
    expect(csvField("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
  });

  it("does not double-quote benign leading characters", () => {
    expect(csvField("Alice")).toBe("Alice");
    expect(csvField("!important")).toBe("!important");
  });

  it("quotes commas, quotes, and newlines", () => {
    expect(csvField('Smith, John')).toBe('"Smith, John"');
    expect(csvField('"hi"')).toBe('""hi""'.length === 6 ? '"""hi"""' : '"""hi"""');
    expect(csvField("a\nb")).toBe('"a\nb"');
  });

  it("returns empty string for null/undefined", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("converts non-string values to string", () => {
    expect(csvField(42)).toBe("42");
    expect(csvField(true)).toBe("true");
  });
});

describe("csvRow", () => {
  it("joins fields with commas", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("escapes formula-trigger fields per cell", () => {
    expect(csvRow(["safe", "=evil()"])).toBe("safe,'=evil()");
  });
});

describe("buildCsv", () => {
  it("builds a CSV with CRLF line endings", () => {
    const csv = buildCsv(["name", "email"], [["Alice", "a@example.com"], ["Bob", "b@example.com"]]);
    expect(csv).toBe("name,email\r\nAlice,a@example.com\r\nBob,b@example.com");
  });

  it("escapes formula values in any column", () => {
    const csv = buildCsv(["id", "value"], [["1", "=A1+B1"]]);
    expect(csv).toContain("'=A1+B1");
  });
});
