import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => {
  const Icon = (props: any) => <svg aria-hidden="true" {...props} />;
  return { Truck: Icon, Check: Icon, Loader2: Icon };
});
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

import { MovingQuoteForm } from "./moving-quote-form";

describe("MovingQuoteForm", () => {
  it("renders the quote fields, a required consent checkbox, and the legal links", () => {
    const html = renderToStaticMarkup(<MovingQuoteForm toState="TX" toZip="78701" fromState="CA" />);

    expect(html).toContain("Get up to 4 moving quotes");
    expect(html).toContain("never charged");
    // Core capture fields.
    expect(html).toContain('aria-label="Your name"');
    expect(html).toContain('aria-label="Move date"');
    expect(html).toContain('aria-label="To ZIP"');
    expect(html).toContain('type="checkbox"');
    // Consent links to the policies that govern lead sharing.
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    // Destination ZIP is prefilled from the plan.
    expect(html).toContain('value="78701"');
    // The submit button is disabled until consent is given (initial state).
    expect(html).toContain("Get quotes");
    expect(html).toMatch(/disabled[=>]/);
  });
});
