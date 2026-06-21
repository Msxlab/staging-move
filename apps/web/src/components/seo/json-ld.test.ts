import { describe, expect, it } from "vitest";
import {
  collectionPageSchema,
  faqPageSchema,
  howToSchema,
  organizationSchema,
  softwareApplicationSchema,
  webSiteSchema,
} from "./json-ld";

const ctx = {
  siteUrl: "https://locateflow.com",
  siteName: "Move",
  logoUrl: "https://locateflow.com/logo.svg",
};

describe("JSON-LD schema builders", () => {
  it("does not emit SearchAction before a public site search exists", () => {
    const schema = webSiteSchema(ctx);

    expect(schema).not.toHaveProperty("potentialAction");
  });

  it("declares the site language as en-US only (no dangling es-US claim)", () => {
    // The marketing surface has no distinct /es/ alternate URLs, so the
    // sitewide WebSite node must not advertise Spanish pages that don't exist.
    const schema = webSiteSchema(ctx);

    expect(schema.inLanguage).toBe("en-US");
    expect(JSON.stringify(schema)).not.toContain("es-US");
  });

  it("leaves Organization.sameAs empty until real official URLs exist", () => {
    // Honest default: we never fabricate social profile URLs.
    const schema = organizationSchema(ctx);

    expect(schema.sameAs).toEqual([]);
  });

  it("omits offers unless a page passes visible, safe pricing data", () => {
    const schema = softwareApplicationSchema(ctx, {
      description: "Address and moving management.",
    });

    expect(schema).not.toHaveProperty("offers");
  });

  it("builds a CollectionPage tied to the site website + organization nodes", () => {
    const schema = collectionPageSchema(ctx, {
      url: "https://locateflow.com/blog/category/moving",
      name: "Moving",
      description: "Field-tested guides for surviving the move itself.",
    });

    expect(schema).toMatchObject({
      "@type": "CollectionPage",
      url: "https://locateflow.com/blog/category/moving",
      name: "Moving",
      isPartOf: { "@id": "https://locateflow.com#website" },
      publisher: { "@id": "https://locateflow.com#organization" },
    });
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

  it("builds HowTo schema with positioned steps from supplied visible content", () => {
    const schema = howToSchema({
      name: "How to set up Move",
      description: "Two real steps.",
      steps: [
        { name: "Add your addresses", text: "Start with the home you live in today." },
        { name: "Log every service", text: "Add the provider details you want to track.", url: "https://locateflow.com/how-it-works#step-02" },
      ],
    });

    expect(schema).toMatchObject({
      "@type": "HowTo",
      name: "How to set up Move",
      inLanguage: "en-US",
      step: [
        { "@type": "HowToStep", position: 1, name: "Add your addresses" },
        { "@type": "HowToStep", position: 2, name: "Log every service", url: "https://locateflow.com/how-it-works#step-02" },
      ],
    });
  });

  it("drops empty HowTo steps so the rich result never describes missing content", () => {
    const schema = howToSchema({
      name: "Sparse procedure",
      description: "One real step, one blank.",
      steps: [
        { name: "Real step", text: "Do the real thing." },
        { name: "  ", text: "" },
      ],
    });

    expect(schema.step).toHaveLength(1);
    expect(schema.step[0]).toMatchObject({ position: 1, name: "Real step" });
  });
});
