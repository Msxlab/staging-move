#!/usr/bin/env node

const baseUrl = new URL(process.argv[2] || "https://locateflow.com");
const expectedCanonical = (process.env.PUBLIC_SEO_CANONICAL_URL || "https://locateflow.com").replace(/\/+$/, "");

const failures = [];

function urlFor(path) {
  return new URL(path, baseUrl).toString();
}

function fail(message) {
  failures.push(message);
}

async function fetchText(path) {
  const url = urlFor(path);
  const response = await fetch(url, {
    headers: { "user-agent": "LocateFlowPublicSeoCheck/1.0" },
    redirect: "follow",
  });
  const text = await response.text();
  return { url, response, text };
}

function includesAny(value, needles) {
  return needles.filter((needle) => value.includes(needle));
}

function expectStatus(label, response, expected) {
  if (response.status !== expected) {
    fail(`${label}: expected ${expected}, got ${response.status}`);
  }
}

function expectContentType(label, response, expectedFragment) {
  const type = response.headers.get("content-type") || "";
  if (!type.toLowerCase().includes(expectedFragment)) {
    fail(`${label}: expected content-type containing ${expectedFragment}, got ${type || "(missing)"}`);
  }
}

function expectNoNoindexHeader(label, response) {
  const robotsTag = response.headers.get("x-robots-tag") || "";
  if (/\bnoindex\b/i.test(robotsTag)) {
    fail(`${label}: returned X-Robots-Tag containing noindex`);
  }
}

const forbiddenPublicIndexFragments = [
  "https://www.locateflow.com",
  "https://admin.locateflow.com",
  "ondigitalocean.app",
  "/dashboard",
  "/api/",
  "/auth/",
  "/sign-in",
  "/sign-up",
  "/account",
  "/settings",
  "/services",
  "/addresses",
  "/moving",
  "/budget",
  "/notifications",
  "/support",
  "/blog/preview",
];

try {
  const home = await fetchText("/");
  expectStatus("/", home.response, 200);
  expectContentType("/", home.response, "text/html");
  expectNoNoindexHeader("/", home.response);
  if (!/<title>[^<]+<\/title>/i.test(home.text)) fail("/: missing <title>");
  if (!/<h1(?:\s|>)/i.test(home.text)) fail("/: missing <h1>");
  if (!/<meta[^>]+name=["']description["'][^>]+content=["'][^"']+["'][^>]*>/i.test(home.text)) {
    fail("/: missing meta description");
  }
  if (!new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']${expectedCanonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?["'][^>]*>`, "i").test(home.text)) {
    fail(`/: missing canonical href for ${expectedCanonical}`);
  }
  if (!/<meta[^>]+property=["']og:title["'][^>]+content=["'][^"']+["'][^>]*>/i.test(home.text)) {
    fail("/: missing og:title");
  }
  if (!/<meta[^>]+name=["']twitter:card["'][^>]+content=["'][^"']+["'][^>]*>/i.test(home.text)) {
    fail("/: missing twitter:card");
  }
  if (!/<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(home.text)) {
    fail("/: missing application/ld+json");
  }

  const robots = await fetchText("/robots.txt");
  expectStatus("/robots.txt", robots.response, 200);
  expectContentType("/robots.txt", robots.response, "text/plain");
  expectNoNoindexHeader("/robots.txt", robots.response);
  if (!robots.text.includes(`Sitemap: ${expectedCanonical}/sitemap.xml`)) {
    fail(`/robots.txt: missing Sitemap: ${expectedCanonical}/sitemap.xml`);
  }

  const sitemap = await fetchText("/sitemap.xml");
  expectStatus("/sitemap.xml", sitemap.response, 200);
  expectContentType("/sitemap.xml", sitemap.response, "xml");
  expectNoNoindexHeader("/sitemap.xml", sitemap.response);
  const sitemapLeaks = includesAny(sitemap.text, forbiddenPublicIndexFragments);
  if (sitemapLeaks.length > 0) fail(`/sitemap.xml: forbidden fragments found: ${sitemapLeaks.join(", ")}`);

  const llms = await fetchText("/llms.txt");
  expectStatus("/llms.txt", llms.response, 200);
  expectContentType("/llms.txt", llms.response, "text/plain");
  expectNoNoindexHeader("/llms.txt", llms.response);
  if (!llms.text.startsWith("# LocateFlow")) fail("/llms.txt: does not start with # LocateFlow");
  if (llms.text.includes("# Not indexed")) fail("/llms.txt: returned noindex placeholder");
  const llmsLeaks = includesAny(llms.text, forbiddenPublicIndexFragments);
  if (llmsLeaks.length > 0) fail(`/llms.txt: forbidden fragments found: ${llmsLeaks.join(", ")}`);

  const llmsFull = await fetchText("/llms-full.txt");
  expectStatus("/llms-full.txt", llmsFull.response, 200);
  expectContentType("/llms-full.txt", llmsFull.response, "text/plain");
  expectNoNoindexHeader("/llms-full.txt", llmsFull.response);
  if (!llmsFull.text.startsWith("# LocateFlow")) fail("/llms-full.txt: does not start with # LocateFlow");
  if (llmsFull.text.includes("# Not indexed")) fail("/llms-full.txt: returned noindex placeholder");
  const llmsFullLeaks = includesAny(llmsFull.text, forbiddenPublicIndexFragments);
  if (llmsFullLeaks.length > 0) fail(`/llms-full.txt: forbidden fragments found: ${llmsFullLeaks.join(", ")}`);

  for (const feedPath of ["/blog/feed.xml", "/blog/atom.xml"]) {
    const feed = await fetchText(feedPath);
    expectStatus(feedPath, feed.response, 200);
    expectContentType(feedPath, feed.response, "xml");
    expectNoNoindexHeader(feedPath, feed.response);
    const feedLeaks = includesAny(feed.text, forbiddenPublicIndexFragments);
    if (feedLeaks.length > 0) fail(`${feedPath}: forbidden fragments found: ${feedLeaks.join(", ")}`);
    if (!feed.text.includes(expectedCanonical)) fail(`${feedPath}: missing canonical origin ${expectedCanonical}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

if (failures.length > 0) {
  console.error("Public SEO check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Public SEO check passed for ${baseUrl.origin}`);
