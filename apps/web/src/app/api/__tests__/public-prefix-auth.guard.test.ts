import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";

/**
 * Regression backstop for `security-surface-02` / roadmap 2.8.
 *
 * `/api/internal/*`, `/api/cron/*`, and `/api/webhooks/*` are PUBLIC-by-omission
 * in `middleware.ts` (the middleware returns null / no session gate for these
 * prefixes — see `PUBLIC_API_PREFIXES` and the early `startsWith` returns). That
 * means EVERY route file under them must authenticate ITSELF; a new route added
 * without its guard would silently become fully public (fail-open).
 *
 * This test enumerates every `route.ts` under those prefixes and asserts each
 * references at least one recognized guard mechanism. It is intentionally a
 * cheap source-level structural check (not a runtime test): its job is to FAIL
 * the build the moment someone adds a route under these prefixes without wiring
 * a guard, so the omission is caught in review instead of in production.
 *
 * If a route legitimately needs a new guard helper, add that helper's identifier
 * to the prefix's allowlist below (and make sure it really authenticates).
 */

const API_ROOT = join(process.cwd(), "src/app/api");

// Recognized self-authentication mechanisms, per public prefix.
const PREFIX_GUARDS: Record<string, string[]> = {
  // cron jobs: the shared CRON_SECRET guard (or a direct CRON_SECRET check).
  cron: ["guardCronRequest", "CRON_SECRET"],
  // internal service-to-service: internal shared-secret / cron-secret auth.
  internal: [
    "verifyInternalAuth",
    "verifyInternalWebhookSecret",
    "INTERNAL_WEBHOOK_SECRET",
    "guardCronRequest",
    "CRON_SECRET",
  ],
  // external webhooks: cryptographic signature verification (no shared header).
  webhooks: [
    "verifyAppleJws", // Apple App Store Server Notifications (AppleRootCA-G3 JWS)
    "verifyResendSignature", // Resend (svix) signature
    "constructEvent", // Stripe signature verification
    "verifyPubsubOidcToken", // Google Play RTDN via Pub/Sub push OIDC bearer token
    "verifyInternalWebhookSecret",
  ],
};

function routeFilesUnder(dir: string): string[] {
  const out: string[] = [];
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
  } catch {
    return out; // prefix dir absent — nothing to assert
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFilesUnder(full));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

describe("public-by-prefix API routes self-authenticate (fail-open backstop)", () => {
  for (const [prefix, guards] of Object.entries(PREFIX_GUARDS)) {
    const files = routeFilesUnder(join(API_ROOT, prefix));

    it(`/api/${prefix} has at least one route to check`, () => {
      expect(files.length).toBeGreaterThan(0);
    });

    for (const file of files) {
      const rel = file.slice(API_ROOT.length + 1).replace(/\\/g, "/");
      it(`${rel} references a recognized guard`, () => {
        const src = readFileSync(file, "utf8");
        const matched = guards.find((g) => src.includes(g)) ?? null;
        expect(
          matched,
          `${rel} is public-by-prefix (/api/${prefix}/*) but references none of the recognized guards: ${guards.join(
            ", ",
          )}. Either wire a guard, or add its identifier to PREFIX_GUARDS.${prefix} if it is a new, real auth mechanism.`,
        ).not.toBeNull();
      });
    }
  }
});
