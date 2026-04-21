/** @type {import('next').NextConfig} */
const path = require("path");

const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  output: "standalone",
  transpilePackages: ["@locateflow/db", "@locateflow/shared"],
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
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
    // In development, Next.js HMR requires 'unsafe-eval' and 'unsafe-inline'
    // In production, remove 'unsafe-inline' to strengthen XSS protection
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self'";
    const connectSrc = isDev
      ? "connect-src 'self' ws: http: https: https://api.stripe.com"
      : "connect-src 'self' https://api.stripe.com";

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Images are non-executable so a broad `https:` source is the
      // conventional CSP baseline. This covers imgproxy (user-chosen
      // IMG_DOMAIN), R2 public CDN, and legacy Cloudinary URLs without
      // hard-coding hostnames into the CSP.
      "img-src 'self' data: blob: https:",
      connectSrc,
      "frame-src 'self' https://js.stripe.com",
      "worker-src 'self' blob:",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "X-Download-Options", value: "noopen" },
          { key: "Content-Security-Policy", value: csp },
        ],
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
