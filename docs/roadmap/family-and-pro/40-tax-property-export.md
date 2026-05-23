# Tax & Property Export

- **Status**: Proposed (Pro launch, Sprint 4)
- **Tier**: Pro (Family/Individual locked)
- **Related decisions**: D18 (Address.label tax export'ta gruplama anahtarı; **ayrı Business profili YOK**), D2 (entitlement owner subscription'ından), D3 (visibility field-level — paidByUserId kontrolü export'a aktarılır)
- **Related docs**: [23](./23-shared-services.md), [24](./24-family-budget-consolidated.md), [30](./30-pro-plan-definition.md), [32](./32-address-labels.md), [41](./41-move-history-timeline.md), [50](./50-admin-workspace-inspector.md), [63](./63-entitlement-banners-empty-states.md), [67](./67-i18n-tr-en.md)

---

## Amaç

Pro kullanıcı vergi sezonunda (mortgage interest deduction, rental income tracking, küçük işletme adres bazlı utility gideri kayıtları) ihtiyaç duyduğu **CSV ve PDF özet'i** workspace'inden export eder. Address label (HOME/OFFICE/RENTAL/VACATION) per D18 ana gruplama anahtarıdır.

Bu özellik **vergi danışmanlığı değildir** — sadece kullanıcının zaten LocateFlow'da tuttuğu servis/maliyet verisinin filtrelenmiş bir dump'ıdır. Disclaimer önemli.

## Kapsam

**In scope (MVP)**
- `GET /api/exports?type=tax&year=YYYY&format=csv|pdf` endpoint
- CSV: per-service row, address label gruplama
- PDF: workspace owner adı, opsiyonel EIN field (user input, **persisted ama Subscription'a bağlanmaz** — sadece export PDF'de gösterilir), per-label özet tablo, grand total
- Year filter (varsayılan: önceki tam yıl); ay aralığı opsiyonel
- Address label filter (örn. sadece RENTAL adresleri)
- Pro-only; Family/Individual locked state CTA
- Web `/exports` sayfası
- Async generation (>500 servis varsa job queue + email link; <500 sync)
- AuditLog: `action="EXPORT", entityType="TaxExport"`
- TR/EN PDF (cross-ref [67](./67-i18n-tr-en.md))

**Out of scope**
- Vergi formu otomatik doldurma (1040 Schedule E, 1098 vb.) — Faz 2
- TurboTax / H&R Block entegrasyonu — Faz 2
- Mobile generation (D11 ruhuna uygun: "Generate on web" yönlendirmesi)
- Çoklu yıl tek dosyada (sadece tek yıl/dönem MVP)
- Multi-currency dönüşüm — workspace currency neyse o (mevcut davranış)
- "Property tax" otomatik track (kullanıcı manuel servis olarak ekler) — auto-scrape Faz 3
- Excel `.xlsx` (sadece CSV; Excel CSV açar)

## User stories

- As Pro user (landlord), 2026 vergi beyannamem için RENTAL adreslerimdeki **utility/internet/maintenance** giderlerini tek dosyada **muhasebecime gönderebileyim**.
- As Pro user, EIN/Vergi no'mu PDF header'ına ekleyebileyim — muhasebeci hangi entity için olduğunu görsün.
- As Pro user, **paidByUserId** workspace owner olmayan servisler için warning isterim (örn. eski roommate'in ödediği internet rental'a dahil olmamalı).
- As Pro user, kredi kartı veya kullanıcı adı field'larının **export'ta görünmemesini** isterim — muhasebeciye PII leak istemiyorum.
- As Family user (vergi indirimi için bütçe çıktısı isteyen), "Tax export Pro feature, upgrade?" mesajı isterim.

## Veri modeli

Yeni tablo gerekmez. Hafif eklemeler:

```prisma
model Workspace {
  // ... mevcut alanlar ...

+ taxIdNumber       String? @db.VarChar(40)
+   // EIN / VKN / VAT no — user-entered, export PDF'de gösterilir
+   // Subscription'a/billing'e BAĞLANMAZ (D18 — ayrı business tier yok)
+ taxIdLabel        String? @db.VarChar(80)
+   // "EIN", "Vergi Kimlik No", "VAT", vb.
}
```

`Address.label` zaten cross-ref [32](./32-address-labels.md)'den geliyor — bu spec sadece tüketir.

`Service.paidByUserId` cross-ref [23](./23-shared-services.md)'ten — bu spec filter olarak kullanır.

```prisma
// Opsiyonel: export tarihini track etmek için
model TaxExportLog {
  id           String   @id @default(cuid()) @db.VarChar(30)
  workspaceId  String   @db.VarChar(30)
  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  requestedByUserId String @db.VarChar(30)
  year         Int
  format       String   @db.VarChar(10)   // CSV | PDF
  rowCount     Int
  fileSizeBytes Int
  createdAt    DateTime @default(now())
  @@index([workspaceId, year])
}
```

**Not**: TaxExportLog opsiyonel — `AuditLog` zaten kapsıyor. Eğer dashboard'da "Son export'lar" göstereceksek ayrı tablo daha clean. **Karar**: MVP'de `AuditLog` yeter, TaxExportLog Faz 2.

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/exports?type=tax&year=2026&format=csv` | session | `requireWorkspaceContext` (Pro) | — | `200 text/csv; charset=utf-8` stream + `Content-Disposition: attachment; filename="tax-2026-workspace.csv"` | 401, 403 (plan<Pro), 422 (year invalid), 429 |
| GET | `/api/exports?type=tax&year=2026&format=pdf` | session | `requireWorkspaceContext` (Pro) | — | `200 application/pdf` stream | aynı |
| POST | `/api/exports/async` | session | `requireWorkspaceContext` (Pro) | `{ type, year, format, filters }` | `202 { jobId }` (sonuç email link) | 401, 403, 422 |
| GET | `/api/exports/jobs/:jobId` | session | `requireWorkspaceContext` (Pro) | — | `{ status, downloadUrl?, expiresAt? }` | 401, 403, 404 |
| PATCH | `/api/workspace/tax-id` | session | `requireWorkspaceContext` (OWNER + Pro) | `{ taxIdNumber, taxIdLabel }` | `200 { workspace }` | 401, 403, 422 |

**Server logic** (`apps/web/src/app/api/exports/route.ts`):
1. `requireWorkspaceContext` + Pro gate
2. Query string parse: `type` (zorunlu, "tax" | "property"), `year` (default last year), `format` (csv|pdf), `addressLabel?`, `includeNonOwnerPaid?` (default false)
3. Servisleri çek: `prisma.service.findMany({ where: { workspaceId, address: { label: in [filter] }, ... costs in date range }, include: { address, provider, customProvider, paidByUser }})`
4. Filter out: `paidByUserId !== workspace.ownerUserId` ise (default true) → warning satırı export'a, ayrı bölüm
5. Row count > 500 ise async öner: 409 + "Use async endpoint"
6. CSV format: streamcsv (papaparse veya csv-stringify)
7. PDF format: `@react-pdf/renderer` (cross-ref [37](./37-partner-pdf-letter-generator.md) — aynı dependency)
8. `AuditLog(action="EXPORT", entityType="TaxExport", entityId=workspaceId, changes={year, format, rowCount})`
9. Stream response

**CSV columns** (sabit; column order locked, additive değişiklikler için header v2 yorum satırı):
```
# LocateFlow Tax Export v1 — generated {ISO8601}
address_label,address_street,address_city,address_state,service_category,provider_name,billing_cycle,monthly_cost,annual_cost_estimate,paid_by_owner,notes
HOME,123 Main St,Brooklyn,NY,Internet,Verizon Fios,MONTHLY,79.99,959.88,true,
RENTAL,456 Park Ave,Manhattan,NY,Utility,Con Edison,MONTHLY,142.30,1707.60,true,
RENTAL,456 Park Ave,Manhattan,NY,Internet,Spectrum,MONTHLY,89.99,1079.88,false,"Paid by tenant"
```

**Hassas alanlar export'a ASLA dahil edilmez** (D3 ruhu):
- `Service.accountNumber` (encrypted, decrypt etmiyoruz)
- `Service.username`
- `Service.password` (zaten yok ama)
- Vendor `customMailtoBody` (private notlar)

**PDF içeriği**:
1. Cover page: workspace adı + owner name + tax year + (varsa) tax ID label + number
2. Summary tablo: per-address-label totals
3. Detail tables: her label için servis listesi (kategori, provider, annual cost)
4. Disclaimer footer: "This is not tax advice. Verify with your accountant. LocateFlow is not a tax preparation service."
5. Footer: "Generated {date} • Page {n} of {total}"

### Mevcut endpoint'lere etki

- **`/api/profile/export`** (mevcut GDPR DSAR) — kullanıcı bazlı; bu spec workspace-bazlı, farklı endpoint. Cross-link UI'da: "Looking for personal data export? Try Profile → Export"
- **Mevcut services list endpoint** — değişmez; export READ-only.

## Web

### Yeni sayfa/route

`apps/web/src/app/(workspace)/exports/page.tsx`:
- Header "Tax & Property Exports" + Pro badge
- Filter form:
  - Year dropdown (son 5 yıl + custom range)
  - Address label multi-select (default: all)
  - Include non-owner paid services? (checkbox, default off)
  - Format: CSV / PDF (radio)
- "Generate" button → triggers download (sync veya async based on size)
- Previous exports list (AuditLog'dan son 10): tarih, format, "Re-download" (Faz 2; MVP'de yok)
- EIN/Tax ID input (OWNER only): "Add Tax ID to PDF exports" — PATCH workspace
- Disclaimer paragraf

`apps/web/src/app/(workspace)/exports/locked/page.tsx`:
- Family / Individual / Free için redirect veya inline locked state
- Upgrade CTA (cross-ref [31](./31-pro-checkout-flow.md))

### Mevcut sayfalara etki

- **Workspace dashboard sidebar** — "Exports" entry (Pro unlock, others lock icon + tooltip).
- **Profile page** — opsiyonel cross-link kart: "Need tax export? Go to Workspace → Exports".

### Componentler (file paths)

- `apps/web/src/app/(workspace)/exports/page.tsx`
- `apps/web/src/components/exports/ExportForm.tsx`
- `apps/web/src/components/exports/TaxIdForm.tsx`
- `apps/web/src/components/exports/ExportLockedState.tsx`
- `apps/web/src/lib/exports/taxCsv.ts` — CSV generator (server-side)
- `apps/web/src/lib/exports/taxPdf.tsx` — React PDF component
- `apps/web/src/lib/exports/buildExportRows.ts` — DB query + row shaping (testable pure fn)

### Butonlar / actionlar

- **Generate CSV** / **Generate PDF** — sync download
- **Generate (async)** — gönder, email link bekle (>500 row)
- **Save Tax ID** — workspace PATCH

## Mobile

### Yeni ekran

**Yok** — D11 ve scope kararı: mobile'da tax export YOK.

`apps/mobile/app/(workspace)/exports/index.tsx` minimal:
- "Tax exports are available on the web. We'll email you a link."
- "Open on web" buton → deep-link to web export page (eğer auth share varsa) veya plain "Visit locateflow.com/exports" mesajı

### Mevcut ekranlara etki

Settings menüsünde "Exports" entry → yukarıdaki redirect ekranına.

### Componentler

- `apps/mobile/app/(workspace)/exports/index.tsx` — bilgi ekranı

## Admin

### Yeni sayfa

Yok. Mevcut Workspace Inspector (cross-ref [50](./50-admin-workspace-inspector.md)) içine:
- **"Exports" tab** — bu workspace'in son 50 tax export'u (AuditLog filter `entityType="TaxExport"`)
- Read-only: tarih, format, row count, requestedByUserId
- "Re-trigger export for support" — destek talebi için admin, AdminAuditLog'a yazılır (`action="ADMIN_TRIGGER_EXPORT"`)

### Yetenekler

- Inspect export history
- Manual re-trigger (support escalation için)

## Güvenlik

- [x] **Step-up auth?** Hayır — okuma operasyonu, kullanıcının zaten erişimi olan veri. Eğer EIN edit ise OWNER role yeterli (ek step-up Faz 2'de düşünülebilir).
- [x] **PII redaction?** Hassas field'lar (accountNumber, username) export'tan **çıkarılır**. Kullanıcı email/isim export'a dahil edilebilir (workspace owner kontekstinde anlamlı). Vendor entries (cross-ref [39](./39-vendor-contact-book.md)) tax export'a **dahil değil** — ayrı feature.
- [x] **Audit log?** `AuditLog(action="EXPORT", entityType="TaxExport", entityId=workspaceId, changes={year, format, rowCount, addressLabels, fileSize})`. PII change'leri (tax ID set) `AuditLog(action="UPDATE", entityType="Workspace", changes={taxIdNumber:"***"+last4})`.
- [x] **Rate limit?** Export endpoint 10/saat/workspace (compute cost). Tax ID PATCH 20/saat.
- [x] **Permission matris?** OWNER + ADMIN: export edebilir + tax ID edit. MEMBER: export okuma izni var (workspace verisi paylaşılan), ama tax ID edit yok. CHILD: export erişimi YOK (finansal görmez, cross-ref [22](./22-child-role.md)). VIEW_ONLY: read-only, export edebilir mi? **Karar**: HAYIR — export ek "egress" kapısı, VIEW_ONLY salt-görüş.
- [x] **Encryption at rest?** Export dosyaları **kalıcı depolanmaz** (async modda 24h temp storage S3/R2, signed URL, sonra silinir). `taxIdNumber` DB'de — hassas; ama PCI/SOX kapsamına girmez. **MVP plaintext**, Faz 2 application-level encryption ek karar.
- [x] **GDPR DSAR?** Tax ID workspace PII'si — `/api/profile/export` workspace owner için bu field'ı dahil eder. Erase request: workspace silinince cascade.

## Migration / backward compat

- `Workspace.taxIdNumber` + `taxIdLabel` nullable kolonlar, no backfill.
- Mevcut bir workspace export sayfasına girince form boş, kullanıcı doldurur.
- Plan downgrade Pro → Family: tax ID field DB'de kalır ama UI'da read-only + "Reactivate Pro to use" mesajı.

## Etkilenen mevcut özellikler

- **`@react-pdf/renderer`** dependency — cross-ref [37](./37-partner-pdf-letter-generator.md) ile aynı paket; tek install.
- **`/api/profile/export`** (mevcut DSAR) — UI'dan "Tax export needed?" cross-link.
- **Family Budget Consolidated** (cross-ref [24](./24-family-budget-consolidated.md)) — Pro upgrade banner'ında "+ tax export" benefit eklenir.
- **Pricing page** (cross-ref [61](./61-pricing-page-update.md)) — Pro sütununda "Tax export (CSV/PDF)" feature line.
- **Address labels** (cross-ref [32](./32-address-labels.md)) — bu feature'ın kullanılabilmesi için kullanıcının adreslerini label'lamış olması faydalı; export sayfasında "Tip: Label your addresses for better grouping" hint.

## Test plan

**Unit**
- `buildExportRows(workspaceId, filters)` → expected row shape
- Non-owner-paid filter doğru
- Hassas field'lar leak değil
- CSV escape: virgül içeren provider adı, newline notlar
- PDF: tax ID yoksa o satır gizlenir
- Year boundary: Dec 31 23:59 ve Jan 1 00:00 farklı yıllara düşer (timezone: workspace timezone, UTC değil — mevcut workspace TZ var mı kontrol et)

**Integration**
- `GET /api/exports?type=tax&year=2026&format=csv` Pro user → 200 valid CSV
- Family user → 403
- Year invalid (2050) → 422
- Row count >500 → 409 + async ipucu
- Async flow: POST → 202 → GET jobs → completed → signed URL → download → 24h sonra 410 Gone

**E2E (Playwright)**
- Pro user `/exports` → filtre + generate CSV → download → CSV header doğru
- Family user → locked state + upgrade CTA
- Tax ID save → PDF'de görünür

**Manual**
- Excel'de CSV açılıyor (UTF-8 BOM eklensin — Excel TR locale için)
- Numbers (macOS) ve Google Sheets'te de açılıyor
- TR/EN PDF: Türkçe karakterler doğru render
- Muhasebeci persona test: dosyayı ver, anlamlı mı?
- 1000+ servisli workspace (stress) async path

## Açık sorular

1. **CSV column versiyonlama**: ileride sütun eklersek eski script'leri bozar mı? **Öneri**: header'da version yorum satırı + ek sütunlar end'e (semver-like, additive only).
2. **Para birimi**: workspace multi-currency tutmuyor (varsayım). Mortgage TRY, internet USD karışıksa? **Karar**: MVP single-currency assumption; mixed currency warning banner.
3. **Property tax otomatik track**: kullanıcı manuel servis olarak ekler mi? "Property tax" kategorisi seed'lensin mi (cross-ref service category seed)? **Karar**: Faz 2.
4. **Quarterly export**: sadece annual vs. quarterly? **Karar**: MVP annual; quarterly date range filter yeterli.
5. **"Property" export** (type=property) — sadece tax mı yoksa property records (mortgage, HOA, insurance grouped) ayrı format mı? **Karar**: MVP'de tek format `type=tax` + address label filter yeter; ayrı `type=property` Faz 2.
6. **Email delivery (async)**: SMTP yok (cross-ref [38](./38-partner-mailto-templates.md) — outbound mail yok). Resend/Postmark gibi 3rd party gerekecek. **Decision needed**: existing notification email path varsa (invitation email cross-ref [04](./04-workspace-invitation.md)) reuse et.
