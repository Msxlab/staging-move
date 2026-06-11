const fs = require("fs");
const path = require("path");
const audit = "C:/Users/Kutay/Desktop/move-main/move-main/SYSTEM_FULL_AUDIT_2026_06_11";
const HIGH = "Y\u00fcksek";
const LOW = "D\u00fc\u015f\u00fck";
const CRIT = "Kritik";
const MED = "Orta";
function repair(s) {
  if (!s) return s;
  let out = s;
  for (let i = 0; i < 2; i++) {
    if (/[\u00c3\u00c2\u00c4\u00c5\u00e2]/.test(out)) {
      const converted = Buffer.from(out, "latin1").toString("utf8");
      if (converted && converted !== out) out = converted;
    }
  }
  return out.replace(/\uFFFD/g, "?");
}
function loadFindings(file) {
  const p = path.join(audit, file);
  const text = fs.readFileSync(p, "utf8");
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = repair(raw).trim();
    if (!line || /^Katman\s*\|/.test(line)) continue;
    const parts = line.split(/\s*\|\s*/);
    if (parts.length < 5) continue;
    out.push({
      katman: parts[0].trim(),
      onem: parts[1].trim(),
      bulgu: parts[2].trim(),
      neden: parts.slice(3, parts.length - 1).join(" | ").trim(),
      cozum: parts[parts.length - 1].trim(),
    });
  }
  return out;
}
const findings = [
  ...loadFindings("FINDINGS.csv"),
  ...loadFindings("MOBILE_FINDINGS.txt"),
  ...loadFindings("SHARED_FINDINGS.txt"),
];
const rank = { [CRIT]: 0, [HIGH]: 1, [MED]: 2, [LOW]: 3 };
findings.sort((a,b) => (rank[a.onem] ?? 9) - (rank[b.onem] ?? 9) || a.katman.localeCompare(b.katman, "tr") || a.bulgu.localeCompare(b.bulgu, "tr"));
const counts = { critical: 0, high: 0, medium: 0, low: 0 };
for (const f of findings) {
  if (f.onem === CRIT) counts.critical++;
  else if (f.onem === HIGH) counts.high++;
  else if (f.onem === MED) counts.medium++;
  else if (f.onem === LOW) counts.low++;
}
const report = [];
report.push("LocateFlow Uctan Uca Sistem Denetim Raporu");
report.push("Tarih: 2026-06-11");
report.push("Kapsam: web, admin, mobile, shared paketler, Prisma schema, connectors, odeme, cron/deploy, SEO/GEO ve capraz katman veri akislari.");
report.push("");
report.push("Varsayimlar");
report.push("- Uretim secret degerleri okunmadi; env/deploy tespiti statik dosya ve runtime-config kodu uzerinden yapildi.");
report.push("- Gercek Stripe/App Store/Play Store islemi yapilmadi; odeme/IAP bulgulari kod, config, schema, unit test ve lokal E2E analizi kanitidir.");
report.push("- GitHub Actions cron workflow prod scheduler kabul edilirse cron kapsami daha iyi; Vercel/Ofelia tek scheduler olursa cron bulgularinin etkisi artar.");
report.push("- Proje .md/memory dosyalari denetim kaniti olarak kullanilmadi; rapor kod, config, schema ve calistirilan testlerden uretildi.");
report.push("");
report.push("Dogrulama");
report.push("- Web unit: 258 test dosyasi / 2275 test gecti; web typecheck gecti.");
report.push("- Admin unit: 114 test dosyasi / 717 test gecti; admin typecheck gecti.");
report.push("- Shared typecheck gecti; connectors typecheck gecti; connectors unit: 15 test dosyasi / 105 test gecti.");
report.push("- Mobile typecheck gecti; mobile unit testlerde 4 IAP recovery testi __DEV__ ReferenceError nedeniyle basarisiz, 228 test gecti.");
report.push("- Web Playwright public smoke: 5 gecti, 8 basarisiz. Baslica kanitlar: ciddi kontrast ihlalleri, FAQ JSON-LD eksikligi, robots dev/prod beklenti farki, auth selector belirsizligi.");
report.push("- Local public crawl: 21 sayfa ve 27 internal link tarandi; kirik internal link bulunmadi.");
report.push("- DB package icinde lint script yok; Node 24.12 ile calisirken repo engine 22.x uyarisi uretildi.");
report.push("");
report.push(`Bulgu Sayisi: Toplam ${findings.length} | Kritik ${counts.critical} | Yuksek ${counts.high} | Orta ${counts.medium} | Dusuk ${counts.low}`);
report.push("");
report.push("Bulgular");
report.push("Katman | Onem | Bulgu | Neden sorun | Onerilen cozum");
for (const f of findings) report.push(`${f.katman} | ${f.onem} | ${f.bulgu} | ${f.neden} | ${f.cozum}`);
report.push("");
report.push("Genel Saglik Ozeti");
report.push("- Web tarafinda genis unit test kapsami var ve public link crawl temiz, ancak Family/Pro, workspace scope, export/provider/budget ayrimi, odeme consent/tax ve SEO/a11y yuzeylerinde canli kullanici etkisi yuksek aciklar var.");
report.push("- Admin temel guvenlik mimarisi guclu: JWT, DB session, CSRF, IP kurallari, CSP, step-up ve audit patternleri mevcut. Buna ragmen force-password-change, manuel entitlement, IAP revalidation, workspace ownership transfer ve bildirimlerde yuksek riskli is mantigi bosluklari var.");
report.push("- Mobile uygulama typecheck acisindan temiz; en buyuk riskler web-cookie akislarina bridge eksikligi, workspace header tasimama, IAP recovery test kirigi, store privacy metadata ve preview buildlerin prod backend kullanmasi.");
report.push("- Shared/connector cekirdegi iyi tasarlanmis ve connector package testleri temiz; risk daha cok DB tekillik garantisi, soft-delete yan etkileri, env/deploy parity ve scheduler kaynaklarinin ayrismasinda.");
report.push("- Odeme katmani web, admin ve mobile arasinda urun/plan matrisi olarak buyumus; artik tek bir billing readiness ve workspace-seat reconciliation kapisi olmadan canliya cikmak riskli.");
report.push("");
report.push("Oncelikli Aksiyon Listesi");
report.push("1. Family/Pro launch gate: workspace flag/backfill, price IDs, env/compose parity, checkout consent snapshot ve seat reconciliation tek release checklist altinda kapatilsin.");
report.push("2. Workspace context: web export/budget/provider/moving driftleri ve mobile X-Workspace-Id eksikligi ayni scope contract ile duzeltilsin; invalid workspace id mutasyonlarda fallback yapmasin.");
report.push("3. Billing/IAP: Stripe tax/consent/API version, admin manual entitlement validation, mobile IAP readiness ve Apple/Google dogrulama akislari oncelikli ele alinsin.");
report.push("4. Privacy/soft-delete: Notification, push token, connector dispatch ve unsubscribe preference mapping hesap silme/opt-out ile tek noktadan uyumlu hale getirilsin.");
report.push("5. Admin high-risk actions: force-password-change, ownership transfer, bulk provider changes, fallback connector links ve broadcast notifications icin step-up + stricter validation uygulanmali.");
report.push("6. Cron/deploy: GitHub/Vercel/Ofelia tek manifestten uretilsin; scheduled-delivery retry/prefs modeli netlestirilsin.");
report.push("7. SEO/a11y: serious contrast ihlalleri, FAQ JSON-LD render boslugu, robots test ortami farki ve GEO/llms.txt hata gorunurlugu duzeltilsin.");
report.push("8. Mobile release: preview/staging backend ayrimi, App Privacy manifest, Apple nonce, widget App Group write ve IAP __DEV__ test kirigi kapatilsin.");
report.push("9. Data integrity: PartnerConsent aktif grant tekilligi, workspace invite duplicate yapisi, primary address delete race ve workspace creation cap race icin DB/transaction seviyesinde koruma eklensin.");
report.push("10. Regression suite: web/admin unit yesil durum korunurken Playwright a11y/SEO smoke ve mobile IAP recovery testleri CI bloklayici hale getirilsin.");
const out = path.join(audit, "FULL_AUDIT_REPORT.txt");
fs.writeFileSync(out, report.join("\n") + "\n", "utf8");
const asciiOut = path.join(audit, "FULL_AUDIT_REPORT_ASCII_SAFE.txt");
fs.writeFileSync(asciiOut, report.join("\n") + "\n", "utf8");
fs.appendFileSync(path.join(audit, "RUN_LOG.txt"), `\n2026-06-11 - Rewrote consolidated report with ASCII-safe static text and repaired finding rows to avoid terminal mojibake.\n`, "utf8");
console.log(`Wrote ${out}`);
console.log(`Findings: ${findings.length}; Critical=${counts.critical} High=${counts.high} Medium=${counts.medium} Low=${counts.low}`);
