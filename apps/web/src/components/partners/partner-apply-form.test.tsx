import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => {
  const Icon = (props: any) => <svg aria-hidden="true" {...props} />;
  return { Check: Icon, Loader2: Icon };
});

import { PartnerApplyForm } from "./partner-apply-form";

describe("PartnerApplyForm", () => {
  it("renders the company/contact fields, category options, and two required gates", () => {
    const html = renderToStaticMarkup(<PartnerApplyForm />);
    expect(html).toContain('aria-label="Company name"');
    expect(html).toContain('aria-label="Contact email"');
    expect(html).toContain('aria-label="Service states"');
    expect(html).toContain("Cleaning");
    expect(html).toContain("Junk removal");
    // Attestation + lead-sharing consent, both required (submit disabled initially).
    expect(html).toContain('aria-label="Attestation"');
    expect(html).toContain('aria-label="Consent to receive leads"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toMatch(/disabled[=>]/);
  });
});
