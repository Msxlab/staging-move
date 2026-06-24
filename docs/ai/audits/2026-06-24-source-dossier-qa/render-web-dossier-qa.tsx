import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { DossierAmbient, type AmbientSpec } from "../../../../apps/web/src/components/dashboard/dossier-ambient";

const webRequire = createRequire("C:/Users/Windows/Desktop/Staging/staging-move/apps/web/package.json");
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");

const outDir = "C:/Users/Windows/Desktop/Staging/staging-move/docs/ai/audits/2026-06-24-source-dossier-qa";
const sceneCss = fs.readFileSync(
  "C:/Users/Windows/Desktop/Staging/staging-move/apps/web/src/styles/source-dossier-scene.css",
  "utf8",
);

const rows: Array<AmbientSpec & { label: string; note: string }> = [
  { kind: "flood", intensity: 2, label: "Flood high", note: "water/bad" },
  { kind: "radon", intensity: 2, label: "Radon zone 1", note: "air/bad" },
  { kind: "school", intensity: 1, label: "School district", note: "area/good" },
  { kind: "hazard", intensity: 2, variant: "lightning", label: "Hazard lightning", note: "weather/storm" },
  { kind: "weather", intensity: 1, variant: "rain", label: "Weather rain", note: "umbrella + rain" },
  { kind: "air", intensity: 1, label: "Air moderate", note: "air/mid" },
  { kind: "water", intensity: 0, label: "Water clean", note: "water/good" },
  { kind: "evCharging", intensity: 2, label: "EV nearby", note: "transit/good" },
  { kind: "neighborhood", intensity: 0, label: "Low walkability", note: "area/mid, not chase" },
  { kind: "housing", intensity: 2, label: "Housing cost", note: "housing/mid" },
];

const body = rows
  .map((row) =>
    renderToStaticMarkup(
      <div className="qa-row lf-dossier-row lf-dossier-scene-card">
        <DossierAmbient kind={row.kind} intensity={row.intensity} variant={row.variant} />
        <div className="qa-copy">
          <strong>{row.label}</strong>
          <span>{row.note}</span>
        </div>
      </div>,
    ),
  )
  .join("\n");

const html = `<!doctype html><html class="light"><head><meta charset="utf-8"><style>
:root,.light{--bg:#EFEADF;--surface:#FFFFFF;--surface-2:#F5F0E7;--surface-3:#ECE6DA;--fg:#14202F;--fg-2:rgba(20,32,47,.72);--foil-b:#CBA45E;--info:#16666B;--sage:#0F6B50;--danger:#A83333;--rose:#2E5FB0;--primary:217.38 58.56% 43.53%;font-family:'DM Sans',Arial,sans-serif;color:var(--fg);}
body{margin:0;min-height:100vh;background:linear-gradient(180deg,#FAF8F2 0%,#F4EFE5 58%,#ECE6DA 100%);padding:28px;}
.qa-board{width:980px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.qa-row{position:relative;isolation:isolate;min-height:188px;overflow:hidden;border:1px solid rgba(20,32,47,.11);border-radius:18px;background:#fff;box-shadow:0 16px 38px rgba(20,32,47,.07),inset 0 1px 0 rgba(255,255,255,.9);padding:102px 14px 14px;}
.qa-copy{position:relative;z-index:2;display:flex;flex-direction:column;gap:4px;}
.qa-copy strong{font-size:13px;line-height:1.1}.qa-copy span{font-size:11px;color:var(--fg-2)}
.lf-dossier-scene-card{--lf-dossier-stage-h:92px;}
.lf-dossier-scene-card>.da-layer{position:absolute;z-index:0;inset:0 0 auto 0;width:100%;height:var(--lf-dossier-stage-h);overflow:hidden;border-radius:18px 18px 0 0;border-bottom:1px solid rgba(16,29,45,.13);background:radial-gradient(ellipse 70% 92% at 72% 86%,rgba(203,164,94,.12),transparent 68%),linear-gradient(180deg,#101B30,#0A1322);-webkit-mask-image:none;mask-image:none;opacity:1;filter:saturate(1.16) contrast(1.04);}
.lf-dossier-scene-card>.da-layer::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 70% 82% at 74% 62%,rgba(255,255,255,.08),transparent 68%),linear-gradient(180deg,rgba(255,255,255,.06),transparent 48%);opacity:.38;}
.lf-dossier-scene-card>.da-layer .ds-root{min-height:0;}
${sceneCss}
</style></head><body><main class="qa-board">${body}</main></body></html>`;

async function main() {
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 720 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.waitForTimeout(900);

const screenshot = path.join(outDir, "01-web-dossier-ambient-harness.png");
await page.screenshot({ path: screenshot, fullPage: true });

const metrics = await page.evaluate(() => {
  const classes = ["ds-umbrella", "ds-lightning", "ds-mask", "ds-glass", "ds-vehicle", "ds-lamp-glow", "ds-chase-pack"];
  return Object.fromEntries(
    classes.map((cls) => {
      const el = document.querySelector(`.${cls}`);
      if (!el) return [cls, null];
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return [
        cls,
        {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          opacity: style.opacity,
          background: style.backgroundColor,
        },
      ];
    }),
  );
});

await browser.close();

fs.writeFileSync(path.join(outDir, "01-web-dossier-ambient-harness.metrics.json"), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify({ screenshot, metrics }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
