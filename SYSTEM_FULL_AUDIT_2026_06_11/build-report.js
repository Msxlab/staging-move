const fs = require("fs");
const path = require("path");
const audit = "C:/Users/Kutay/Desktop/move-main/move-main/SYSTEM_FULL_AUDIT_2026_06_11";
function fix(s) {
  if (!s) return s;
  const pairs = [
    ["Ã–","Ö"], ["Ãœ","Ü"], ["Ã‡","Ç"], ["Ä°","İ"], ["ÄŸ","ğ"], ["Äž","Ğ"], ["Åž","Ş"], ["ÅŸ","ş"], ["Ä±","ı"],
    ["Ã¼","ü"], ["Ã¶","ö"], ["Ã§","ç"], ["Ã¡","á"], ["Ã©","é"],
    ["â€”","-"], ["â€“","-"], ["â†’","->"], ["â‰¥",">="], ["â‰¤","<="], ["â€¦","..."],
    ["â€œ","\""], ["â€","\""], ["â€˜","'"], ["â€™","'"], ["Â",""]
  ];
  for (const [a,b] of pairs) s = s.split(a).join(b);
  return s;
}
function loadFindings(file) {
  const p = path.join(audit, file);
  const text = fs.readFileSync(p, "utf8");
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = fix(raw).trim();
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
const rank = { "Kritik": 0, "Yüksek": 1, "Orta": 2, "Düşük": 3 };
findings.sort((a,b) => (rank[a.onem] ?? 9) - (rank[b.onem] ?? 9) || a.katman.localeCompare(b.katman, "tr") || a.bulgu.localeCompare(b.bulgu, "tr"));
const counts = { critical: 0, high: 0, medium: 0, low: 0 };
for (const f of findings) {
  if (f.onem === "Kritik") counts.critical++;
  else if (f.onem === "Yüksek") counts.high++;
  else if (f.onem === "Orta") counts.medium++;
  else if (f.onem === "Düşük") counts.low++;
}
const report = [];
report.push("LocateFlow Uçtan Uca Sistem Denetim Raporu");
report.push("Tarih: 2026-06-11");
report.push("Kapsam: web, admin, mobile, shared paketler, Prisma schema, connectors, ödeme, cron/deploy, SEO/GEO ve çapraz katman veri akışları.");
report.push("");
report.push("Varsayımlar");
report.push("- Üretim secret değerleri okunmadı; env/deploy tespiti statik dosya ve runtime-config kodu üzerinden yapıldı.");
report.push("- Gerçek Stripe/App Store/Play Store işlemi yapılmadı; ödeme/IAP bulguları kod, config, schema, unit test ve lokal E2E analizi kanıtıdır.");
report.push("- GitHub Actions cron workflow prod scheduler kabul edilirse cron kapsamı daha iyi; Vercel/Ofelia tek scheduler olursa cron bulgularının etkisi artar.");
report.push("- Proje .md/memory dosyaları denetim kanıtı olarak kullanılmadı; rapor kod, config, schema ve çalıştırılan testlerden üretildi.");
report.push("");
report.push("Doğrulama");
report.push("- Web unit: 258 test dosyası / 2275 test geçti; web typecheck geçti.");
report.push("- Admin unit: 114 test dosyası / 717 test geçti; admin typecheck geçti.");
report.push("- Shared typecheck geçti; connectors typecheck geçti; connectors unit: 15 test dosyası / 105 test geçti.");
report.push("- Mobile typecheck geçti; mobile unit testlerde 4 IAP recovery testi __DEV__ ReferenceError nedeniyle başarısız, 228 test geçti.");
report.push("- Web Playwright public smoke: 5 geçti, 8 başarısız. Başlıca kanıtlar: ciddi kontrast ihlalleri, FAQ JSON-LD eksikliği, robots dev/prod beklenti farkı, auth selector belirsizliği.");
report.push("- Local public crawl: 21 sayfa ve 27 internal link tarandı; kırık internal link bulunmadı.");
report.push("- DB package içinde lint script yok; Node 24.12 ile çalışırken repo engine 22.x uyarısı üretildi.");
report.push("");
report.push(`Bulgu Sayısı: Toplam ${findings.length} | Kritik ${counts.critical} | Yüksek ${counts.high} | Orta ${counts.medium} | Düşük ${counts.low}`);
report.push("");
report.push("Bulgular");
report.push("Katman | Önem | Bulgu | Neden sorun | Önerilen çözüm");
for (const f of findings) report.push(`${f.katman} | ${f.onem} | ${f.bulgu} | ${f.neden} | ${f.cozum}`);
report.push("");
report.push("Genel Sağlık Özeti");
report.push("- Web tarafında geniş unit test kapsamı var ve public link crawl temiz, ancak Family/Pro, workspace scope, export/provider/budget ayrımı, ödeme consent/tax ve SEO/a11y yüzeylerinde canlı kullanıcı etkisi yüksek açıklar var.");
report.push("- Admin temel güvenlik mimarisi güçlü: JWT, DB session, CSRF, IP kuralları, CSP, step-up ve audit patternleri mevcut. Buna rağmen force-password-change, manuel entitlement, IAP revalidation, workspace ownership transfer ve bildirimlerde yüksek riskli iş mantığı boşlukları var.");
report.push("- Mobile uygulama typecheck açısından temiz; en büyük riskler web-cookie akışlarına bridge eksikliği, workspace header taşımama, IAP recovery test kırığı, store privacy metadata ve preview buildlerin prod backend kullanması.");
report.push("- Shared/connector çekirdeği iyi tasarlanmış ve connector package testleri temiz; risk daha çok DB tekillik garantisi, soft-delete yan etkileri, env/deploy parity ve scheduler kaynaklarının ayrışmasında.");
report.push("- Ödeme katmanı web, admin ve mobile arasında ürün/plan matrisi olarak büyümüş; artık tek bir billing readiness ve workspace-seat reconciliation kapısı olmadan canlıya çıkmak riskli.");
report.push("");
report.push("Öncelikli Aksiyon Listesi");
report.push("1. Family/Pro launch gate: workspace flag/backfill, price IDs, env/compose parity, checkout consent snapshot ve seat reconciliation tek release checklist altında kapatılsın.");
report.push("2. Workspace context: web export/budget/provider/moving driftleri ve mobile X-Workspace-Id eksikliği aynı scope contract ile düzeltilsin; invalid workspace id mutasyonlarda fallback yapmasın.");
report.push("3. Billing/IAP: Stripe tax/consent/API version, admin manual entitlement validation, mobile IAP readiness ve Apple/Google doğrulama akışları öncelikli ele alınsın.");
report.push("4. Privacy/soft-delete: Notification, push token, connector dispatch ve unsubscribe preference mapping hesap silme/opt-out ile tek noktadan uyumlu hale getirilsin.");
report.push("5. Admin high-risk actions: force-password-change, ownership transfer, bulk provider changes, fallback connector links ve broadcast notifications için step-up + stricter validation uygulanmalı.");
report.push("6. Cron/deploy: GitHub/Vercel/Ofelia tek manifestten üretilsin; scheduled-delivery retry/prefs modeli netleştirilsin.");
report.push("7. SEO/a11y: serious contrast ihlalleri, FAQ JSON-LD render boşluğu, robots test ortamı farkı ve GEO/llms.txt hata görünürlüğü düzeltilsin.");
report.push("8. Mobile release: preview/staging backend ayrımı, App Privacy manifest, Apple nonce, widget App Group write ve IAP __DEV__ test kırığı kapatılsın.");
report.push("9. Data integrity: PartnerConsent aktif grant tekilliği, workspace invite duplicate yapısı, primary address delete race ve workspace creation cap race için DB/transaction seviyesinde koruma eklensin.");
report.push("10. Regression suite: web/admin unit yeşil durum korunurken Playwright a11y/SEO smoke ve mobile IAP recovery testleri CI bloklayıcı hale getirilsin.");
const out = path.join(audit, "FULL_AUDIT_REPORT.txt");
fs.writeFileSync(out, report.join("\n") + "\n", "utf8");
const todoPath = path.join(audit, "TODO.txt");
let todo = fs.readFileSync(todoPath, "utf8");
todo = todo.replace("[DOING] Consolidate duplicate findings","[DONE] Consolidate duplicate findings")
  .replace("[TODO] Sort Critical/High first","[DONE] Sort Critical/High first")
  .replace("[TODO] Write health summary and prioritized action list","[DONE] Write health summary and prioritized action list");
fs.writeFileSync(todoPath, todo, "utf8");
fs.appendFileSync(path.join(audit, "RUN_LOG.txt"), `\n2026-06-11 - Wrote consolidated full audit report: FULL_AUDIT_REPORT.txt (${findings.length} findings; high-first ordering; health summary and prioritized action list included).\n`, "utf8");
console.log(`Wrote ${out}`);
console.log(`Findings: ${findings.length}; Critical=${counts.critical} High=${counts.high} Medium=${counts.medium} Low=${counts.low}`);
