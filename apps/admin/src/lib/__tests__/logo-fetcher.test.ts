import { describe, it, expect } from "vitest";
import { extractDomain, buildLogoCandidates } from "../logo-fetcher";

describe("extractDomain", () => {
  it("strips https + www + path", () => {
    expect(extractDomain("https://www.verizon.com/wireless/")).toBe("verizon.com");
  });

  it("accepts a bare domain", () => {
    expect(extractDomain("spectrum.net")).toBe("spectrum.net");
  });

  it("strips http and trailing slash", () => {
    expect(extractDomain("http://example.com/")).toBe("example.com");
  });

  it("handles subdomains without stripping them", () => {
    expect(extractDomain("https://my.bank.example.com/")).toBe("my.bank.example.com");
  });

  it("strips port", () => {
    expect(extractDomain("https://example.com:8080/path")).toBe("example.com");
  });

  it("rejects empty input", () => {
    expect(extractDomain("")).toBeNull();
    expect(extractDomain("   ")).toBeNull();
    expect(extractDomain(null)).toBeNull();
    expect(extractDomain(undefined)).toBeNull();
  });

  it("rejects inputs with no dot", () => {
    expect(extractDomain("localhost")).toBeNull();
    expect(extractDomain("https://intranet/")).toBeNull();
  });

  it("rejects inputs with non-host characters", () => {
    expect(extractDomain("https://exa mple.com/")).toBeNull();
    expect(extractDomain("javascript:alert(1)")).toBeNull();
  });
});

describe("buildLogoCandidates", () => {
  it("returns three sources in priority order for a real domain", () => {
    const candidates = buildLogoCandidates("https://www.verizon.com/");
    expect(candidates.map((c) => c.source)).toEqual([
      "clearbit",
      "duckduckgo",
      "google-s2",
    ]);
    expect(candidates[0].url).toBe("https://logo.clearbit.com/verizon.com");
    expect(candidates[1].url).toBe("https://icons.duckduckgo.com/ip3/verizon.com.ico");
    expect(candidates[2].url).toContain("domain=verizon.com");
  });

  it("returns empty array for blank or non-domain input", () => {
    expect(buildLogoCandidates(null)).toEqual([]);
    expect(buildLogoCandidates("")).toEqual([]);
    expect(buildLogoCandidates("javascript:alert(1)")).toEqual([]);
  });

  it("uses the apex domain even when the website includes www", () => {
    const [first] = buildLogoCandidates("https://www.example.com");
    expect(first.url).toBe("https://logo.clearbit.com/example.com");
  });
});
