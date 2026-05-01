import { describe, expect, it } from "vitest";
import { faqPageSchema, softwareApplicationSchema, webSiteSchema } from "./json-ld";

const ctx = {
  siteUrl: "https://locateflow.com",
  siteName: "LocateFlow",
  logoUrl: "https://locateflow.com/logo.svg",
};

describe("JSON-LD schema builders", () => {
  it("does not emit SearchAction before a public site search exists", () => {
    const schema = webSiteSchema(ctx);

    expect(schema).not.toHaveProperty("potentialAction");
  });

  it("omits offers unless a page passes visible, safe pricing data", () => {
    const schema = softwareApplicationSchema(ctx, {
      description: "Address and moving management.",
    });

    expect(schema).not.toHaveProperty("offers");
  });

  it("builds FAQPage schema only from supplied visible FAQ content", () => {
    const schema = faqPageSchema([
      { question: "Can I export my data?", answer: "Yes, from settings." },
    ]);

    expect(schema).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Can I export my data?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, from settings.",
          },
        },
      ],
    });
  });
});
