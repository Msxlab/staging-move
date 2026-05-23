# Email Templates — Family & Pro Notifications

- **Status**: Proposed (Family/Pro launch, Sprint 2 invite + Sprint 4 polish)
- **Tier**: Cross-cutting
- **Related decisions**: D2 (owner-resolved entitlement + grace period), D9 (workspace invitation)
- **Related docs**: [04](./04-workspace-invitation.md), [06](./06-entitlements-system.md), [21](./21-family-checkout-flow.md), [31](./31-pro-checkout-flow.md), [11](./11-address-change-event-model.md), [35](./35-partner-sync-attempts.md), [64](./64-marketing-copy-updates.md), [67](./67-i18n-tr-en.md)

## Amaç

Family/Pro lansmanı için 12 yeni email template'i mevcut `EmailTemplate` + `EmailLog` infrastructure'ı üzerinde tanımlamak. Templates `EmailTemplate` rows olarak `seed-master.ts` (veya yeni `seed-emails.ts`) seed edilir, runtime'da `apps/web/src/lib/email-service.ts` `sendTemplated(slug, vars)` ile gönderilir, Resend webhook (`apps/web/src/lib/resend-webhook.ts`) delivery status'unu işler.

## Kapsam

**In scope**
- 12 yeni template seed (slug, subject EN+ES, HTML body, text body, variables list, category)
- Template variable contract documenting (her şablon için)
- Template seed dosyası `packages/db/prisma/seed-emails.ts` (yeni)
- HTML email sanitization (`apps/web/src/lib/email-html-sanitizer.ts` mevcut) ile uyumlu
- Trigger noktaları (hangi route handler / cron / webhook hangi template'i gönderir)
- Unsubscribe semantic (transactional vs promotional)
- In-app notification mirror (varsa `apps/web/src/lib/in-app-notifications.ts`)

**Out of scope**
- Email provider değişimi (mevcut Resend kalır)
- Branding/template framework migration (mevcut HTML/text dual pattern korunur)
- A/B subject line testing (Faz 2)
- Marketing campaign emails (lifecycle ≠ transactional, ayrı doc)

## User stories

- **US-66.1** — Owner workspace'e new member davet eder; davetli kişiye `workspace.invitation` email'i gider, "Accept Invite" CTA'sı `lf.io/invite/{token}` link'ine yönlendirir, 7 gün geçerli.
- **US-66.2** — 3 gün geçer, davet henüz kabul edilmedi; cron `workspace.invitation.reminder` email'i gönderir.
- **US-66.3** — Davet kabul edilir; owner'a `workspace.member.joined` email gider: "Sarah accepted your invite — they now have MEMBER access to Smith Household."
- **US-66.4** — Owner subscription Stripe payment fail nedeniyle expire eder; grace period başlar; tüm workspace üyelerine `workspace.owner_sub_expired` email gönderilir.
- **US-66.5** — Grace D+5; hala renewed değil; `workspace.owner_sub_grace_ending` email'i gönderilir ("2 days left").
- **US-66.6** — Owner ownership transfer eder; eski ve yeni owner'a `workspace.ownership_transferred` email gider.
- **US-66.7** — Member ekibe address-change event yarattı; workspace üyelerine (CHILD hariç) `address_change.event.created` info email'i gider.
- **US-66.8** — Event tamamlandı; oluşturana `address_change.event.completed` summary email (kaç hizmet, ne kadar sürdü).
- **US-66.9** — Kullanıcı partner button'a bastı (OPENED status), 7 gün geçti ama "Done" işaretlemedi; cron `partner_sync.attempt.followup` email gönderir.
- **US-66.10** — Family plan'a upgrade tamamlandı; Stripe receipt'in yanına `plan.upgraded.receipt` welcome email gider: "Welcome to Family! Here's how to invite your household."
- **US-66.11** — User downgrade etti Pro→Family; `plan.downgraded.notice` email değişen limitleri açıklar.

## Veri modeli

Mevcut tablolar yeterli (cross-ref schema:1203):

```prisma
model EmailTemplate {
  id, slug @unique, name, subject, body (HTML), category, variables (JSON), isActive, isDefault
}
model EmailLog {
  id, templateId, dedupeKey @unique, providerMessageId, to, subject, status, sentAt, openedAt, metadata
}
```

**`category`** alanı `SYSTEM | MARKETING | TRANSACTIONAL | NOTIFICATION` — yeni template'ler:
- Invitation + reminder → `TRANSACTIONAL`
- Member joined/removed → `NOTIFICATION`
- Owner sub expired/grace → `TRANSACTIONAL` (account-critical)
- Ownership transferred → `TRANSACTIONAL`
- Address change event created/completed → `NOTIFICATION`
- Partner sync followup → `NOTIFICATION` (opt-out OK)
- Plan upgraded/downgraded → `TRANSACTIONAL`

**`dedupeKey`** convention: `{template}.{primaryEntityId}.{periodKey}`. Örnek: `workspace.invitation.{inviteId}.initial`, `workspace.invitation.reminder.{inviteId}.d3`, `workspace.owner_sub_grace_ending.{workspaceId}.{graceWeekKey}`. Duplicate gönderim önlenir.

**`isDefault`** alanı: admin UI'da bu template'i `isDefault=true` olarak işaretlersek admin custom edit edilemez kilit. Yeni 12 template `isDefault=true` (lansmanda).

## API endpoint'leri

Yeni endpoint yok. Mevcut `email-service.ts` `sendTemplated(slug, { to, vars, dedupeKey })` yeterli. Webhook (`apps/web/src/app/api/webhooks/resend/route.ts`) bounce/open/click event'lerini `EmailLog`'a yazar (mevcut).

## Template catalog

12 yeni template. Tablo: slug, subject (EN), variables, trigger.

| Slug | Category | Subject (EN) | Subject (ES) | Variables (Mustache `{{var}}`) | Trigger source |
|---|---|---|---|---|---|
| `workspace.invitation` | TRANSACTIONAL | `You're invited to join {{workspaceName}} on LocateFlow` | `Te invitaron a unirte a {{workspaceName}} en LocateFlow` | `inviteeFirstName`, `inviterFullName`, `workspaceName`, `role`, `acceptUrl`, `expiresAt` (formatted), `helpUrl` | `POST /api/workspace/[id]/invite` (cross-ref 04) |
| `workspace.invitation.reminder` | TRANSACTIONAL | `Reminder: {{inviterFirstName}} is waiting for you on LocateFlow` | `Recordatorio: {{inviterFirstName}} te está esperando en LocateFlow` | `inviteeFirstName`, `inviterFullName`, `inviterFirstName`, `workspaceName`, `acceptUrl`, `expiresIn`, `helpUrl` | Cron daily, `WHERE acceptedAt IS NULL AND createdAt < NOW() - 3 DAYS AND reminderSentAt IS NULL` |
| `workspace.member.joined` | NOTIFICATION | `{{memberFirstName}} joined {{workspaceName}}` | `{{memberFirstName}} se unió a {{workspaceName}}` | `ownerFirstName`, `memberFullName`, `memberFirstName`, `memberEmail`, `role`, `workspaceName`, `workspaceUrl` | `POST /api/invite/[token]/accept` (cross-ref 04) |
| `workspace.member.removed` | TRANSACTIONAL | `You've been removed from {{workspaceName}}` | `Te eliminaron de {{workspaceName}}` | `memberFirstName`, `workspaceName`, `removedAt` (formatted), `dataExportUrl`, `helpUrl` | `DELETE /api/workspace/[id]/members/[userId]` |
| `workspace.owner_sub_expired` | TRANSACTIONAL | `Action required: {{ownerFirstName}}'s subscription expired` | `Acción requerida: la suscripción de {{ownerFirstName}} expiró` | `memberFirstName`, `ownerFullName`, `ownerFirstName`, `workspaceName`, `graceEndsAt` (formatted), `helpUrl` | Stripe webhook `customer.subscription.deleted` + grace start (cross-ref 06 D2) |
| `workspace.owner_sub_grace_ending` | TRANSACTIONAL | `2 days left: {{workspaceName}} access ends soon` | `Quedan 2 días: el acceso a {{workspaceName}} se acerca a su fin` | `memberFirstName`, `ownerFirstName`, `workspaceName`, `graceEndsAt`, `daysLeft` (int), `helpUrl` | Cron daily, grace D+5 |
| `workspace.ownership.transferred` | TRANSACTIONAL | `Ownership of {{workspaceName}} transferred` | `Propiedad de {{workspaceName}} transferida` | `recipientFirstName`, `oldOwnerFullName`, `newOwnerFullName`, `workspaceName`, `transferredAt`, `role` (you are now) | `POST /api/workspace/[id]/transfer-ownership` |
| `address_change.event.created` | NOTIFICATION | `{{creatorFirstName}} started a move: {{eventTitle}}` | `{{creatorFirstName}} inició una mudanza: {{eventTitle}}` | `recipientFirstName`, `creatorFullName`, `creatorFirstName`, `eventTitle`, `scopeType` (USER/ADDRESS/CUSTOM), `targetCount`, `eventUrl`, `moveDate` (if set) | `POST /api/address-change/events` |
| `address_change.event.completed` | NOTIFICATION | `Move complete: {{eventTitle}}` | `Mudanza completa: {{eventTitle}}` | `creatorFirstName`, `eventTitle`, `completedCount`, `skippedCount`, `failedCount`, `durationDays`, `summaryUrl` | Event status → COMPLETED (cross-ref 11) |
| `partner_sync.attempt.followup` | NOTIFICATION | `Did you finish updating your address with {{providerName}}?` | `¿Terminaste de actualizar tu dirección con {{providerName}}?` | `userFirstName`, `providerName`, `actionLabel` (e.g. "Change of Address"), `lastOpenedAt`, `markDoneUrl`, `unsubscribeUrl` | Cron daily, `PartnerSyncAttempt WHERE status=OPENED AND lastOpenedAt < NOW() - 7 DAYS` |
| `plan.upgraded.receipt` | TRANSACTIONAL | `Welcome to {{planDisplayName}} — here's what's new` | `Bienvenido a {{planDisplayName}} — esto es lo nuevo` | `firstName`, `planDisplayName` (Family/Pro), `priceLabel`, `interval`, `firstChargeAt`, `featureHighlights` (array — 3–5 bullets), `inviteUrl` (if Family/Pro), `helpUrl` | Stripe webhook `customer.subscription.created/updated` higher plan |
| `plan.downgraded.notice` | TRANSACTIONAL | `Your plan changes on {{effectiveAt}}` | `Tu plan cambia el {{effectiveAt}}` | `firstName`, `fromPlan`, `toPlan`, `effectiveAt`, `whatChanges` (array — bullets), `whatStaysSame` (array), `manageBillingUrl` | Stripe webhook `customer.subscription.updated` lower plan |

## Template bodies — skeleton

Tüm template'ler **HTML + text dual**. Sanitization `apps/web/src/lib/email-html-sanitizer.ts` ile pre-flight (script/style/iframe stripped, allowed tags whitelist).

Layout shell (tüm template'lerde paylaşılan):

```html
<!doctype html>
<html lang="{{lang}}">
  <body style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
    <header><img src="https://lf.io/email-logo.png" alt="LocateFlow" /></header>
    <main>{{contentBlock}}</main>
    <footer>
      <p>LocateFlow — Move once, update everywhere.</p>
      <p>
        <a href="{{helpUrl}}">Help</a> ·
        <a href="https://lf.io/account">Account</a>
        {{#if unsubscribeUrl}} · <a href="{{unsubscribeUrl}}">Unsubscribe</a>{{/if}}
      </p>
    </footer>
  </body>
</html>
```

Örnek `workspace.invitation` body (EN):

```html
<h1>You're invited to {{workspaceName}}</h1>
<p>Hi {{inviteeFirstName}},</p>
<p>{{inviterFullName}} invited you to join <strong>{{workspaceName}}</strong> on LocateFlow as a <strong>{{role}}</strong>.</p>
<p><a href="{{acceptUrl}}" class="btn">Accept invitation</a></p>
<p>This invitation expires on {{expiresAt}}.</p>
<p>Not sure what this is? <a href="{{helpUrl}}">Learn about workspaces</a>.</p>
```

Text version (her template için zorunlu):

```
You're invited to {{workspaceName}}

Hi {{inviteeFirstName}},

{{inviterFullName}} invited you to join {{workspaceName}} on LocateFlow as a {{role}}.

Accept: {{acceptUrl}}

This invitation expires on {{expiresAt}}.
```

Per template özel notlar:
- `workspace.owner_sub_expired` — ton: ciddi, ama panik yapma. "Read-only until renewed" net.
- `workspace.owner_sub_grace_ending` — daha urgent. "2 days left" rakam visible.
- `partner_sync.attempt.followup` — opt-out link (NOTIFICATION category, unsubscribe gerekli). User per-notification type opt-out edebilir (mevcut `User.notificationPreferencesJson` veya benzeri).
- `plan.upgraded.receipt` — Stripe receipt SEPARATE bir email zaten gönderiyor (Stripe webhook → Stripe ayrı email). Bu template **ek**: "welcome + onboarding" odaklı, Stripe receipt'in tamamlayıcısı.

## Unsubscribe semantic

| Template | Unsubscribe link? | Sebep |
|---|---|---|
| `workspace.invitation` | Hayır | Transactional, kullanıcı eylem bekliyor |
| `workspace.invitation.reminder` | Hayır | Aynı, 1 reminder OK |
| `workspace.member.joined` | Opt-out (per-pref) | Notification |
| `workspace.member.removed` | Hayır | Hesap güvenliği |
| `workspace.owner_sub_expired` | Hayır | Account-critical |
| `workspace.owner_sub_grace_ending` | Hayır | Account-critical |
| `workspace.ownership.transferred` | Hayır | Audit-critical |
| `address_change.event.created` | Opt-out | Notification |
| `address_change.event.completed` | Opt-out | Notification |
| `partner_sync.attempt.followup` | **Var** | Notification, kullanıcı isteyebilir off |
| `plan.upgraded.receipt` | Hayır | Transactional |
| `plan.downgraded.notice` | Hayır | Transactional |

User per-notification preference UI (`/account/notifications`) `partner_sync_followup_email: bool` flag'i ile takip. Mevcut `User.notificationPreferencesJson` (varsa) extend.

CAN-SPAM compliance: physical address footer'da (mevcut email layout'ta varsa), unsubscribe link transactional dışındaki tüm email'lerde.

## API endpoint'leri (devamı)

- `GET /api/account/notification-preferences` (mevcut/yeni)
- `PUT /api/account/notification-preferences` (mevcut/yeni)
- `POST /api/cron/email-reminders` (yeni Sprint 2) — invitation reminders + grace ending + partner followup'ları batch gönderir

## Web

### Yeni sayfa/route

- `/account/notifications` — per-notification opt-out UI (mevcut sayfaya yeni rows ekleme)
- `/invite/[token]` (cross-ref 04) — landing page, email link hedefi (zaten o doc'ta)

### Mevcut sayfalara etki

- Email-related admin sayfası `apps/admin/src/app/(admin)/email-templates/page.tsx` (mevcut) — yeni 12 template seed sonrası listede görünür, admin önizleyebilir + edit edebilir (isDefault=true ise kısıtlı)

### Componentler (file paths)

```
packages/db/prisma/seed-emails.ts        // yeni — 12 template seed
apps/web/src/lib/emails/                 // varsa burada her template için TSX/HTML asset
  workspace-invitation.html              // HTML kaynak
  workspace-invitation.txt               // Text kaynak
  workspace-invitation-reminder.html
  ... (12 set)
apps/web/src/lib/email-service.ts        // mevcut, yeni slug'lar otomatik destekler
apps/web/src/lib/email-html-sanitizer.ts // mevcut, değişmez
```

Eğer mevcut email'ler `react-email` (`@react-email/components`) ile build ediliyorsa, yeni template'ler aynı pattern'da `.tsx` componentleri olarak yazılır + build script'i HTML üretir.

### Butonlar / actionlar

Email butonları:
- "Accept invitation" → `{{acceptUrl}}` deep link (web + mobile fallback)
- "Mark as done" (`partner_sync.attempt.followup`) → `{{markDoneUrl}}` magic link, otomatik `PartnerSyncAttempt.status=DONE` set eder + login redirect

Magic link guvenligi: 30 günlük signed JWT, single-use, scope=`partner_attempt_mark_done:{attemptId}`. Mevcut `apps/web/src/lib/email-verification-gate.ts` benzeri pattern.

## Mobile

### Yeni ekran

Yok. Mobile email göndermez (server-side), sadece email link'leri mobile'a deep-link açar.

### Mevcut ekranlara etki

Email link → mobile deep-link mapping:
- `lf.io/invite/{token}` → `locateflow://invite/{token}` (varsa) → `app/invite/[token].tsx`
- `lf.io/workspace/{id}` → `locateflow://workspace/{id}`

Cross-ref 04 invite accept akışı detay verir.

## Admin

`apps/admin/src/app/(admin)/email-templates/page.tsx` mevcut UI yeni template'leri otomatik listeler. Önizleme: variable'ları fake data ile doldurup HTML render.

`apps/admin/src/app/(admin)/email-logs/page.tsx` (varsa, yoksa basit list) — gönderim log'larını filter (slug, status, dateRange) ile gezme.

## Güvenlik

- [x] **Step-up auth?** — Hayır, email send server-side trigger.
- [x] **PII redaction?** — Email subject ve body'de full email/address yer alır (zorunlu, kullanıcıya gönderilen mesaj). Log'larda `EmailLog.to` plaintext (mevcut policy). External analytics'e email gitmez (cross-ref 65 SENSITIVE class).
- [x] **Audit log?** — `EmailLog` zaten audit. Template değişikliği `EmailTemplate.updatedBy` + `updatedAt` tracked.
- [x] **Rate limit?** — Per-user per-template per-day cap: max 5 of same slug per 24h (dedupeKey önler ama defansif limit). Cron'lar idempotent (dedupeKey unique).
- [x] **Permission matris?** — Admin template edit `EMAIL_TEMPLATE_EDIT` permission. Owner-only template'ler (`workspace.owner_sub_expired`) sadece OWNER'a gönderilir (member değil — member için ayrı template).
- [x] **Encryption at rest?** — Standart DB encryption. EmailLog'da hassas içerik yok (subject + to + status).
- [x] **GDPR DSAR?** — Kullanıcının `EmailLog` rows'u DSAR export'unda yer alır (mevcut implementation kontrol et). Account delete → cascade siler (FK `onDelete: SetNull` template korunur ama log kullanıcıya bağlı `to` field korunur).
- [x] **SPF/DKIM/DMARC**: Mevcut Resend setup'ında geçerli; yeni template'ler aynı sender domain (`@lf.io` veya `@mail.locateflow.com`).
- [x] **Unsubscribe link tampering**: Signed token (HMAC) — kullanıcı kendi token'ı ile başkasını opt-out edemez.

## Migration / backward compat

- Mevcut email template'leri etkilenmez (additive seed)
- Yeni 12 template `seed-emails.ts` ile insert; `slug @unique` constraint dup'ı önler
- Migration script idempotent: re-run safe (`upsert` pattern)
- Mevcut Stripe receipt email'i (Stripe Dashboard tarafından gönderilen) korunur; bizim `plan.upgraded.receipt` **ek** olarak gönderilir (kullanıcı 2 email alır — kabul edilebilir, biri ödeme makbuzu, diğeri ürün welcome)

## Etkilenen mevcut özellikler

- `packages/db/prisma/seed-master.ts` — yeni `seed-emails.ts` import edilir
- `apps/web/src/lib/email-service.ts` — slug-based send mevcut, değişmez
- `apps/web/src/lib/in-app-notifications.ts` (varsa) — email gönderdiğimiz event'ler aynı zamanda in-app notification oluşturur (mirror)
- `apps/web/src/app/api/cron/email-reminders/route.ts` — yeni cron
- `apps/admin/src/app/(admin)/email-templates/` — UI otomatik listeler
- `apps/web/src/lib/resend-webhook.ts` — yeni slug'lar için ek logic gerekmez (slug-agnostic)

## Test plan

**Unit**
- Her template HTML sanitization geçer (`email-html-sanitizer` üzerinden round-trip)
- Variable interpolation: tüm `{{var}}` template'te tanımlı, missing var = render placeholder
- `dedupeKey` unique constraint: aynı invite için 2x reminder göndermez
- Subject < 200 char (DB constraint)

**Integration**
- `POST /api/workspace/[id]/invite` → `EmailLog` row insert, status=PENDING → Resend webhook → SENT
- Cron `email-reminders` → 5 eligible invite için 5 reminder, dedupeKey'ler unique
- Stripe webhook subscription.created → `plan.upgraded.receipt` queued

**E2E**
- Test inbox (Mailosaur veya temporary mailbox) ile:
  - Invite accept akışı email → link → web page → accept → owner notification email
  - Owner sub expired (test webhook trigger) → 4 üyeli workspace, 4 email + 1 owner email

**Manual**
- Email render quality: Litmus / Email on Acid (Gmail, Outlook, Apple Mail, iOS Mail, Android Gmail)
- Plain text version readable (dark mode email client'larda HTML fallback)
- Subject line preview (Gmail mobile 40 char limit) — kritik bilgi önde
- Unsubscribe akışı çalışır (link → opt-out kayıt → confirmation page)

## Açık sorular

1. `plan.upgraded.receipt` Stripe'ın gönderdiği receipt ile çakışıyor mu? Kullanıcı 2 email alıyor: (a) Stripe finansal makbuz, (b) bizim welcome. Daha temiz olabilir: Stripe receipt'i suppress et + bizimkine ödeme detayını ekle. Karar: legal/finance review.
2. ES çevirileri kim yapacak? Mevcut mesajlarda profesyonel çeviri var mı yoksa Google Translate baseline? Lansman öncesi native speaker review zorunlu.
3. TR template'leri Faz 1'de gerekli mi? Cross-ref 67 — TR/EN spec, ama ES mevcut, TR henüz yok. Email çeviri zincirine TR eklemek = template count 12 × 3 dil = 36 varyant. **Tercih**: Faz 1'de EN + ES (mevcut), TR cross-ref 67'de Faz 2'ye.
4. `partner_sync.attempt.followup` çok agresif mi? D+7 yeterli mi yoksa D+3 + D+14 iki kez mi? Engagement testing.
5. `workspace.member.joined` email NOTIFICATION ama owner için opt-out makul mu? Owner workspace'ini ciddiye alıyor; default ON. Opt-out kullanıcı isterse.
6. Email layout shell `react-email` mi yoksa raw HTML mi? Mevcut codebase pattern grep et — eğer `react-email` varsa o, yoksa raw HTML + sanitizer. Tercih: mevcut pattern devam.
7. Cron `email-reminders` rate-limit: 1000 invite reminder/dakika throttle (Resend tier'ına göre). Idle bekle yoksa Resend rate-limit 429.
