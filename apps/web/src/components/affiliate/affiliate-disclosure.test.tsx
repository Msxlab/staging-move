import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => ({
  Sparkles: (props: any) => <svg aria-hidden="true" {...props} />,
}));

import {
  AffiliateDisclosure,
  AFFILIATE_DISCLOSURE_SHORT,
  AFFILIATE_DISCLOSURE_LONG,
} from "./affiliate-disclosure";
import { AffiliateCtaButton } from "./affiliate-cta-button";

describe("affiliate FTC disclosure", () => {
  it("renders the conspicuous material-connection + ranking-integrity copy", () => {
    const html = renderToStaticMarkup(<AffiliateDisclosure />);
    expect(html).toContain("may earn a commission");
    expect(html).toContain("at no extra cost to you");
    // Ranking-integrity promise (docs/ai/free-pivot/19 §7).
    expect(html).toContain("never affects our rankings");
    expect(html).toContain(AFFILIATE_DISCLOSURE_LONG);
  });

  it("puts the short disclosure on every CTA as an adjacent tooltip", () => {
    const html = renderToStaticMarkup(
      <AffiliateCtaButton providerId="p1" source="provider_detail" />,
    );
    expect(html).toContain(`title="${AFFILIATE_DISCLOSURE_SHORT}"`);
    expect(html).toContain("may earn a commission");
  });
});
