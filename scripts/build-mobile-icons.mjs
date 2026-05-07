// DEPRECATED — kept only as a redirect for muscle-memory invocations.
//
// The canonical brand-asset regeneration path is now:
//
//   node scripts/regenerate-brand-assets.mjs
//
// That script reads from the live Aurora SVG sources
//   - apps/mobile/assets/icon.svg
//   - apps/web/public/app-icon.svg
//   - apps/web/public/favicon.svg
// and writes every PNG, ICO, and Android launcher WEBP the apps need.
//
// The previous version of this file (Edition VI · Champagne & Rose) had
// hard-coded warm-palette hex values inline (`#B8936C`, `#E5C9A8`,
// `#F4E4D0`, `#EDB99D`, `#A85A42`, `#F5F1EA`) and depended on the
// pre-Aurora wordmark at `NEW GENERATION/assets/logo.svg`. Running it
// after the Aurora migration would have re-introduced the old palette
// into the binary mobile assets. To eliminate that risk, the original
// implementation has been removed entirely; this file now forwards to
// the canonical script so older invocations keep working but always
// produce Aurora output.
//
// Run:  node scripts/build-mobile-icons.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CANONICAL = join(__dirname, "regenerate-brand-assets.mjs");

console.warn(
  "[build-mobile-icons] DEPRECATED — forwarding to scripts/regenerate-brand-assets.mjs",
);

const result = spawnSync(process.execPath, [CANONICAL], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
