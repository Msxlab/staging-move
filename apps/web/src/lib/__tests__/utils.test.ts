import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, getInitials, slugify, truncate } from "../utils";

describe("formatCurrency", () => {
  it("should format positive numbers as USD", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("should format zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("should format negative numbers", () => {
    expect(formatCurrency(-50)).toBe("-$50.00");
  });

  it("should format large numbers with commas", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000.00");
  });

  it("should round to 2 decimal places", () => {
    expect(formatCurrency(9.999)).toBe("$10.00");
  });
});

describe("formatDate", () => {
  it("should format a Date object", () => {
    const date = new Date("2025-03-15T00:00:00");
    const result = formatDate(date);
    expect(result).toContain("Mar");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("should format a date string", () => {
    const result = formatDate("2024-12-25T12:00:00");
    expect(result).toContain("Dec");
    expect(result).toContain("25");
    expect(result).toContain("2024");
  });
});

describe("getInitials", () => {
  it("should return initials from first and last name", () => {
    expect(getInitials("John", "Doe")).toBe("JD");
  });

  it("should handle only first name", () => {
    expect(getInitials("Alice", null)).toBe("A");
  });

  it("should handle only last name", () => {
    expect(getInitials(null, "Smith")).toBe("S");
  });

  it("should return 'U' when both are null", () => {
    expect(getInitials(null, null)).toBe("U");
  });

  it("should return 'U' when both are empty strings", () => {
    expect(getInitials("", "")).toBe("U");
  });

  it("should uppercase the initials", () => {
    expect(getInitials("jane", "doe")).toBe("JD");
  });
});

describe("slugify", () => {
  it("should lowercase and replace spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("should remove special characters", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  it("should collapse multiple spaces", () => {
    expect(slugify("Hello   World")).toBe("hello-world");
  });

  it("should handle already-lowercase text", () => {
    expect(slugify("test slug")).toBe("test-slug");
  });

  it("should handle single word", () => {
    expect(slugify("hello")).toBe("hello");
  });
});

describe("truncate", () => {
  it("should not truncate short text", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("should truncate and add ellipsis", () => {
    expect(truncate("hello world this is long", 11)).toBe("hello world...");
  });

  it("should handle exact length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("should handle length of 0", () => {
    expect(truncate("hello", 0)).toBe("...");
  });
});
