# Partner Deep-Link Launcher

- **Status**: Proposed (Family/Pro launch, Sprint 3)
- **Tier**: Pro
- **Related decisions**: D10, D15, D19
- **Related docs**: `01-architecture-decisions.md`, `06-entitlements-system.md`, `11-address-change-event-model.md`, `14-bulk-queue-dashboard.md`, `22-child-role.md`, `33-partner-hub-ui.md`, `34-service-provider-action-registry.md`, `35-partner-sync-attempts.md`, `37-partner-pdf-letter-generator.md`, `38-partner-mailto-templates.md`, `65-analytics-events.md`

## Amaç

Kullanıcının "Open & Update →" butonuna bastığında yaşadığı somut UX'i tarif etmek: server'a status update, clipboard'a adres kopya, partner URL'ini yeni sekmede aç, kullanıcı geri döndüğünde "Done ✓" işaretle, opsiyonel confirmation # gir. PDF ve mailto kanallarının varyantları. D15 gereği lansmanda hiçbir partner API çağrısı yok — sadece deep link + clipboard + PDF + mailto.

## Kapsam

**In scope**
- `<PartnerActionButton>` (web) ve `<PartnerActionPressable>` (mobile) componentleri
- Server-side URL template resolution (`apps/web/src/lib/url-template-resolver.ts`)
- Clipboard copy of new address (web `navigator.clipboard`, mobile `expo-clipboard`)
- New-tab open (web `window.open(_, '_blank', 'noopener')`, mobile `Linking.openURL`)
- Sync attempt PATCH `status=OPENED` (35)
- Toast notification + return UI ("Done ✓" / "Couldn't update" / "Skip")
- Optional confirmation # input modal
- PDF channel branch: download blob (37 PDF generator)
- mailto channel branch: open mail client (38 templates)
- Required field validation; "Missing accountNumber" prompt
- URL host whitelist re-check (defence in depth)
- Error states + analytics events (65)
- Permission gating (CHILD restricted, OVERFLOW read-only)

**Out of scope**
- Partner Hub UI (→ 33)
- ServiceProviderAction model + URL template syntax (→ 34)
- PartnerSyncAttempt state model (→ 35) — bu doc 35 API'sini consume eder
- PDF generator internals (→ 37)
- mailto template kütüphanesi (→ 38)
- Bulk queue UI (→ 14) — launcher 14'ten de çağrılır

## User stories

- **As a Pro user**, "Update Netflix address" tıklarım: 1) toast "Address copied to clipboard", 2) yeni sekmede Netflix billing açılır, 3) güncellemeyi yapıp geri dönerim, 4) "Done ✓" tıklarım, 5) attempt status DONE.
- **As a Pro user**, accountNumber gerekli bir action'a tıklarım ama servisimde yok → "Missing: accountNumber" modal → Service'i edit + tekrar deneyebilirim.
- **As a Pro user**, "Mail forwarding letter" (PDF kanalı) tıklarım → PDF indirme başlar, toast "Letter downloaded — print and mail it" + status OPENED, sonra "Done" işaretlerim.
- **As a Pro user**, doktor ofisi için mailto action tıklarım → varsayılan mail client açılır prefilled subject + body ile.
- **As a Pro user mobile**, "Open & Update" basarım → clipboard'a kopyala + browser yeni tab; geri döndüğümde mark done.
- **As a CHILD member**, sadece kendi servislerime bağlı launcher tıklayabilirim (22).
- **As a Pro user**, sahte/bilinmeyen URL'e yönlenen bir action (admin yanlışlıkla kaydetmiş) → client whitelist check 422 + toast "This link looks suspicious".

## Veri modeli

Bu doc yeni model yaratmaz. Consume eder:
- `ServiceProviderAction` (34) — `urlTemplate`, `channel`, `requiredFieldsJson`
- `PartnerSyncAttempt` (35) — PATCH target
- `AddressChangeEvent` (11) — `toAddress`, `fromAddress` placeholder source
- `Service` (mevcut) — `accountNumber`, `email` placeholder source
- `User` (mevcut) — `fullName` placeholder source

## API endpoint'leri

### Yeni
| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/api/sync-attempts/[id]/resolve-url` | required | required | — | `{ resolvedUrl, channel, requiredFieldsPresent: bool, missingFields: string[], clipboardText }` | 401, 403, 404, 409 (event not ACTIVE), 422 (URL host not whitelisted) |

**Neden ayrı endpoint?**: URL template substitution server-side yapılır (account number gibi PII placeholder'lar client'a plain göndermek istenir ama sadece resolve sırasında). Bu endpoint:
1. Sync attempt + event + service + provider action'ı load eder.
2. Required field check.
3. URL template resolve (Mustache substitute).
4. Whitelist host check.
5. `PATCH status=OPENED, openCount++, lastOpenedAt=now` aynı transaction.
6. Response döner.

Client tek istekle hem URL hem status update'i alır. İlave round-trip yok.

### Mevcut endpoint'lere etki

- `PATCH /api/sync-attempts/[id]` (35) — kullanılır "Done", "Skip", "Fail" için (status update + confirmation #).
- `POST /api/sync-attempts/[id]/pdf` (yeni — 37'de detay): channel=PDF için PDF blob döner; aynı zamanda status=OPENED yazar.

## Web

### Yeni sayfa/route
Hiçbiri — component-level.

### Mevcut sayfalara etki

- Partner Hub UI (33) `<PartnerActionList>` içinde her aksiyon `<PartnerActionButton>` render eder.
- Bulk Queue (14) her queue item'ında `<PartnerActionButton>` render eder.

### Componentler (file paths)

- `apps/web/src/components/partner/PartnerActionButton.tsx` (yeni) — main launcher button.
- `apps/web/src/components/partner/PartnerActionConfirmModal.tsx` (yeni) — return state: Done / Skip / Failed seçici + opsiyonel confirmation # input.
- `apps/web/src/components/partner/MissingFieldsModal.tsx` (yeni) — required field eksikse açılır.
- `apps/web/src/components/partner/SuspiciousUrlBanner.tsx` (yeni) — whitelist fail → uyarı.
- `apps/web/src/lib/url-template-resolver.ts` (yeni) — Mustache substitute (34 ile paylaşımlı).
- `apps/web/src/lib/url-whitelist.ts` (yeni veya mevcut admin lib'iyle paylaşımlı) — host check.

### Buton akış (web)

```
[Open & Update →] click
  │
  ├─► POST /api/sync-attempts/{id}/resolve-url
  │     │
  │     ├─► 200 { resolvedUrl, clipboardText, channel: DEEP_LINK }
  │     │     │
  │     │     ├─► navigator.clipboard.writeText(clipboardText)
  │     │     ├─► window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
  │     │     ├─► toast "Address copied. Mark done when finished."
  │     │     └─► open <PartnerActionConfirmModal>
  │     │           │
  │     │           ├─► "Done ✓" → PATCH status=DONE [+confirmationNumber]
  │     │           ├─► "Couldn't update" → PATCH status=FAILED + notes
  │     │           └─► "Skip" → PATCH status=SKIPPED
  │     │
  │     ├─► 422 { missingFields: ["accountNumber"] }
  │     │     └─► <MissingFieldsModal> → "Edit Service" link
  │     │
  │     └─► 422 SUSPICIOUS_URL
  │           └─► <SuspiciousUrlBanner> + Sentry log
  │
  ├─► channel=PDF: POST /api/sync-attempts/{id}/pdf → blob download
  └─► channel=MAILTO: window.location.href = `mailto:...?subject=...&body=...`
```

### Butonlar / actionlar

| Aksiyon | Davranış |
|---|---|
| Primary "Open & Update →" | Resolve + open + status OPENED |
| "Done ✓" (modal) | PATCH status=DONE |
| "Add confirmation #" toggle | Reveals input |
| "Couldn't update" (modal) | PATCH status=FAILED + notes textarea |
| "Skip — handled elsewhere" | PATCH status=SKIPPED |
| "Copy address again" (toast secondary) | navigator.clipboard.writeText |
| "Open link again" | window.open + openCount++ (PATCH resolve-url) |

## Mobile

### Yeni ekran

Hiçbiri — component-level.

### Mevcut ekranlara etki

- Partner Hub (33) ve Bulk Queue (14) mobile equivalent'ları `<PartnerActionPressable>` render eder.

### Componentler

- `apps/mobile/src/components/partner/PartnerActionPressable.tsx` (yeni) — RN button + bottom sheet for confirm.
- `apps/mobile/src/components/partner/PartnerActionConfirmSheet.tsx` (yeni) — bottom sheet variant of confirm modal.
- `apps/mobile/src/components/partner/MissingFieldsSheet.tsx` (yeni).

### Mobile akış

```
press → POST /api/sync-attempts/{id}/resolve-url
  ├─► await expo-clipboard setStringAsync(clipboardText)
  ├─► await Linking.openURL(resolvedUrl)
  ├─► Toast (react-native-toast-message) "Address copied"
  └─► Bottom sheet "Done ✓ / Couldn't update / Skip"
```

PDF channel:
- `expo-file-system.downloadAsync` → cache dir → `expo-sharing.shareAsync` → user prints/mails.

mailto channel:
- `Linking.openURL("mailto:...")` → default mail app.

## Admin

### Yeni sayfa / Yetenekler

Bu doc admin sayfası eklemiyor. Admin "test launch" tool faz 2.

## Güvenlik

- [ ] **Step-up auth**: Event create zaten step-up almıştır (D10/D19). Per-button step-up yok. **Karar D10 net**.
- [x] **PII redaction**: Resolved URL `{{accountNumber}}` içerebilir (kişiye özel). Log'lara **unresolved template** yazılır, resolved string asla. `clipboardText` server log'da redacted.
- [x] **Audit log**: `AddressChangeAuditLog` — `partner_action_launched` (actor, attemptId, channel, urlHost), `partner_action_completed` (status). 35 ile aynı log table.
- [x] **Rate limit**: `/api/sync-attempts/[id]/resolve-url` user başına 120/dk (legit bulk).
- [x] **Permission matris**: workspace member event sahibi workspace'inde + role uygun (35 permission rules). CHILD only own-target attempts. VIEW_ONLY launcher disabled.
- [ ] **Encryption at rest**: Service.accountNumber zaten encrypted (`packages/shared/src/encryption.ts`). Resolve sırasında decrypt + substitute + dispose. Resolved URL response body — TLS şart, log'lanmaz.
- [x] **GDPR DSAR**: Attempts (35) ve event'ler zaten dahil. Launcher ek persist yapmaz (audit log dışında).

### URL whitelist (defence in depth)

Server-side `apps/web/src/lib/url-whitelist.ts`:

```ts
const ALLOWED_PARTNER_HOSTS = new Set([
  "moversguide.usps.com","www.netflix.com","www.amazon.com","www.chase.com",
  // ... 100+ entries, derived from seed catalog
]);

export function isWhitelistedPartnerUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_PARTNER_HOSTS.has(u.host);
  } catch { return false; }
}
```

`mailto:` ve PDF kanalı whitelist'ten muaf (URL değil zaten).

Client-side re-check (`<PartnerActionButton>`): server 200 dönmüş bile olsa client URL parse + host check; mismatch → block + Sentry. Bu defence-in-depth saldırgan server response interception'a karşı.

## Migration / backward compat

- Yeni endpoint, yeni component'ler. Migration yok.
- ServiceProviderAction (34) ve PartnerSyncAttempt (35) tabloları olmadan launcher çalışmaz; sıra: 34 → 35 → 36.
- Whitelist initial set seed catalog'dan üretilir (build-time script: `pnpm gen:partner-whitelist`).

## Etkilenen mevcut özellikler

- Partner Hub UI (33) — primary host.
- Bulk Queue (14) — primary host.
- Sync attempt API (35) — heavy reader/writer.
- Analytics (65) — `partner_action_launched`, `partner_action_completed`, `partner_action_failed`.
- PDF templates (37) — channel branch.
- mailto templates (38) — channel branch.

## Test plan

**Unit**
- `url-template-resolver`: substitute all placeholders; missing → required field error.
- `url-whitelist`: known host → true; evil.com → false; http:// → false.
- Confirm modal state machine: Done → status DONE, opens PATCH.

**Integration**
- `POST /api/sync-attempts/{id}/resolve-url` with Pro user + valid event → 200 + resolved URL + status moves to OPENED.
- Same endpoint with missing accountNumber → 422 + missingFields=["accountNumber"].
- Same with manually-tampered URL host → 422 + log entry.
- CHILD user on someone else's attempt → 403.
- Rate limit 121/min → 429.

**E2E (Playwright)**
- Pro user opens Bulk Queue, clicks Netflix "Open & Update":
  - Mock window.open + clipboard read.
  - Expects status badge change to OPENED.
  - Click "Done" in modal → status DONE.
- PDF channel: click → expects blob download (Playwright download API).
- mailto channel: click → expects `mailto:` href triggered.

**Manual**
- iOS Safari: `window.open(_,'_blank')` popup blocker'a takılıyor mu? Fallback: `<a target="_blank">` direct link.
- Mobile: `Linking.openURL` partner site açar mı (uniwebview vs in-app browser kararı — mevcut RN default behavior).
- Slow 3G: resolve-url latency, optimistic UI flicker.
- Permission denied clipboard (insecure context, Firefox private) → graceful "address shown above, copy manually" fallback.

## Açık sorular

- iOS Safari popup blocker: `window.open` synchronous click içinde yapılmalı; resolve-url async ise blocked olur. **Çözüm**: önce `const w = window.open('about:blank')` aç, sonra resolve-url'ye `await`, sonra `w.location = resolvedUrl`. Test gerekir.
- Mobile in-app browser vs system browser preference? `Linking.openURL` system browser açar (default), kullanıcıyı LocateFlow'dan ayırır. Alternatif: `expo-web-browser` in-app. Önerilen: system (cookies + autofill için kritik). Karar: system.
- Confirmation # zorunlu mu opsiyonel mi? Önerilen: opsiyonel (USPS gibi büyük partner verir, küçük partner vermez).
- "Done" sonrası otomatik bir sonraki queue item'ına geç mı? Önerilen: Bulk Queue (14) içinde "auto-advance" toggle.
- Whitelist'i kim maintain eder? Build-time gen + manual override list. Devops ownership PR'da.
- Analytics 65 event payload schema bu doc'ta vs 65'te — 65 kaynak.
