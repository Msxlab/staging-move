/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  transpilePackages: ["@locateflow/db", "@locateflow/shared"],
  // SEC-007: Security headers for admin panel.
  // Note: Content-Security-Policy is emitted per-request from
  // apps/admin/src/middleware.ts (nonce-based) so it is NOT set here.
  // Keeping a static CSP alongside the dynamic one creates conflicts
  // where browsers take the intersection and reject the nonce — exactly
  // the weakening we're trying to remove.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "X-Download-Options", value: "noopen" },
        ],
      },
    ];
  },
};

// next-intl plugin — admin i18n request config at src/i18n/request.ts.
const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

module.exports = withNextIntl(nextConfig);
