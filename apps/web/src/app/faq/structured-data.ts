import { faqSchemaItems } from "./faq-data";

const DEFAULT_SITE_URL = "https://locateflow.com";
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

function normalizeSiteUrl(siteUrl: string) {
  try {
    const url = new URL(siteUrl);
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

function absoluteUrl(path: string, siteUrl: string) {
  try {
    return new URL(path).toString();
  } catch {
    return new URL(path, siteUrl).toString();
  }
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .split(LS)
    .join("\\u2028")
    .split(PS)
    .join("\\u2029");
}

export function faqStructuredData(siteUrl = DEFAULT_SITE_URL) {
  const canonicalSiteUrl = normalizeSiteUrl(siteUrl);

  return [
    {
      id: "ld-faq",
      data: {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqSchemaItems().map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    },
    {
      id: "ld-faq-breadcrumb",
      data: {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: canonicalSiteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "FAQ",
            item: absoluteUrl("/faq", canonicalSiteUrl),
          },
        ],
      },
    },
  ];
}
