import type { ReactElement } from "react";
import { JsonLd, organizationSchema, webSiteSchema } from "./json-ld";

/**
 * Sitewide JSON-LD block injected from the root layout.
 *
 * `Organization` + `WebSite` together give Google enough signal to
 * resolve the brand entity (knowledge panel) and to render the
 * sitelinks search box on SERP. Keeping them in one component means
 * adding a third schema (e.g. AggregateRating once we have reviews)
 * is one edit.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://locateflow.app").replace(/\/+$/, "");
const LOGO_PATH = "/logo.svg";

export function SiteSchemas(): ReactElement {
  const ctx = {
    siteUrl: SITE_URL,
    siteName: "LocateFlow",
    logoUrl: `${SITE_URL}${LOGO_PATH}`,
  };
  return (
    <>
      <JsonLd id="ld-organization" data={organizationSchema(ctx)} />
      <JsonLd id="ld-website" data={webSiteSchema(ctx)} />
    </>
  );
}
