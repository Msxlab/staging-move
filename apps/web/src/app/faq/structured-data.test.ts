import { describe, expect, it } from "vitest";
import { faqSchemaItems } from "./faq-data";
import { faqGroups } from "./faq-content";
import { faqStructuredData } from "./structured-data";

function schemaType(data: Record<string, unknown>) {
  return data["@type"];
}

describe("FAQ structured data", () => {
  it("emits exactly one FAQPage and one BreadcrumbList schema block", () => {
    const schemas = faqStructuredData();

    expect(schemas.filter((schema) => schemaType(schema.data) === "FAQPage")).toHaveLength(1);
    expect(schemas.filter((schema) => schemaType(schema.data) === "BreadcrumbList")).toHaveLength(1);
    expect(new Set(schemas.map((schema) => schema.id))).toHaveLength(schemas.length);
  });

  it("keeps FAQPage mainEntity valid and sourced from visible FAQ content", () => {
    const [{ data }] = faqStructuredData();
    const visibleItems = faqSchemaItems();
    const renderedQuestions = faqGroups.flatMap((group) => group.items.map((item) => item.q));
    const mainEntity = (data as { mainEntity: unknown }).mainEntity;

    expect(data["@type"]).toBe("FAQPage");
    expect(Array.isArray(mainEntity)).toBe(true);
    expect(mainEntity).toHaveLength(visibleItems.length);
    expect(visibleItems.map((item) => item.question)).toEqual(renderedQuestions);
    for (const [index, entity] of (mainEntity as Array<Record<string, unknown>>).entries()) {
      expect(entity["@type"]).toBe("Question");
      expect(entity.name).toBe(visibleItems[index].question);
      expect(typeof entity.name).toBe("string");
      expect(entity.name).not.toBe("");

      const acceptedAnswer = entity.acceptedAnswer as Record<string, unknown>;
      expect(acceptedAnswer["@type"]).toBe("Answer");
      expect(acceptedAnswer.text).toBe(visibleItems[index].answer);
      expect(typeof acceptedAnswer.text).toBe("string");
      expect(acceptedAnswer.text).not.toBe("");
    }
  });

  it("serializes a single FAQPage marker and a single BreadcrumbList marker", () => {
    const rawHtml = faqStructuredData()
      .map(
        (schema) =>
          `<script type="application/ld+json" id="${schema.id}">${JSON.stringify(schema.data)}</script>`,
      )
      .join("");

    expect(rawHtml.match(/"@type":"FAQPage"/g)).toHaveLength(1);
    expect(rawHtml.match(/"@type":"BreadcrumbList"/g)).toHaveLength(1);
    expect(rawHtml.match(/id="ld-faq"/g)).toHaveLength(1);
    expect(rawHtml.match(/id="ld-faq-breadcrumb"/g)).toHaveLength(1);
  });
});
