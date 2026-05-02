// Generates the mobile app's PNG asset bundle from the SVG masters.
// Run: node scripts/build-mobile-icons.mjs
import sharp from "sharp";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASSETS = join(ROOT, "apps", "mobile", "assets");
const NG_ASSETS = join(ROOT, "NEW GENERATION", "assets");

const ICON_SVG = readFileSync(join(ASSETS, "icon.svg"), "utf8");
const LOGO_SVG = readFileSync(join(NG_ASSETS, "logo.svg"), "utf8");

const ADAPTIVE_FG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none">
  <defs>
    <linearGradient id="ai-foil" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#B8936C"/>
      <stop offset="45%" stop-color="#E5C9A8"/>
      <stop offset="100%" stop-color="#F4E4D0"/>
    </linearGradient>
    <linearGradient id="ai-rose" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#EDB99D"/>
      <stop offset="100%" stop-color="#A85A42"/>
    </linearGradient>
  </defs>
  <!-- Mark from icon.svg, drawn into the inner 66% safe zone Android requires. -->
  <g transform="translate(212,212) scale(6)">
    <path d="M20 65 Q 30 32, 50 48 T 80 40" stroke="url(#ai-foil)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="20" cy="65" r="5.5" fill="url(#ai-foil)"/>
    <circle cx="80" cy="40" r="9" fill="url(#ai-rose)"/>
    <circle cx="80" cy="40" r="3" fill="#F5F1EA"/>
  </g>
</svg>`;

const NOTIFICATION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" fill="none">
  <!-- Android tints non-transparent pixels; render the mark as a white
       silhouette with a heavier stroke so it stays legible at status-bar size. -->
  <g transform="translate(38,38) scale(1.16)">
    <path d="M20 65 Q 30 32, 50 48 T 80 40" stroke="#FFFFFF" stroke-width="9" fill="none" stroke-linecap="round"/>
    <circle cx="20" cy="65" r="9" fill="#FFFFFF"/>
    <circle cx="80" cy="40" r="13" fill="#FFFFFF"/>
  </g>
</svg>`;

async function renderToPng(svgString, opts) {
  const buf = Buffer.from(svgString);
  let pipeline = sharp(buf, { density: 384 });
  if (opts.width || opts.height) {
    pipeline = pipeline.resize({
      width: opts.width,
      height: opts.height,
      fit: opts.fit || "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  return pipeline.png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  const tasks = [];

  // 1. icon.png — 1024×1024 from icon.svg (already includes rounded-rect bg)
  tasks.push(["icon.png", await renderToPng(ICON_SVG, { width: 1024, height: 1024 })]);

  // 2. adaptive-icon.png — Android adaptive foreground (mark only, no bg, 66% safe zone)
  tasks.push(["adaptive-icon.png", await renderToPng(ADAPTIVE_FG_SVG, { width: 1024, height: 1024 })]);

  // 3. splash-icon.png — wordmark on transparent, centered in a 1024×1024 canvas
  //    so Expo's resizeMode=contain renders it crisply on the dark splash background.
  const wordmarkPng = await renderToPng(LOGO_SVG, { width: 900 });
  const splashCanvas = sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: wordmarkPng, gravity: "center" }])
    .png({ compressionLevel: 9 });
  tasks.push(["splash-icon.png", await splashCanvas.toBuffer()]);

  // 4. notification-icon.png — 192×192 white silhouette for Android status bar
  tasks.push(["notification-icon.png", await renderToPng(NOTIFICATION_SVG, { width: 192, height: 192 })]);

  // 5. favicon.png — 256×256 for the web build
  tasks.push(["favicon.png", await renderToPng(ICON_SVG, { width: 256, height: 256 })]);

  for (const [name, buf] of tasks) {
    const out = join(ASSETS, name);
    writeFileSync(out, buf);
    const size = statSync(out).size;
    console.log(`  ${name.padEnd(24)} ${(size / 1024).toFixed(1)} KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
