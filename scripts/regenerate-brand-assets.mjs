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
//   - apps/mobile/android/app/src/main/res/drawable-*/splashscreen_logo.png
//
// Identity: the box-raccoon mascot tile (Edition VII). Two derived SVGs are
// constructed inline:
//   - foreground-only  (transparent bg, mascot centred in 66% safe zone) — for
//     Android adaptive-icon foreground + adaptive-icon.png.
//   - notification     (transparent bg, white squiggle silhouette) — Android
//     tints it via res/values/colors.xml's notification_icon_color. The
//     squiggle stays here on purpose: the mascot has no readable white
//     silhouette at status-bar size.
//
// NOTE: apps/admin favicon (src/app/icon.svg + public/favicon.svg) is SVG-only
// and maintained by hand — not a raster target of this script.
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
// can crop the outer 34%. Art is the box-raccoon mascot (Edition VII
// identity — raccoon peeking over a moving box); the tile background and
// glow are dropped and the 100-unit art is centred in the safe zone.
const FOREGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none">
  <defs>
    <linearGradient id="fg-mask" x1="22" y1="44" x2="78" y2="26" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#56A8F0"/>
      <stop offset="100%" stop-color="#9CCBF2"/>
    </linearGradient>
    <linearGradient id="fg-fur" x1="50" y1="6" x2="50" y2="56" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#D9E2EE"/>
      <stop offset="100%" stop-color="#9DAAC0"/>
    </linearGradient>
    <linearGradient id="fg-box" x1="26" y1="56" x2="74" y2="92" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8FC0EE"/>
      <stop offset="100%" stop-color="#5C9DDC"/>
    </linearGradient>
  </defs>
  <g transform="translate(262,247) scale(5)">
    <path d="M33 24 Q24 4 43 16 Q40 22 33 24 Z" fill="url(#fg-fur)"/>
    <path d="M67 24 Q76 4 57 16 Q60 22 67 24 Z" fill="url(#fg-fur)"/>
    <path d="M35 21 Q29 9 42 16 Q39 19 35 21 Z" fill="#6B788E"/>
    <path d="M65 21 Q71 9 58 16 Q61 19 65 21 Z" fill="#6B788E"/>
    <path d="M50 13 C33 13 27 27 27 39 C27 52 38 60 50 60 C62 60 73 52 73 39 C73 27 67 13 50 13 Z" fill="url(#fg-fur)"/>
    <path d="M50 18 Q45 31 50 41 Q55 31 50 18 Z" fill="#EEF3FA"/>
    <ellipse cx="50" cy="48" rx="14" ry="11" fill="#EEF3FA"/>
    <g fill="url(#fg-mask)">
      <path d="M29 35 Q36 28 45 32 Q50 35 48 40 Q45 46 36 45 Q28 44 29 35 Z"/>
      <path d="M71 35 Q64 28 55 32 Q50 35 52 40 Q55 46 64 45 Q72 44 71 35 Z"/>
      <path d="M45 33 Q50 31 55 33 L55 39 Q50 36 45 39 Z"/>
    </g>
    <circle cx="40" cy="37" r="5.4" fill="#0B1018"/>
    <circle cx="60" cy="37" r="5.4" fill="#0B1018"/>
    <circle cx="41.6" cy="35.4" r="2" fill="#EEF3FA"/>
    <circle cx="61.6" cy="35.4" r="2" fill="#EEF3FA"/>
    <path d="M50 44 q-3.6 0 -3.6 3 q0 3 3.6 3.7 q3.6 -0.7 3.6 -3.7 q0 -3 -3.6 -3 z" fill="#3D4A5E"/>
    <path d="M45 53 q5 4 10 0" stroke="#6B788E" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M24 60 L50 56 L76 60 L76 64 L24 64 Z" fill="#B7D6F2"/>
    <path d="M24 64 L50 67 L50 90 L24 87 Z" fill="url(#fg-box)"/>
    <path d="M76 64 L50 67 L50 90 L76 87 Z" fill="#4E8CCB"/>
    <path d="M50 56 L50 90" stroke="#EAF2FB" stroke-width="2" stroke-linecap="round" opacity="0.85"/>
    <path d="M24 62 L50 65 L76 62" stroke="#EAF2FB" stroke-width="1.6" fill="none" opacity="0.7"/>
    <ellipse cx="30" cy="61" rx="6" ry="5" fill="#8A98AE"/>
    <ellipse cx="70" cy="61" rx="6" ry="5" fill="#8A98AE"/>
    <path d="M27 60 l1.6 0 M30 60 l1.6 0 M33 60 l1.6 0" stroke="#5E6B80" stroke-width="1" stroke-linecap="round"/>
    <path d="M67 60 l1.6 0 M70 60 l1.6 0 M73 60 l1.6 0" stroke="#5E6B80" stroke-width="1" stroke-linecap="round"/>
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
  console.log("\n[1/5] Mobile PNG assets");
  await writePng(join(MOBILE_ASSETS, "icon.png"), ICON_SVG, { width: 1024, height: 1024 });
  await writePng(join(MOBILE_ASSETS, "adaptive-icon.png"), FOREGROUND_SVG, { width: 1024, height: 1024 });
  await writePng(join(MOBILE_ASSETS, "splash-icon.png"), ICON_SVG, { width: 1024, height: 1024 });
  await writePng(join(MOBILE_ASSETS, "favicon.png"), ICON_SVG, { width: 256, height: 256 });
  await writePng(join(MOBILE_ASSETS, "notification-icon.png"), NOTIFICATION_SVG, { width: 192, height: 192 });

  console.log("\n[2/5] Web PWA PNG icons");
  await writePng(join(WEB_ICONS, "icon-192.png"), APP_ICON_SVG, { width: 192, height: 192 });
  await writePng(join(WEB_ICONS, "icon-512.png"), APP_ICON_SVG, { width: 512, height: 512 });

  console.log("\n[3/5] Web favicon.ico (multi-size 16/32/48 container)");
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

  console.log("\n[4/5] Android launcher WEBPs");
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

  console.log("\n[5/5] Android splash-screen logo PNGs");
  // expo prebuild artifacts committed under res/drawable-*; sizes match what
  // expo-splash-screen generated (288/432/576/864/1152). Regenerated here so
  // an icon swap never ships a mixed identity (mascot launcher + old splash).
  const splashSizes = {
    mdpi: 288,
    hdpi: 432,
    xhdpi: 576,
    xxhdpi: 864,
    xxxhdpi: 1152,
  };
  for (const [density, size] of Object.entries(splashSizes)) {
    await writePng(
      join(ANDROID_RES, `drawable-${density}`, "splashscreen_logo.png"),
      ICON_SVG,
      { width: size, height: size },
    );
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
