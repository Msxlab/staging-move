/** @type {import('next').NextConfig} */
const path = require("path");

const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  output: "standalone",
  transpilePackages: ["@locateflow/db", "@locateflow/shared"],
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  turbopack: {
    root: path.resolve(__dirname, "../.."),
    resolveAlias: {
      "@locateflow/db": path.resolve(__dirname, "../../packages/db/src/index.ts"),
      "@locateflow/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@locateflow/shared/recommendation-engine": path.resolve(__dirname, "../../packages/shared/src/recommendation-engine.ts"),
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
  async headers() {
    // In development, Next.js HMR requires 'unsafe-eval' and 'unsafe-inline'
    // In production, remove 'unsafe-inline' to strengthen XSS protection
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev"
      : "script-src 'self' https://*.clerk.accounts.dev";

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.accounts.dev",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://res.cloudinary.com https://img.clerk.com https://*.clerk.accounts.dev",
      "connect-src 'self' https://*.clerk.dev https://*.clerk.accounts.dev https://clerk-telemetry.com https://api.stripe.com",
      "frame-src 'self' https://*.clerk.dev https://*.clerk.accounts.dev https://js.stripe.com",
      "worker-src 'self' blob:",
    ].join("; ");

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
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

module.exports = withBundleAnalyzer(nextConfig);
