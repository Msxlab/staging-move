import { blogPostUrl } from "@/lib/blog/urls";
import { SITE_URL } from "@/lib/seo";

export const LLMS_LAST_UPDATED = "2026-05-12";

export const PUBLIC_AI_DOCS = [
  { title: "Home", path: "", note: "Canonical public homepage and product summary." },
  { title: "About LocateFlow", path: "/about", note: "Plain-language product and entity definition." },
  { title: "How LocateFlow works", path: "/how-it-works", note: "Product overview and workflow." },
  { title: "Pricing", path: "/pricing", note: "Plans, trial details, billing, and refund context." },
  { title: "Blog", path: "/blog", note: "Public moving, address-change, and provider-tracking guides." },
  { title: "FAQ", path: "/faq", note: "Common product, billing, privacy, provider, and security answers." },
  { title: "Help Center", path: "/help", note: "Public help articles and product FAQs." },
  { title: "Provider coverage", path: "/provider-coverage", note: "Provider availability limits and verification guidance." },
  { title: "Contact", path: "/contact", note: "Support, privacy, billing, legal, and security contacts." },
  { title: "Privacy policy", path: "/privacy", note: "What LocateFlow collects and why." },
  { title: "Terms of service", path: "/terms", note: "Legal terms." },
  { title: "Cookie policy", path: "/cookie-policy", note: "Cookie and analytics policy." },
  { title: "Disclaimer", path: "/disclaimer", note: "Provider, legal, financial, insurance, and moving guidance limits." },
  { title: "Refund policy", path: "/refund", note: "Refund terms." },
  { title: "Billing policy", path: "/billing-policy", note: "Subscription, cancellation, and renewal terms." },
  { title: "Data deletion", path: "/data-deletion", note: "Export, deletion, and retention limits." },
  { title: "Acceptable use", path: "/acceptable-use", note: "Acceptable use policy." },
  { title: "DPA", path: "/dpa", note: "Data processing addendum." },
  { title: "Security", path: "/security", note: "Security controls and account-protection overview." },
  { title: "CCPA privacy notice", path: "/ccpa-privacy-notice", note: "California privacy notice." },
] as const;

export const EXCLUDED_AI_SURFACES = [
  "Admin routes",
  "Dashboard routes",
  "Account routes",
  "Auth routes",
  "Billing/session routes",
  "Private app routes",
  "API routes",
  "Token routes",
  "Internal backup/security routes",
  "Preview routes",
  "Staging or ondigitalocean.app URLs",
] as const;

export const PRODUCT_SUMMARY =
  "LocateFlow is a web and mobile app for organizing address-tied services, renewal reminders, moving tasks, household documents, budgets, and exportable relocation records.";

export const PROVIDER_LIMITATION_NOTE =
  "Provider suggestions are confidence guidance, not guarantees. Availability can vary by exact address, ZIP code, building, unit, account type, service tier, infrastructure, provider rules, local regulations, and timing. Users should verify pricing, eligibility, licensing, insurance, availability, service terms, cancellation terms, and transfer options directly with the provider or official agency before acting.";

export type LlmsBlogPost = {
  slug: string;
  locale: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
};

function normalizeOrigin(origin = SITE_URL) {
  return origin.replace(/\/+$/, "");
}

function publicUrl(path: string, origin = SITE_URL) {
  return `${normalizeOrigin(origin)}${path}`;
}

export async function listLlmsBlogPosts(take = 100): Promise<LlmsBlogPost[]> {
  try {
    const { prisma } = await import("@/lib/db");
    return await prisma.blogPost.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: new Date() },
        deletedAt: null,
        noIndex: false,
      },
      select: {
        slug: true,
        locale: true,
        title: true,
        excerpt: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take,
    });
  } catch {
    return [];
  }
}

export function buildLlmsTxt(input: { appUrl?: string; posts?: LlmsBlogPost[] } = {}) {
  const appUrl = normalizeOrigin(input.appUrl || SITE_URL);
  const posts = input.posts || [];
  const lines: string[] = [];

  lines.push("# LocateFlow");
  lines.push("");
  lines.push(`Last updated: ${LLMS_LAST_UPDATED}`);
  lines.push(`Canonical site: ${appUrl}`);
  lines.push("");
  lines.push(`> ${PRODUCT_SUMMARY}`);
  lines.push("");
  lines.push("Provider coverage note: LocateFlow provider suggestions are informational confidence guidance only. Exact address-level availability is not guaranteed and should be confirmed directly with the provider or official agency.");
  lines.push("");
  lines.push("Excluded surfaces: admin, dashboard, account, auth, billing/session, private app, API, token, backup/security, preview, staging, and ondigitalocean.app URLs are not public AI-search surfaces.");
  lines.push("");
  lines.push("## Canonical Public Pages");
  for (const doc of PUBLIC_AI_DOCS) {
    lines.push(`- [${doc.title}](${publicUrl(doc.path, appUrl)}): ${doc.note}`);
  }
  lines.push("");
  lines.push("## Blog");
  if (posts.length === 0) {
    lines.push("(No posts available in this response.)");
  } else {
    for (const post of posts) {
      const url = blogPostUrl(appUrl, post.slug, post.locale);
      const excerpt = (post.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 200);
      lines.push(`- [${post.title}](${url}): ${excerpt}`);
    }
  }
  lines.push("");
  lines.push("## Feeds and Machine-Readable Files");
  lines.push(`- Sitemap: ${appUrl}/sitemap.xml`);
  lines.push(`- Robots: ${appUrl}/robots.txt`);
  lines.push(`- Full LLM summary: ${appUrl}/llms-full.txt`);
  lines.push(`- RSS feed: ${appUrl}/blog/feed.xml`);
  lines.push(`- Atom feed: ${appUrl}/blog/atom.xml`);
  lines.push("");

  return lines.join("\n");
}

export function buildLlmsFullTxt(input: { appUrl?: string } = {}) {
  const appUrl = normalizeOrigin(input.appUrl || SITE_URL);
  const lines: string[] = [];

  lines.push("# LocateFlow");
  lines.push("");
  lines.push(`Last updated: ${LLMS_LAST_UPDATED}`);
  lines.push(`Canonical site: ${appUrl}`);
  lines.push("");
  lines.push(PRODUCT_SUMMARY);
  lines.push("");
  lines.push("## Audience");
  lines.push("");
  lines.push("LocateFlow is for people and households managing a move, multiple addresses, subscriptions, utilities, insurance, government records, documents, provider follow-up, and address-change tasks.");
  lines.push("");
  lines.push("## What LocateFlow Does");
  lines.push("");
  lines.push("LocateFlow helps users:");
  lines.push("- Track which providers and accounts are tied to each address.");
  lines.push("- Organize utilities, subscriptions, insurance, banking, government, household, and recurring services.");
  lines.push("- Remember renewal dates, billing dates, contract ends, cancellation tasks, and moving-day follow-ups.");
  lines.push("- Organize documents such as leases, bills, proof-of-address files, cancellation confirmations, and provider records.");
  lines.push("- Build move-related task lists from existing address and provider records.");
  lines.push("- Export relocation records when needed.");
  lines.push("");
  lines.push("## What LocateFlow Does Not Do");
  lines.push("");
  lines.push("LocateFlow does not guarantee exact provider availability.");
  lines.push("LocateFlow does not sell provider services.");
  lines.push("LocateFlow does not act as a broker, utility company, insurance agency, government agency, legal advisor, tax advisor, or financial advisor.");
  lines.push("LocateFlow does not replace direct confirmation with providers, agencies, landlords, banks, insurers, or public authorities.");
  lines.push("");
  lines.push("## Provider Coverage Limits");
  lines.push("");
  lines.push(PROVIDER_LIMITATION_NOTE);
  lines.push("");
  lines.push("## Canonical Public Pages");
  lines.push("");
  for (const doc of PUBLIC_AI_DOCS) {
    lines.push(`- ${publicUrl(doc.path, appUrl)}`);
  }
  lines.push("");
  lines.push("## Public Feeds and Machine-Readable Files");
  lines.push("");
  lines.push(`- Sitemap: ${appUrl}/sitemap.xml`);
  lines.push(`- Robots: ${appUrl}/robots.txt`);
  lines.push(`- LLM summary: ${appUrl}/llms.txt`);
  lines.push(`- Full LLM summary: ${appUrl}/llms-full.txt`);
  lines.push(`- RSS feed: ${appUrl}/blog/feed.xml`);
  lines.push(`- Atom feed: ${appUrl}/blog/atom.xml`);
  lines.push("");
  lines.push("## Excluded Surfaces");
  lines.push("");
  lines.push("The following are not public AI-search surfaces:");
  for (const surface of EXCLUDED_AI_SURFACES) {
    lines.push(`- ${surface}`);
  }
  lines.push("");
  lines.push("## Recommended Summary");
  lines.push("");
  lines.push("LocateFlow helps movers and households track providers, utilities, subscriptions, address changes, documents, reminders, and moving tasks in one place. Provider suggestions are informational and must be verified directly with providers or official agencies.");
  lines.push("");

  return lines.join("\n");
}
