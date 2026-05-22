/** @type {import('next').NextConfig} */
const path = require("path");

const appEnv = (process.env.APP_ENV || "").toLowerCase();
const appUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "";
const isStagingLike =
  appEnv === "staging" ||
  appEnv === "preview" ||
  /(?:staging|preview|ondigitalocean\.app|vercel\.app)/i.test(appUrl);

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: ["@locateflow/db", "@locateflow/shared"],
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      react: path.resolve(__dirname, "../../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
    };
    return config;
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  images: {
    // imgproxy is the canonical public image host (signed URLs). Its
    // exact hostname is operator-configured via NEXT_PUBLIC_IMGPROXY_URL,
    // so we append it dynamically below.
    // *.r2.dev is the optional public-object pattern when the R2 bucket
    // is marked public for low-cardinality assets.
    // `res.cloudinary.com` is kept for any historical URLs in the DB.
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      ...((() => {
        try {
          const u = process.env.NEXT_PUBLIC_IMGPROXY_URL;
          if (!u) return [];
          const parsed = new URL(u);
          return [{ protocol: parsed.protocol.replace(":", ""), hostname: parsed.hostname }];
        } catch {
          return [];
        }
      })()),
    ],
  },
  async headers() {
    // Content-Security-Policy is emitted per-request from
    // apps/web/src/middleware.ts (nonce + 'strict-dynamic') so it is
    // intentionally NOT set here. Setting a static CSP alongside the
    // dynamic one creates conflicts where browsers take the
    // intersection and reject the nonce — exactly the weakening this
    // migration removes.
    const headers = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      { key: "X-Download-Options", value: "noopen" },
    ];
    if (isStagingLike) {
      headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
    }

    return [
      {
        source: "/sw.js",
        headers: [
          ...headers,
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
        ],
      },
      {
        source: "/register-sw.js",
        headers: [
          ...headers,
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
        ],
      },
      {
        source: "/(.*)",
        headers,
      },
    ];
  },
};

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

// next-intl plugin — points at the per-request config in src/i18n/request.ts.
// Cookie-based locale selection; no URL rewriting.
const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

module.exports = withNextIntl(withBundleAnalyzer(nextConfig));
