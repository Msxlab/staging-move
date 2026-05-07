// CANONICAL brand-asset regeneration — the only script that may write
// PNG / ICO / WEBP brand assets in this repo. Older entry points
// (notably `scripts/build-mobile-icons.mjs`) now delegate to this file
// so any path eventually flows through here.
//
// Run from the repo root:  node scripts/regenerate-brand-assets.mjs
//
// Sources consumed (all already on the Aurora cool/violet palette):
//   - apps/mobile/assets/icon.svg          1024x1024 full mark on Aurora navy
//   - apps/web/public/app-icon.svg          512x512  full mark on Aurora navy
//   - apps/web/public/favicon.svg           100x100  flat tile, used for ICO
//
// Targets:
//   - apps/mobile/assets/{icon,adaptive-icon,splash-icon,favicon,notification-icon}.png
//   - apps/web/public/icons/{icon-192,icon-512}.png
//   - apps/web/public/favicon.ico  (multi-size 16/32/48 PNG container)
//   - apps/mobile/android/app/src/main/res/mipmap-*/ic_launcher{,_round,_foreground}.webp
//
// Geometry: matches the original logo path in icon.svg verbatim (M20 65 Q…).
// Two derived SVGs are constructed inline:
//   - foreground-only  (transparent bg, mark centred in 66% safe zone) — for
//     Android adaptive-icon foreground + adaptive-icon.png.
//   - notification     (transparent bg, full white silhouette) — Android tints
//     it via res/values/colors.xml's notification_icon_color.
import sharp from "sharp";
import { readFileSync, writeFileSync, statSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const MOBILE_ASSETS = join(ROOT, "apps", "mobile", "assets");
const WEB_ICONS = join(ROOT, "apps", "web", "public", "icons");
const WEB_PUBLIC = join(ROOT, "apps", "web", "public");
const ANDROID_RES = join(
  ROOT, "apps", "mobile", "android", "app", "src", "main", "res",
);

const ICON_SVG = readFileSync(join(MOBILE_ASSETS, "icon.svg"), "utf8");
const APP_ICON_SVG = readFileSync(join(WEB_PUBLIC, "app-icon.svg"), "utf8");
const FAVICON_SVG = readFileSync(join(WEB_PUBLIC, "favicon.svg"), "utf8");

// ─────────────────────────────────────────────────────────────────────
// Derived SVGs (built from the Aurora source — no inline brand colors).
// ─────────────────────────────────────────────────────────────────────

// Foreground-only mark for Android adaptive icon. The mark must sit inside
// the inner 66% "safe zone" because launcher masks (circle, squircle, …)
// can crop the outer 34%. Geometry stays identical to icon.svg's logo
// glyph; only the rect background and glow are removed and the mark is
// re-centred and slightly down-scaled to fit the safe zone.
const FOREGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none">
  <defs>
    <linearGradient id="ai-foil" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#5C9DDC"/>
      <stop offset="45%" stop-color="#7FB6E8"/>
      <stop offset="100%" stop-color="#DDE7F5"/>
    </linearGradient>
    <linearGradient id="ai-rose" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#A5C9F0"/>
      <stop offset="100%" stop-color="#5C9DDC"/>
    </linearGradient>
  </defs>
  <g transform="translate(212,212) scale(6)">
    <path d="M20 65 Q 30 32, 50 48 T 80 40" stroke="url(#ai-foil)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="20" cy="65" r="5.5" fill="url(#ai-foil)"/>
    <circle cx="80" cy="40" r="9" fill="url(#ai-rose)"/>
    <circle cx="80" cy="40" r="3" fill="#ECF1F8"/>
  </g>
</svg>`;

// White silhouette for Android status-bar notifications. The OS tints
// every non-transparent pixel using `notification_icon_color` (currently
// #7FB6E8 — Aurora cool — defined in res/values/colors.xml). Stroke and
// dot radii are heavier so the glyph stays readable at status-bar size.
const NOTIFICATION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" fill="none">
  <g transform="translate(38,38) scale(1.16)">
    <path d="M20 65 Q 30 32, 50 48 T 80 40" stroke="#FFFFFF" stroke-width="9" fill="none" stroke-linecap="round"/>
    <circle cx="20" cy="65" r="9" fill="#FFFFFF"/>
    <circle cx="80" cy="40" r="13" fill="#FFFFFF"/>
  </g>
</svg>`;

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

async function svgToPngBuffer(svgString, { width, height }) {
  return sharp(Buffer.from(svgString), { density: 384 })
    .resize({
      width,
      height,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function svgToWebpBuffer(svgString, { width, height }) {
  return sharp(Buffer.from(svgString), { density: 384 })
    .resize({
      width,
      height,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 92 })
    .toBuffer();
}

// Build a multi-image ICO from raw PNG buffers. ICO header is 6 bytes,
// then each directory entry is 16 bytes, then the PNG payloads follow.
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // type 1 = .ico
  header.writeUInt16LE(count, 4); // image count

  const entries = Buffer.alloc(16 * count);
  const payloads = [];
  let offset = 6 + 16 * count;

  for (let i = 0; i < count; i++) {
    const { png, width, height } = pngBuffers[i];
    const e = entries;
    const base = i * 16;
    e[base + 0] = width >= 256 ? 0 : width;   // 0 means 256
    e[base + 1] = height >= 256 ? 0 : height;
    e[base + 2] = 0;                            // palette count
    e[base + 3] = 0;                            // reserved
    e.writeUInt16LE(1, base + 4);               // color planes
    e.writeUInt16LE(32, base + 6);              // bits per pixel
    e.writeUInt32LE(png.length, base + 8);      // size in bytes
    e.writeUInt32LE(offset, base + 12);         // offset
    offsetAdd(payloads, png);
    offset += png.length;
  }
  return Buffer.concat([header, entries, ...payloads]);
}

function offsetAdd(arr, buf) {
  arr.push(buf);
}

function logResult(label, fullPath) {
  const size = statSync(fullPath).size;
  const rel = fullPath.replace(ROOT + "\\", "").replace(ROOT + "/", "").replace(/\\/g, "/");
  console.log(`  ${rel.padEnd(64)} ${(size / 1024).toFixed(1)} KB`);
}

async function writePng(targetPath, svg, { width, height }) {
  const buf = await svgToPngBuffer(svg, { width, height });
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, buf);
  logResult(targetPath, targetPath);
}

async function writeWebp(targetPath, svg, { width, height }) {
  const buf = await svgToWebpBuffer(svg, { width, height });
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, buf);
  logResult(targetPath, targetPath);
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n[1/4] Mobile PNG assets");
  await writePng(join(MOBILE_ASSETS, "icon.png"), ICON_SVG, { width: 1024, height: 1024 });
  await writePng(join(MOBILE_ASSETS, "adaptive-icon.png"), FOREGROUND_SVG, { width: 1024, height: 1024 });
  await writePng(join(MOBILE_ASSETS, "splash-icon.png"), ICON_SVG, { width: 1024, height: 1024 });
  await writePng(join(MOBILE_ASSETS, "favicon.png"), ICON_SVG, { width: 256, height: 256 });
  await writePng(join(MOBILE_ASSETS, "notification-icon.png"), NOTIFICATION_SVG, { width: 192, height: 192 });

  console.log("\n[2/4] Web PWA PNG icons");
  await writePng(join(WEB_ICONS, "icon-192.png"), APP_ICON_SVG, { width: 192, height: 192 });
  await writePng(join(WEB_ICONS, "icon-512.png"), APP_ICON_SVG, { width: 512, height: 512 });

  console.log("\n[3/4] Web favicon.ico (multi-size 16/32/48 container)");
  const ico16 = await svgToPngBuffer(FAVICON_SVG, { width: 16, height: 16 });
  const ico32 = await svgToPngBuffer(FAVICON_SVG, { width: 32, height: 32 });
  const ico48 = await svgToPngBuffer(FAVICON_SVG, { width: 48, height: 48 });
  const icoBuf = buildIco([
    { png: ico16, width: 16, height: 16 },
    { png: ico32, width: 32, height: 32 },
    { png: ico48, width: 48, height: 48 },
  ]);
  const icoPath = join(WEB_PUBLIC, "favicon.ico");
  writeFileSync(icoPath, icoBuf);
  logResult("favicon.ico", icoPath);

  console.log("\n[4/4] Android launcher WEBPs");
  // Standard adaptive-icon densities. Each density needs three drawables:
  //   ic_launcher.webp          — legacy square icon, full mark + bg
  //   ic_launcher_round.webp    — legacy round icon, full mark + bg
  //   ic_launcher_foreground    — adaptive-icon foreground, mark only on transparent
  const launcherSizes = {
    mdpi:    { square: 48,  foreground: 108 },
    hdpi:    { square: 72,  foreground: 162 },
    xhdpi:   { square: 96,  foreground: 216 },
    xxhdpi:  { square: 144, foreground: 324 },
    xxxhdpi: { square: 192, foreground: 432 },
  };

  for (const [density, sizes] of Object.entries(launcherSizes)) {
    const dir = join(ANDROID_RES, `mipmap-${density}`);
    await writeWebp(join(dir, "ic_launcher.webp"), ICON_SVG, {
      width: sizes.square, height: sizes.square,
    });
    await writeWebp(join(dir, "ic_launcher_round.webp"), ICON_SVG, {
      width: sizes.square, height: sizes.square,
    });
    await writeWebp(join(dir, "ic_launcher_foreground.webp"), FOREGROUND_SVG, {
      width: sizes.foreground, height: sizes.foreground,
    });
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
