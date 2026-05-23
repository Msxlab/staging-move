# Admin Provider CSV Import

- **Status**: Proposed (Family/Pro launch, Sprint 2)
- **Tier**: Admin
- **Related decisions**: D4 (action `actionTier` enum), D15 (deep-link + PDF + mailto stratejisi — bulk seed bu kanalları kapsar)
- **Related docs**: [`34-service-provider-action-registry.md`](./34-service-provider-action-registry.md), [`51-admin-provider-actions-crud.md`](./51-admin-provider-actions-crud.md)

## Amaç

Sprint 3 için 50+ partner seed'inin **CSV ile** beslenmesi. Tek tek admin formundan eklemek 50+ partner × ~3 action = 150+ form gönderimi → demoralize eder ve hata yapar. Bulk CSV import + dry-run + audit log = saatlik bir seed işi.

Aynı endpoint Sprint 3 sonrasında yeni partner katmanlarında, kategori ekleme/güncellemede de kullanılır. Idempotent (provider_code üzerinden upsert) olduğu için tekrar import güvenli.

## Kapsam

**In scope**
- `/providers/import` sayfa
- File picker (.csv, max 5 MB)
- Schema preview (sunucu CSV header'larını parse eder, beklenenle karşılaştırır)
- Dry-run mode (commit etmeden validation + diff)
- Commit mode (transactional insert + AdminAuditLog batch row)
- Background job for files >1MB (BullMQ / pg-boss — repo'da hangisi varsa)
- Failed rows downloadable as CSV (`errors.csv`)
- Re-import idempotent on `provider_code` key
- Downloadable CSV template

**Out of scope**
- Provider logo upload (admin logo flow ayrı; CSV'de `logoUrl` field'ı sadece referans)
- Domain whitelist editing (CSV import whitelist'e **yeni domain eklemez**, sadece kontrol eder)
- Geographic coverage import (ServiceProviderCoverage ayrı doc; CSV'de scope field var ama coverage rows ayrı job)
- Excel format (.xlsx); sadece UTF-8 CSV

## User stories

- As an **Admin** (with `provider.import`): 50 partner için CSV'i hazırladım; "Dry run" tıklarım; sonuç: "Would create 43 providers, 127 actions; update 7 providers; 3 errors (rows 12, 28, 45)". Errors'u indirip düzeltirim, tekrar dry run, sonra "Commit".
- As an **Admin**: aynı CSV'i tekrar import ettim; sonuç: "0 created, 50 updated (no diff), 127 actions noop". Idempotent davranış doğrulandı.
- As an **Admin**: 800 satırlık file yüklerim; arka planda iş başlatılır; sayfada "Job #abc123 running — refresh to see status" görünür; 25 sn sonra refresh ile tamamlandı görüyorum.

## Veri modeli

Bu doc **yeni tablo eklemez**; mevcutları kullanır:
- `ServiceProvider` (mevcut)
- `ServiceProviderAction` (doc 34)

**Yeni opsiyonel field** `ServiceProvider`:

```prisma
model ServiceProvider {
  // existing fields...
  externalCode String? @unique   // provider_code from CSV; null for legacy rows
}
```

Yeni `ProviderImportJob` tablosu (job tracking için):

```prisma
model ProviderImportJob {
  id                 String   @id @default(cuid())
  adminUserId        String
  fileName           String
  fileSizeBytes      Int
  mode               ImportMode  // DRY_RUN | COMMIT
  status             ImportJobStatus  // PENDING | RUNNING | DONE | FAILED
  totalRows          Int?
  createdProviders   Int?
  updatedProviders   Int?
  createdActions     Int?
  updatedActions     Int?
  errorCount         Int?
  errorsCsvUrl       String?     // S3 / R2 presigned for download (24h)
  startedAt          DateTime?
  finishedAt         DateTime?
  createdAt          DateTime @default(now())
}

enum ImportMode { DRY_RUN COMMIT }
enum ImportJobStatus { PENDING RUNNING DONE FAILED }
```

New `AdminPermission`: `provider.import`.

## CSV şeması

Tek satır = bir action (provider birden çok satırda tekrar eder, ortak `provider_code`'la birleşir).

```
provider_code, provider_name, category, website, logoUrl, country, scope, isActive,
action_id, actionType, channel, urlTemplate, mailtoSubject, mailtoBody, pdfTemplateKey,
requiredFields, supportsHousehold, supportsBusinessAddress, actionTier, averageMinutes, instructionsMd
```

- `provider_code`: zorunlu, [a-z0-9_-]+, unique partner key
- `category` enum (UTILITY | TELECOM | FINANCIAL | GOVERNMENT | INSURANCE | HEALTHCARE | OTHER)
- `scope` enum (US | CA | UK | TR | GLOBAL)
- `action_id`: opsiyonel; mevcutsa update, yoksa create
- `requiredFields`: pipe-separated (`accountNumber|phoneNumber`)
- Bool field'lar: `true` / `false` (case-insensitive)
- `channel = API` → row rejected (D15: MVP'de API kanalı yok)

## API endpoint'leri

### Yeni

| Method | Path | Auth | Permission | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/admin/providers/import/template` | Admin | `provider.import` | — | CSV file (template + 2 örnek satır) | 403 |
| POST | `/api/admin/providers/import` | Admin | `provider.import` | multipart: `file`, `mode` | `{ jobId, status }` (size <1MB ise sync; >=1MB ise async) | 400 (invalid CSV), 403, 413 (>5MB), 415 |
| GET | `/api/admin/providers/import/[jobId]` | Admin | `provider.import` | — | `ProviderImportJob` | 403, 404 |
| GET | `/api/admin/providers/import/[jobId]/errors.csv` | Admin | `provider.import` | — | CSV stream | 403, 404 |

Sync vs async: file size 1MB altı **transaction içinde inline** işlenir (~2 sn target). 1MB üstü background job (`packages/jobs/src/provider-import-worker.ts`). Sayfa polls `/api/admin/providers/import/[jobId]` 2 sn'de bir.

Validation pipeline (server-side, hem dry-run hem commit):
1. CSV parse (papaparse veya `csv-parse`)
2. Per-row Zod validation (`packages/shared/src/provider-import-schema.ts`)
3. Domain whitelist check (urlTemplate domain'i `ProviderDomainWhitelist` tablosunda mı)
4. Placeholder typo check (cross-ref 51 — aynı `PLACEHOLDER_REGISTRY` kullanır)
5. Duplicate detection: aynı CSV içinde aynı `provider_code` + aynı `action_id` = error
6. Cross-row consistency: aynı `provider_code` ile farklı `provider_name` = error
7. DB lookup: mevcut `externalCode` ile match → update path; yoksa create path

Commit transaction:
```ts
await prisma.$transaction(async (tx) => {
  for (const row of rows) {
    const provider = await tx.serviceProvider.upsert({
      where: { externalCode: row.provider_code },
      update: { /* diff */ },
      create: { /* fields */ }
    });
    if (row.action_id) {
      await tx.serviceProviderAction.upsert({ where: { id: row.action_id }, ... });
    } else {
      await tx.serviceProviderAction.create({ data: { providerId: provider.id, ... } });
    }
  }
  await tx.adminAuditLog.create({
    data: {
      permission: "provider.import",
      action: "csv_import_commit",
      targetType: "ProviderImportJob",
      targetId: jobId,
      metadataJson: { createdProviders, updatedProviders, createdActions, updatedActions, fileName }
    }
  });
}, { timeout: 60_000 });
```

### Mevcut endpoint'lere etki

- `apps/admin/src/app/api/providers/route.ts` — etkilenmez.
- Provider list page — header'a "Bulk import" linki eklenir.

## Web (admin app)

### Yeni sayfa/route

- `apps/admin/src/app/(admin)/providers/import/page.tsx` — main page (client)
- `apps/admin/src/app/(admin)/providers/import/[jobId]/page.tsx` — job detail / poll
- `apps/admin/src/app/api/admin/providers/import/route.ts`
- `apps/admin/src/app/api/admin/providers/import/[jobId]/route.ts`
- `apps/admin/src/app/api/admin/providers/import/[jobId]/errors.csv/route.ts`
- `apps/admin/src/app/api/admin/providers/import/template/route.ts`
- `packages/jobs/src/provider-import-worker.ts` (background processor)
- `packages/shared/src/provider-import-schema.ts` (Zod)

### Mevcut sayfalara etki

- `apps/admin/src/app/(admin)/providers/page.tsx` (mevcut list): sağ üste "Bulk import →" buton.
- `apps/admin/src/lib/admin-auth.ts`: `provider.import` permission code'u.

### Componentler

```
apps/admin/src/app/(admin)/providers/import/_components/
  CsvDropzone.tsx              // drag & drop + file picker (react-dropzone)
  SchemaPreview.tsx            // shows detected header columns vs expected
  ModeToggle.tsx               // Dry-run / Commit radio
  RunButton.tsx                // disabled during job
  JobStatusCard.tsx            // polling 2s; shows progress bar (rows processed)
  ResultsSummary.tsx           // "Would create 23 providers, 67 actions; 4 errors"
  ErrorsList.tsx               // first 10 errors inline; "Download errors.csv" link
  TemplateDownloadLink.tsx     // links to /template
  RecentJobsTable.tsx          // last 20 jobs for this admin
```

### Butonlar / actionlar

- **"Download CSV template"** → GET `/template` → tarayıcı indirir
- **"Choose file"** → opens picker
- **"Validate (Dry run)"** → POST mode=DRY_RUN → sync or job; sonuç ResultsSummary'de
- **"Commit import"** → confirm dialog ("This will create/update N rows; continue?") → POST mode=COMMIT
- **"Download errors.csv"** → GET `[jobId]/errors.csv`
- **"View job history"** → RecentJobsTable

## Mobile

N/A — admin web only.

## Admin permissions

| Code | What it gates | Step-up |
|---|---|---|
| `provider.import` | Upload + dry-run + commit + download errors | No |

Step-up gerekmiyor: dry-run zaten kuvvetli bir guard; commit öncesi her admin dry-run'a zorlanır (UI commit butonu sadece son başarılı dry-run sonrası enable olur).

## Güvenlik

- [ ] **Step-up admin auth** — gerekmez.
- [x] **PII redaction** — CSV'de PII olmaz (provider metadata + URL template'leri). Bir admin yanlışlıkla PII yaparsa: 5MB limit + audit log'da `fileName` (içerik değil) + 24h sonra errors.csv presign expire.
- [x] **Audit log** — her `COMMIT` job sonunda batch AuditLog entry; bireysel row değişimleri `ProviderImportJob.id` üzerinden trace edilir; isteğe bağlı detay export.
- [x] **Rate limit** — admin başına 10 import job / saat (background queue + 5MB file size limiti yeterli).
- [x] **Permission matris** — `provider.import` olmayan admin sayfayı 403 görür.
- [x] **Two-step confirmation** — Commit butonu Dry-run sonrası enable + confirm modal.
- [x] **Domain whitelist enforcement** — non-whitelisted domain → row error (dry-run sırasında görünür, commit'i bloklamaz **eğer admin override checkbox işaretlerse** — bu durumda audit log'da `metadataJson.domainOverride: true`).
- [x] **Transaction integrity** — commit `prisma.$transaction` ile atomic; herhangi bir row patlarsa job FAILED, hiçbir row commit edilmez.
- [x] **File scan** — multer / formidable CSV mime + extension check; PDF/EXE/imzalı dosyalar reddedilir.

## Migration / backward compat

- `ServiceProvider.externalCode` nullable kolon eklenir; mevcut rowlar `null` kalır.
- `ProviderImportJob` yeni tablo.
- `AdminPermission` seed: `provider.import` row'u ekle.
- Re-import idempotent: aynı CSV ikinci kez commit edilirse → 0 değişiklik + AuditLog "noop" entry. Bu özellik QA'in onayı gerektirir (dry-run her zaman aynı diff'i göstermeli).

## Etkilenen mevcut özellikler

- Mevcut `apps/admin/src/app/(admin)/providers/page.tsx` — sadece nav link eklenir.
- Sprint 3 seed JSON source-of-truth `repo/data/providers.json` (D15 referansı) bu import job ile DB'ye aktarılır — manuel `prisma db seed` yerine deploy script bu endpoint'i çağırır (admin token ile).
- `apps/admin/src/app/(admin)/providers/[providerId]/actions/` (cross-ref 51) — bu sayfa import'la yaratılan actions'u görür ve edit edilir.

## Test plan

- **Unit**
  - CSV parser boş hücre / fazla kolon / unicode BOM doğru handle
  - Zod schema: enum dışı değer, eksik required field, geçersiz URL
  - Idempotency: aynı CSV iki kez parse + diff → ikinci diff boş
- **Integration**
  - POST 200-row CSV dry-run → 200 OK in <5s, job inline
  - POST 1500-row CSV → 202 + jobId, background worker pickup
  - Commit job patlatma (örn. transaction timeout) → status=FAILED, hiçbir provider yaratılmamış
  - Errors.csv download: presigned URL 24h içinde valid, sonra 403
- **E2E**
  - Template indir → 3 fake partner satırı ekle → upload → dry-run → fix → commit → providers list'te 3 partner görünür
  - Aynı CSV ikinci yükleme → "0 created, 3 updated (no diff)" message
- **Manual / Performance**
  - 500-row CSV commit <30 sn (acceptance criteria); local + staging measure

## Açık sorular

1. Background job runner repo'da hazır mı? Eğer `packages/jobs` yoksa Sprint 2'de minimal `pg-boss` veya inline `setImmediate` + polling kullanılır (basit, sıralı işler için yeterli).
2. Errors.csv storage: S3/R2 erişimi var mı admin app'ten? Yoksa DB'de blob (uzun vadede kötü) veya `/tmp` (single-instance varsayım) — DevOps task.
3. Domain whitelist UI hangi doc? Bu doc onu tüketir ama yaratmaz; ayrı bir 55 numara doc gerekebilir veya 51'in altında.
4. `externalCode` ile mevcut rowları match etmenin yan etkisi: legacy partner'lar `null` taşır → ilk CSV import'ta `provider_name` matching fallback'i eklemek? MVP'de hayır, manuel script bir kerelik legacy partner'lara `externalCode` atar.
5. CSV içinde silme nasıl olur? "isDeleted" kolonu eklemek (`true` = soft delete) vs ayrı UI'da delete. MVP'de **CSV silme yok**, soft delete sadece doc 51 UI.
