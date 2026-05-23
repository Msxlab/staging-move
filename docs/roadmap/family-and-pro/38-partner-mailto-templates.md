# Partner Mailto Templates

- **Status**: Proposed (Pro launch, Sprint 3)
- **Tier**: Pro (Family görür-kilitli, Individual/Free görmez)
- **Related decisions**: D15 (Day 1 = mailto kanalı dahil), D7 (PartnerSyncAttempt openCount), D10 (event-level step-up)
- **Related docs**: [34](./34-service-provider-action-registry.md), [35](./35-partner-sync-attempts.md), [36](./36-partner-deep-link-launcher.md), [37](./37-partner-pdf-letter-generator.md), [51](./51-admin-provider-actions-crud.md), [67](./67-i18n-tr-en.md)

---

## Amaç

Email ile adres değişikliği kabul eden partner'lar (küçük SaaS, lokal hizmet sağlayıcı, abonelik servisi) için **kullanıcının default mail client'ini açan `mailto:` link** üretir. Body ve subject template'i ServiceProviderAction'da tutulur, server placeholder substitution yapar, client `mailto:` URL'ini açar. Backend SMTP YOK — D15 gereği lansmanda hiçbir partner için outbound mail göndermiyoruz, sadece kullanıcının kendi mail account'undan göndermesini kolaylaştırıyoruz.

## Kapsam

**In scope (MVP)**
- `ServiceProviderAction.mailtoTo`, `mailtoSubjectTemplate`, `mailtoBodyTemplate` kolonları
- Template variable substitution server-side (`{{userName}}`, `{{oldAddress}}`, `{{newAddress}}`, `{{accountNumber}}`, `{{serviceName}}`, `{{effectiveDate}}`)
- `mailto:` URL üretimi: subject + body `encodeURIComponent`, newline → `%0D%0A`
- Web: `<a href="mailto:..." target="_blank">` + click handler → `PATCH attempt status=OPENED`
- Mobile: `Linking.openURL('mailto:...')` + status PATCH
- TR/EN locale support (cross-ref [67](./67-i18n-tr-en.md))
- Length guard: client-side warning eğer body > 1800 char (mail client truncate riski)

**Out of scope**
- Server-side outbound mail (Faz 2, SMTP gerekirse)
- HTML mail (mailto: HTML body desteklemez)
- CC/BCC support (Faz 2, low value)
- Attachment otomatik (PDF mektup attachment) — mailto: standardı izin vermez; kullanıcı manual attach eder
- Template'lerin admin UI'dan editlenmesi DB row üzerinden yapılır (cross-ref [51](./51-admin-provider-actions-crud.md))

## User stories

- As Pro user, partner'ın support@x.com'una adres güncelleme talebi göndermek için **tek tıkla mail client'imi açabileyim** ve body otomatik dolu gelsin.
- As Pro user, body'de **eski adresimi, yeni adresimi, hesap numaramı** prefilled görmek isterim — kopyala-yapıştır hatası olmasın.
- As Pro user, mail'i **kendi adresimden** göndermeliyim (partner reply-to için) — bizim sunucudan gönderim partner spam filter'ına takılır.
- As admin, mailto body template'ini DB'den **edit edebileyim**; deploy beklemeden düzeltebileyim (typo, partner email değişimi vs.).

## Veri modeli

`ServiceProviderAction` üzerine eklenir (cross-ref [34](./34-service-provider-action-registry.md)):

```prisma
model ServiceProviderAction {
  // ... mevcut alanlar + actionType (cross-ref 37) ...

+ mailtoTo                String? @db.VarChar(191)
+   // örn: "support@example.com"; required eğer actionType=MAILTO
+ mailtoCc                String? @db.VarChar(191)
+   // virgül-ayrılmış liste, MVP genelde null
+ mailtoSubjectTemplate   String? @db.VarChar(300)
+   // örn: "Address change request — {{accountNumber}}"
+ mailtoBodyTemplate      String? @db.Text
+   // multi-line, {{placeholder}} substitution; <2000 char önerilir
+ mailtoBodyLocale        String? @db.VarChar(5)
+   // null ise kullanıcı locale'inden türetilir
}
```

**Yeni invariant** (app-level, DB constraint değil): `actionType=MAILTO` ise `mailtoTo` + `mailtoSubjectTemplate` + `mailtoBodyTemplate` non-null olmalı. Admin save sırasında validate edilir.

Migration: eski action'lar `actionType=DEEP_LINK` alır, mailto kolonları null kalır.

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/partner-actions/:attemptId/mailto` | session cookie | `requireWorkspaceContext` | — | `200 { mailtoUrl: string, subject: string, body: string, to: string, expiresAt: ISO8601 }` | 401, 403 (cross-workspace), 404, 409 (actionType !== MAILTO), 422 (template variable çözülemedi), 429 |
| POST | `/api/partner-actions/:attemptId/mailto/opened` | session cookie | `requireWorkspaceContext` | `{}` | `204` (status=OPENED damgalandı) | 401, 403, 404 |

**Neden iki endpoint?** Web'de `<a href>` kullanıyoruz ama default mail client açıldığını backend'e bildirmek için ayrı POST atıyoruz (click handler ile). Tek endpoint'te yapamayız çünkü `<a href="mailto:">` request response cycle'a girmez.

**`/mailto` server logic** (`apps/web/src/app/api/partner-actions/[attemptId]/mailto/route.ts`):
1. `requireWorkspaceContext`
2. Attempt + event + provider + action yükle, `actionType==='MAILTO'` doğrula
3. Variable context build: `{ userName, oldAddress, newAddress, accountNumber, serviceName, effectiveDate }`
4. `subject = renderTemplate(action.mailtoSubjectTemplate, context, locale)`
5. `body = renderTemplate(action.mailtoBodyTemplate, context, locale)`
6. `mailtoUrl = 'mailto:' + encodeURIComponent(action.mailtoTo) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body)`
7. **NO** AuditLog burada — sadece URL üretimi, henüz açılmadı
8. Response: JSON

**`/mailto/opened` server logic**:
1. Attempt'i `OPENED` damgala, `openCount++` (D7)
2. AuditLog: `action="OPEN", entityType="PartnerMailto", entityId=attemptId`

**Rate limit**: 60/dk/user (URL generation cheap; opened endpoint bağımsız).

### Mevcut endpoint'lere etki

- `/api/partner-actions/:attemptId/launch` (cross-ref [36](./36-partner-deep-link-launcher.md)) — `actionType==='MAILTO'` ise `mailtoUrl`'i response body'sine ekler (308 redirect değil; client URL'i `window.location.href` ile setler).
- `/api/events/:eventId` response'ta her attempt için `availableChannel` field'ı (`PDF | MAILTO | DEEP_LINK | PHONE | IN_PERSON`).

## Web

### Yeni sayfa/route

Yok.

### Mevcut sayfalara etki

- **Partner Hub** (cross-ref [33](./33-partner-hub-ui.md)) — `actionType==='MAILTO'` action card CTA: "Send email" (Mail icon).
- **Bulk Queue** (cross-ref [14](./14-bulk-queue-dashboard.md)) — attempt row'da Mail icon.

### Componentler (file paths)

- `apps/web/src/components/partner-hub/SendMailButton.tsx`:
  ```ts
  // 1. fetch GET /api/partner-actions/{id}/mailto
  // 2. window.location.href = mailtoUrl
  //    (window.open() bazı browser'da popup blocker'a takılır)
  // 3. setTimeout 500ms → fetch POST /api/partner-actions/{id}/mailto/opened
  //    (mail client açıldığını varsayıyoruz; pessimistic yapamayız çünkü mail client açılıp açılmadığını JS göremez)
  // 4. UI status badge "Opened" göster
  ```
- `apps/web/src/lib/partner/renderTemplate.ts` — server-side; `{{var}}` regex substitution, escape değil (mailto body plaintext; ama newline `\n` → `\r\n` normalize)
- `apps/web/src/lib/partner/buildMailtoUrl.ts` — URL builder; encodeURIComponent her parça

### Butonlar / actionlar

- **Send email** — Action card. Click: GET mailto URL → location set → opened ping.
- **Copy email body** (sekonder) — Mail client açmadan body'yi clipboard'a kopyala (kullanıcı webmail'de paste eder). UX: "Copy" buton + ikinci POST opened.
- **Mark as sent** — attempt status `DONE` damgalar (cross-ref [35](./35-partner-sync-attempts.md)).

## Mobile

### Yeni ekran

Yok.

### Mevcut ekranlara etki

`apps/mobile/app/(workspace)/partner-hub/[providerId].tsx` — MAILTO action butonu eklenir.

### Componentler

- `apps/mobile/src/features/partner/SendMailButton.tsx`:
  ```ts
  import * as Linking from 'expo-linking';
  const { mailtoUrl } = await apiClient.get(`/api/partner-actions/${id}/mailto`);
  const canOpen = await Linking.canOpenURL(mailtoUrl);
  if (!canOpen) {
    // iOS: mail app silinmiş; Android: default mail client yok
    showAlert('No mail app installed. Copy and use webmail?');
    return;
  }
  await Linking.openURL(mailtoUrl);
  await apiClient.post(`/api/partner-actions/${id}/mailto/opened`);
  ```
- `apps/mobile/src/lib/api/partnerActions.ts` — `getMailto(attemptId)`, `markMailOpened(attemptId)`.

iOS not: `mailto:` URL `Linking.canOpenURL`'de Info.plist `LSApplicationQueriesSchemes` array'inde `mailto` içermesi gerekir. Mevcut config'i kontrol et, yoksa ekle.

## Admin

### Yeni sayfa

Yok. Mevcut Provider Actions CRUD'da (cross-ref [51](./51-admin-provider-actions-crud.md)) `actionType==='MAILTO'` seçilince **3 ek field** açılır:
- "Recipient email" (`mailtoTo`) — required, email validate
- "Subject template" (`mailtoSubjectTemplate`) — required, max 300 char, placeholder helper button paneli
- "Body template" (`mailtoBodyTemplate`) — required textarea, char counter (warning 1800+)

### Yetenekler

- **Placeholder helper**: editor yanında "{{userName}}, {{oldAddress}}, {{newAddress}}, {{accountNumber}}, {{serviceName}}, {{effectiveDate}}" chip listesi — tıklayınca cursor'a insert eder.
- **Preview with sample data**: admin için sahte context ile rendered subject + body göster. URL encode preview (debugging).
- **Smoke send button**: admin'in kendi email'ine bu template ile gerçek mailto açar (QA aracı).

## Güvenlik

- [x] **Step-up auth?** Hayır — D10/D19 event-level challenge yeterli.
- [x] **PII redaction?** Mailto body kullanıcının PII'sini içerir; bu zaten kullanıcının kendi mail account'undan gönderiyor, yeni risk yok. Sunucudaki AuditLog'a body **yazılmaz** — sadece `action`, `attemptId`, `providerId`. URL'de `attemptId` opaque cuid.
- [x] **Audit log?** `OPEN` event'i evet (`AuditLog action="OPEN", entityType="PartnerMailto"`). `GET /mailto` URL generation log'lanmaz (noise olur). Admin template değişikliği `AdminAuditLog`.
- [x] **Rate limit?** 60/dk/user (RateLimitBucket).
- [x] **Permission matris?** OWNER/ADMIN/MEMBER attempt'i tetikleyebilir. CHILD: kendi target olduğu attempt için (cross-ref [22](./22-child-role.md)). VIEW_ONLY: GET edebilir ama "Mark sent" PATCH yapamaz.
- [x] **Encryption at rest?** Hesap no DB'de encrypted, render anında decrypt edilip mailto body'ye yazılır. URL transient, disk'e değmez. Tarayıcı history'sinde `mailto:` URL'leri saklanabilir — bu işletim sistemi davranışı, bizim kontrolümüzde değil; ToS'ta uyarı (cross-ref `packages/shared/src/legal.ts`).
- [x] **GDPR DSAR?** Audit log entry'leri DSAR export'a dahil. Template'lerin kendisi user-data değil, public ServiceProvider config.

**Ek güvenlik**: Template injection guard — admin `{{customField}}` yazarsa ve karşılığı yoksa `[?]` yerine **render fail** + 422 (silent fail injection riski azaltır). Newline normalization `\n` → `\r\n` (RFC 6068 önerir).

## Migration / backward compat

- Schema migration tek seferde 4 kolon ekler (nullable).
- Seed script (cross-ref [34](./34-service-provider-action-registry.md)) Sprint 3'te 50 partner için en az 20'sine `actionType=MAILTO` set eder (küçük SaaS, abonelik servisleri).
- Eski Partner Hub UI MAILTO action'ı görürse `actionType` field'ı yoksa default DEEP_LINK fallback (graceful).

## Etkilenen mevcut özellikler

- Yok — yeni veri akışı, mevcut bir şeyi bozmaz.
- `apps/mobile/app.json` veya `expo` config'de `ios.infoPlist.LSApplicationQueriesSchemes` array'ine `mailto` ekle (zaten varsa no-op).

## Test plan

**Unit**
- `renderTemplate({{userName}}, {userName:"Ali"})` → `"Ali"`
- Eksik variable → throw, 422 surface
- `buildMailtoUrl` — newline `\r\n` encode, quoted-printable değil (mailto: standartı raw + URL encode)
- Subject 200 char + body 1500 char → URL < 4096 char guard

**Integration**
- `GET /api/partner-actions/:id/mailto` 200 + valid mailto URL
- Başka workspace → 403
- actionType=DEEP_LINK → 409
- `POST /opened` → AuditLog row + status=OPENED + openCount++

**E2E (Playwright)**
- Click "Send email" → assert `window.location.href` set edildi (puppeteer mailto açmaz; URL'i intercept et)
- `opened` POST tetiklendi
- UI badge "Opened" güncellendi

**Manual**
- iOS Mail / Gmail iOS / Outlook iOS: mailto URL doğru açılıyor, body doğru görünüyor, Türkçe karakterler (ş, ğ, ü) bozulmuyor (UTF-8)
- Android Gmail / Outlook: aynı
- macOS Mail / Outlook / Thunderbird: aynı
- Webmail (Gmail web): default mail handler tanımlıysa açılıyor
- Body 2500 char: bazı client truncate ediyor → warning UI'da çıkıyor

## Açık sorular

1. mailto URL Chrome'da 32k char limit, Safari 65k, Outlook 2k — **MVP guard 1800 char body warning** doğru mu? Telemetri ekleyip ilk 30 gün gözlemleyelim.
2. Kullanıcı mail'i göndermeden mail client'i kapatırsa `OPENED` damgası yanlış mı oluyor? **Karar**: `OPENED` "mail client açıldı" anlamında, "send edildi" değil. Kullanıcı `DONE` damgalayana kadar UI'da "Pending confirmation" gösterilir.
3. Reply-to handling: partner reply atarsa kullanıcının mail account'una gider, biz görmüyoruz. Bu sorun değil ama UX'te "Bizden değil senden gidiyor, reply senin inbox'ına düşer" disclaimer'ı gerekebilir.
4. Spam riski: kullanıcı bir partner için 50 kez "Send email" basabilir, 50 mail gider. `openCount > 5` → confirm modal'ı. **Karar**: Sprint 4 polish.
5. Email signature: partner kullanıcının email'inde signature görmek isteyebilir; biz body'e ekleyemeyiz, kullanıcı kendi mail client'inde signature ekler. Doc'ta açıkça yazılır.
