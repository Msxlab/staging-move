import { describe, expect, it } from "vitest";

import {
  buildLlmsTxt,
  buildLlmsFullTxt,
  FREE_PRICING_NOTE,
} from "./public-ai-discovery";

describe("public AI discovery — CONSUMER_FREE pricing note", () => {
  it("buildLlmsTxt: default (flag off) keeps the paid-plan pricing note", () => {
    const out = buildLlmsTxt({ appUrl: "https://example.com", posts: [] });
    expect(out).toContain("Plans, trial details, billing, and refund context.");
    expect(out).not.toContain(FREE_PRICING_NOTE);
  });

  it("buildLlmsTxt: consumerFree swaps the Pricing note and adds the free summary line", () => {
    const out = buildLlmsTxt({ appUrl: "https://example.com", posts: [], consumerFree: true });
    expect(out).toContain(FREE_PRICING_NOTE);
    // The /pricing canonical-page note is replaced, not duplicated alongside the paid one.
    expect(out).not.toContain("Plans, trial details, billing, and refund context.");
    // Free note appears as a blockquote summary AND on the Pricing page line.
    expect(out.match(new RegExp(FREE_PRICING_NOTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [])
      .toHaveLength(2);
  });

  it("buildLlmsFullTxt: consumerFree adds a Pricing section; default omits it", () => {
    const free = buildLlmsFullTxt({ appUrl: "https://example.com", consumerFree: true });
    expect(free).toContain("## Pricing");
    expect(free).toContain(FREE_PRICING_NOTE);

    const paid = buildLlmsFullTxt({ appUrl: "https://example.com" });
    expect(paid).not.toContain("## Pricing");
    expect(paid).not.toContain(FREE_PRICING_NOTE);
  });
});
