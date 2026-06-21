import type { ReactElement } from "react";
import { JsonLd, organizationSchema, webSiteSchema } from "./json-ld";
import { SITE_URL } from "@/lib/seo";

/**
 * Sitewide JSON-LD block injected from the root layout.
 *
 * `Organization` + `WebSite` together give crawlers enough signal to
 * resolve the brand entity. SearchAction is intentionally omitted until
 * a public site-search route exists.
 */

const LOGO_PATH = "/logo.svg";

export function SiteSchemas(): ReactElement {
  const ctx = {
    siteUrl: SITE_URL,
    siteName: "Move",
    logoUrl: `${SITE_URL}${LOGO_PATH}`,
  };
  return (
    <>
      <JsonLd id="ld-organization" data={organizationSchema(ctx)} />
      <JsonLd id="ld-website" data={webSiteSchema(ctx)} />
    </>
  );
}
