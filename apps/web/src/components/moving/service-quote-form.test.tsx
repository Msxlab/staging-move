import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => {
  const Icon = (props: any) => <svg aria-hidden="true" {...props} />;
  return { Sparkles: Icon, Check: Icon, Loader2: Icon };
});
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

import { ServiceQuoteForm } from "./service-quote-form";

describe("ServiceQuoteForm", () => {
  it("renders the cleaning/junk category picker, fields, required consent, and prefilled ZIP", () => {
    const html = renderToStaticMarkup(<ServiceQuoteForm toState="TX" toZip="78701" />);
    expect(html).toContain("Get settle-in service quotes");
    expect(html).toContain("Cleaning");
    expect(html).toContain("Junk removal");
    expect(html).toContain('aria-label="Your name"');
    expect(html).toContain('aria-label="Preferred date"');
    expect(html).toContain('value="78701"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('href="/privacy"');
    expect(html).toMatch(/disabled[=>]/);
  });
});
