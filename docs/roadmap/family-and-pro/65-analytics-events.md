# Analytics Events — Family & Pro Launch Tracking

- **Status**: Proposed (Family/Pro launch, Sprint 1 infra + per-sprint event addition)
- **Tier**: Cross-cutting
- **Related decisions**: D2 (entitlement), D11 (mobile), D12 (iOS conflict), D17 (migration)
- **Related docs**: [06](./06-entitlements-system.md), [21](./21-family-checkout-flow.md), [33](./33-partner-hub-ui.md), [16](./16-step-up-auth-flow.md), [40](./40-tax-property-export.md), [63](./63-entitlement-banners-empty-states.md), [66](./66-email-templates.md)

## Amaç

Family/Pro lansmanını veriyle değerlendirebilmek için tüm yeni özelliklerin **standart event şeması** üzerinden track edilmesi. Mevcut `UserEvent` tablosu (`schema.prisma:948`) primary store; mobile + web event'leri **aynı isim setini** kullanır; PII'yi event property'lerine sokmayız.

## Kapsam

**In scope**
- 20+ yeni event tipi tanımı (workspace, plan, address-change, partner, entitlement, step-up, ios-conflict, export)
- Event property şeması + PII sınıflandırması (NONE / PSEUDONYMOUS / SENSITIVE)
- Server-side emit pattern (route handler içinde `recordUserEvent`)
- Client-side emit pattern (web `apps/web/src/lib/analytics.ts` `trackEvent()`, mobile karşılığı)
- External analytics (PostHog/Segment varsa) hash'leme strategy
- Weekly aggregation digest (admin dashboard veya cron'la slack)
- Privacy policy update (`/privacy` sayfası — analytics disclosure)

**Out of scope**
- BI dashboard'larının üretimi (Metabase / Looker setup ayrı ops effort)
- A/B test framework (cross-ref Faz 2)
- Funnel analysis methodology (ayrı analytics doc)
- Cohort retention math

## User stories

N/A — developer/PM-facing. Kullanıcı görmez, ama veriye dayalı karar verme yetisi ekler.

## Veri modeli

Mevcut `UserEvent` tablosu (schema.prisma:948) **yeterli**, ekstra kolon gerekmez:

```prisma
model UserEvent {
  id        String   @id @default(cuid())
  userId    String
  sessionId String?
  event     String   @db.VarChar(50)   // event name
  page      String?  @db.VarChar(200)  // varsa
  metadata  String?  @db.Text          // JSON: properties
  createdAt DateTime @default(now())
}
```

`event` VARCHAR(50) — yeni event isimlerinin tamamı bu limit içinde (en uzun: `partner_sync.attempt.completed` 30 char). `metadata` JSON string olarak property bag.

**Index kontrolü**: `@@index([event])` zaten var → event-by-event sorgu hızlı. `@@index([userId, event])` cohort sorgular için yeterli. Yeni index gerekmez.

**Yeni kolon ihtiyacı yok** ama best-practice için `metadataParsed` (JSON column) düşünülebilir Faz 2. MVP'de `Text` yeterli.

## API endpoint'leri

Yeni endpoint yok. Mevcut `recordUserEvent(userId, event, props)` server util (yoksa yaratılır: `apps/web/src/lib/user-events.ts`) tüm route'lardan çağrılır. Client-side `trackEvent(name, params)` (`apps/web/src/lib/analytics.ts:175` mevcut).

## Event catalog

Tüm event'ler `domain.action[.outcome]` notation. Sınıflandırma:
- **NONE**: property hiçbir kişisel/hassas veri içermez (ID'ler hash'li veya internal cuid)
- **PSEUDONYMOUS**: internal ID'ler (workspaceId, providerCode) — birleştirilirse kişi bağlanır, kendi başına PII değil
- **SENSITIVE**: financial/address/email property'leri — **bunlar event'e konmaz**, blocked

| Event name | Trigger | Properties (key: type, classification) | PII class | Surface |
|---|---|---|---|---|
| `workspace.created` | New workspace yaratılır | `workspaceId: string PSEUDONYMOUS`, `plan: enum NONE`, `source: enum{signup, upgrade, migration} NONE` | PSEUDONYMOUS | web, mobile |
| `workspace.invite.sent` | Invite email gönderilir | `workspaceId PSEUDONYMOUS`, `role: enum NONE`, `inviteId: string PSEUDONYMOUS` | PSEUDONYMOUS | web |
| `workspace.invite.accepted` | Invite kabul edildi | `workspaceId PSEUDONYMOUS`, `role: enum NONE`, `inviteId PSEUDONYMOUS`, `daysToAccept: int NONE` | PSEUDONYMOUS | web, mobile |
| `workspace.invite.expired` | Expire (cron) | `workspaceId PSEUDONYMOUS`, `inviteId PSEUDONYMOUS`, `reason: enum NONE` | PSEUDONYMOUS | server (cron) |
| `workspace.member.removed` | Member kick | `workspaceId PSEUDONYMOUS`, `role: enum NONE`, `byOwner: bool NONE`, `reason: enum NONE` | PSEUDONYMOUS | web |
| `workspace.role.changed` | Role değişti | `workspaceId PSEUDONYMOUS`, `fromRole: enum NONE`, `toRole: enum NONE` | PSEUDONYMOUS | web |
| `workspace.ownership.transferred` | Ownership devir | `workspaceId PSEUDONYMOUS`, `oldOwnerHash: string PSEUDONYMOUS`, `newOwnerHash: string PSEUDONYMOUS` | PSEUDONYMOUS | web |
| `plan.upgraded` | Stripe webhook subscription.updated → higher plan | `from: enum NONE`, `to: enum NONE`, `source: enum{web, mobile} NONE`, `interval: enum{monthly, yearly} NONE` | NONE | server (webhook) |
| `plan.downgraded` | Stripe webhook → lower plan | `from: enum NONE`, `to: enum NONE`, `reason: enum{user, payment_failure, admin} NONE` | NONE | server |
| `plan.canceled` | Subscription cancel | `plan: enum NONE`, `reason: enum NONE`, `daysSinceStart: int NONE` | NONE | server |
| `plan.trial.ended` | Trial expire | `convertedTo: enum NONE`, `daysUsed: int NONE` | NONE | server (cron) |
| `address_change.event.created` | Event oluşur (cross-ref 11) | `scopeType: enum{USER, ADDRESS, CUSTOM} NONE`, `targetCount: int NONE`, `serviceCount: int NONE`, `workspaceId PSEUDONYMOUS` | PSEUDONYMOUS | web |
| `address_change.event.completed` | Tüm target'lar DONE | `eventId PSEUDONYMOUS`, `durationMin: int NONE`, `completedCount: int NONE`, `skippedCount: int NONE`, `failedCount: int NONE` | PSEUDONYMOUS | web, mobile |
| `address_change.event.canceled` | User cancel | `eventId PSEUDONYMOUS`, `progressPercent: int NONE` | PSEUDONYMOUS | web |
| `partner_sync.attempt.opened` | "Open & Update →" tıklandı | `providerCode: string NONE`, `actionType: enum NONE`, `channel: enum{web, mobile} NONE`, `openCount: int NONE` | NONE | web, mobile |
| `partner_sync.attempt.completed` | User "Done" işaretledi | `providerCode NONE`, `actionType NONE`, `durationSec: int NONE`, `confirmationProvided: bool NONE` | NONE | web, mobile |
| `partner_sync.attempt.failed` | User "Failed" işaretledi | `providerCode NONE`, `errorCode: enum NONE`, `notesProvided: bool NONE` | NONE | web, mobile |
| `partner_sync.attempt.skipped` | User "Skip" | `providerCode NONE`, `reason: enum NONE` | NONE | web, mobile |
| `partner.pdf_letter.generated` | PDF üretildi | `providerCode NONE`, `templateVersion: string NONE` | NONE | web |
| `partner.mailto.opened` | mailto: tıklandı | `providerCode NONE`, `templateVersion NONE` | NONE | web |
| `entitlement.banner.viewed` | Banner intersect | `placement: string NONE`, `currentPlan NONE`, `requiredPlan NONE`, `bannerType: enum NONE` | NONE | web, mobile |
| `entitlement.banner.clicked` | CTA tıklandı | `placement NONE`, `currentPlan NONE`, `requiredPlan NONE`, `action: enum{upgrade, manage, dismiss} NONE` | NONE | web, mobile |
| `entitlement.locked_feature.viewed` | LockedFeatureCard render | `feature: string NONE`, `currentPlan NONE`, `requiredPlan NONE` | NONE | web, mobile |
| `step_up_auth.requested` | Challenge create | `method: enum{password, totp, sms, email_otp} NONE`, `purpose: enum{address_change_event} NONE` | NONE | server |
| `step_up_auth.completed` | Challenge consume | `method NONE`, `durationSec: int NONE`, `attempts: int NONE` | NONE | server |
| `step_up_auth.failed` | Bad attempt | `method NONE`, `errorCode: enum NONE`, `attemptNumber: int NONE` | NONE | server |
| `ios_sub_conflict.shown` (D12) | 409 sırasında UI | `currentProvider: enum NONE`, `targetPlan NONE`, `currentPlan NONE` | NONE | web, mobile |
| `export.tax.generated` | Pro tax export | `year: int NONE`, `addressCount: int NONE`, `format: enum{csv, pdf} NONE` | NONE | web |
| `export.csv.generated` | Genel CSV export | `entity: enum NONE`, `rowCount: int NONE` | NONE | web |
| `pricing.cta.clicked` | Pricing kartı CTA | `plan: enum NONE`, `interval: enum NONE`, `source: enum{home, pricing_page, banner} NONE` | NONE | web |
| `pricing.toggle.changed` | Monthly/annual toggle | `from: enum NONE`, `to: enum NONE` | NONE | web |
| `workspace.switcher.opened` | Switcher dropdown açıldı | (boş) | NONE | web, mobile |
| `workspace.switcher.switched` | Workspace değişti | `fromWorkspaceId PSEUDONYMOUS`, `toWorkspaceId PSEUDONYMOUS` | PSEUDONYMOUS | web, mobile |

**Tablo özeti**:
- Toplam yeni event: 30
- NONE class: 22
- PSEUDONYMOUS class: 8
- SENSITIVE class: **0** (asla event'e koymayız)

## PII handling rules

1. **Email, full name, address, phone, account number, password** → asla event property'sine girmez. Code review checklist madde: "Bu event property'inde PII var mı?"
2. **userId** internal cuid (z'le başlayan 25 char) — PSEUDONYMOUS. External analytics'e göndermeden önce server-side hash: `sha256(userId + SECRET_SALT)` (8-char prefix).
3. **workspaceId, eventId, attemptId** internal cuid — PSEUDONYMOUS, raw OK internal store'da.
4. **providerCode** ("usps", "att", "comcast") — NONE, public bilgi.
5. **Eğer external analytics yoksa** (PostHog/Segment off), raw cuid'ler internal `UserEvent` store'da kalır. Hash'leme gerekmez.

## Server-side emit pattern

`apps/web/src/lib/user-events.ts` (yeni util):

```ts
export async function recordUserEvent(args: {
  userId: string;
  sessionId?: string;
  event: string;
  page?: string;
  properties?: Record<string, string | number | boolean>;
}) {
  // PII guard: known SENSITIVE keys reject
  const forbidden = ["email", "address", "fullName", "phone", "accountNumber", "password"];
  for (const key of Object.keys(args.properties || {})) {
    if (forbidden.includes(key.toLowerCase())) {
      throw new Error(`Event property "${key}" is SENSITIVE class and forbidden in events.`);
    }
  }
  await db.userEvent.create({
    data: {
      userId: args.userId,
      sessionId: args.sessionId,
      event: args.event,
      page: args.page,
      metadata: args.properties ? JSON.stringify(args.properties) : null,
    },
  });
  // Async ship to external if configured
  if (EXTERNAL_ANALYTICS_ENABLED) {
    void shipToExternal(hashUserId(args.userId), args.event, args.properties);
  }
}
```

Route handler örnek:

```ts
// apps/web/src/app/api/workspace/route.ts (POST)
await recordUserEvent({
  userId: ctx.userId,
  event: "workspace.created",
  properties: { workspaceId: workspace.id, plan: subscription.plan, source: "signup" },
});
```

## Client-side emit pattern

**Web** (`apps/web/src/lib/analytics.ts` mevcut `trackEvent(name, params)`):

```tsx
import { trackEvent } from "@/lib/analytics";
// ...
trackEvent("entitlement.banner.clicked", {
  placement: "exports.header",
  currentPlan: "FREE_TRIAL",
  requiredPlan: "INDIVIDUAL",
  action: "upgrade",
});
```

`trackEvent` mevcut implementasyon `POST /api/analytics/event` ile aynı `recordUserEvent` util'a düşmeli. Eğer şu an external'a doğrudan gidiyorsa, internal `UserEvent` write'ı için ek wrapper.

**Mobile** (`apps/mobile/src/lib/analytics.ts` yeni veya mevcut):

```ts
import { trackEvent } from "@/lib/analytics";
trackEvent("partner_sync.attempt.opened", { providerCode: "usps", actionType: "deep_link", channel: "mobile", openCount: 1 });
```

Mobile event'ler aynı isim setini kullanır. Server endpoint `POST /api/analytics/event` aynı.

## Aggregation / digest

**Weekly digest cron** (`apps/web/src/app/api/cron/analytics-digest/route.ts`, yeni Sprint 4):
- Geçen 7 gün için key event'ler özetlenir:
  - Yeni workspace count by plan
  - Plan upgrade/downgrade matrix
  - Partner sync attempt funnel (opened → completed)
  - Banner click-through rates by placement
  - Step-up auth success rate
  - iOS conflict shown count
- Slack webhook + admin dashboard panel (cross-ref 50 admin inspector ile aynı layout family)

Cron schedule: Monday 09:00 UTC.

## Privacy policy update

`/privacy` sayfası (mevcut `apps/web/src/app/privacy/page.tsx` veya `apps/web/src/lib/ccpa.ts` content kaynağı):

Yeni section veya genişletilmiş "Analytics" maddesi:

> We track in-product events to understand how features are used and to improve LocateFlow. We collect:
> - Page views and feature actions (e.g. "you opened the Partner Hub")
> - Plan upgrades and downgrades (e.g. "you upgraded from Family to Pro")
> - Time spent in flows
>
> We **do not** collect in our analytics:
> - Your email address, name, mailing address, phone number, account numbers, or passwords
> - The content of your services, addresses, or documents
>
> Internal identifiers (your user ID, workspace ID) are stored alongside events for our own analysis. If we send events to external analytics services, your user ID is hashed before transmission.

CCPA "categories of personal information collected" section'ına "internet activity (in-product events)" eklenir.

## Web

### Yeni sayfa/route

- `apps/web/src/app/api/cron/analytics-digest/route.ts` — weekly cron (Sprint 4)

### Mevcut sayfalara etki

Her yeni feature sayfası kendi event'lerini emit eder; ek sayfa değişimi yok.

### Componentler (file paths)

`apps/web/src/lib/user-events.ts` (yeni util, server-side)
`apps/web/src/lib/analytics.ts` (mevcut, `trackEvent` aynı kalır + internal write ekler)

### Butonlar / actionlar

Tüm CTA'lar + form submit'leri ilgili event'i tetikler. Doc'larda her UI element için event mapping not düşülür.

## Mobile

### Yeni ekran

N/A.

### Mevcut ekranlara etki

`apps/mobile/src/lib/analytics.ts` (yeni veya mevcut) — `trackEvent(name, params)` API'si web'le aynı. Server endpoint aynı.

## Admin

`apps/admin/src/app/(admin)/analytics/page.tsx` (yeni, Sprint 4 opsiyonel) — weekly digest snapshot UI. Event aggregation tabloları:
- Funnel: pricing.cta.clicked → checkout.completed
- Partner sync funnel: opened → completed
- Banner CTR

## Güvenlik

- [x] **Step-up auth?** — Hayır.
- [x] **PII redaction?** — `recordUserEvent` util'da SENSITIVE key guard (server-side validation). Eklenecek key'ler için code review checklist.
- [x] **Audit log?** — UserEvent kendi başına analytics, audit log değil. Plan upgrade, member remove gibi state-change'ler ek olarak `AuditLog`'a yazılır (mevcut `audit.ts`).
- [x] **Rate limit?** — Client-side `trackEvent` 100 event/dakika/user throttle, server reddeder.
- [x] **Permission matris?** — Event yazma her authenticated user; okuma admin-only (`/admin/analytics`).
- [x] **Encryption at rest?** — UserEvent.metadata standart DB encryption (provider seviyesinde, mevcut RDS encryption).
- [x] **GDPR DSAR?** — `/api/account/export` UserEvent rows'unu da export eder (mevcut implementation kontrol et). Account delete UserEvent'leri cascade siler (mevcut FK: `onDelete: Cascade`).

## Migration / backward compat

- DB değişikliği yok, ek tablo/kolon yok
- Mevcut `trackEvent` çağrıları korunur, yeni isimler additive
- Backfill yok (eski olaylar yazılmaz)

## Etkilenen mevcut özellikler

- `apps/web/src/lib/analytics.ts` — internal `recordUserEvent` write'ı eklenir
- `apps/web/src/app/api/analytics/event/route.ts` (varsa) — server-side validation güçlenir
- Her yeni feature route'u (cross-ref 02, 04, 11, 16, 21, 33, 36, vb.) en az 1 event emit eder
- `apps/web/src/app/privacy/page.tsx` veya content source — privacy disclosure update
- DSAR export script — UserEvent inclusion doğrulanır

## Test plan

**Unit**
- `recordUserEvent` SENSITIVE key reddi (throw)
- Event name VARCHAR(50) limit altında — string lint
- `metadata` JSON serialize valid

**Integration**
- POST /api/workspace → `workspace.created` row insert
- Stripe webhook → `plan.upgraded` row insert
- Banner intersect → 1 event/oturum (debounce çalışır)

**E2E**
- Pricing CTA tıklama → `pricing.cta.clicked` UserEvent row
- Partner button → `partner_sync.attempt.opened` row

**Manual**
- Privacy policy okuma: yeni metin anlaşılır
- Admin analytics panel weekly digest sayıları doğru
- External analytics (PostHog enabled environment) — userId hash'lendi, raw cuid sızmadı

## Açık sorular

1. External analytics provider var mı (PostHog, Segment, GA4)? Yoksa internal `UserEvent` yeterli; varsa shipping config ve hash salt yönetimi ek work.
2. Event metadata 50 char limit'i aşacak property kombinasyonları olabilir mi? JSON 5–10 key/event makul, 64KB Text alan rahat yeter.
3. Banner impression event'i her render'da mı yoksa kullanıcı viewport'a girdiğinde mi? **Tercih**: IntersectionObserver 50% visible + 1s threshold, session per banner 1 kez (debounce).
4. Mobile event'ler offline ise queue'da mı tutulur? **Tercih**: Faz 1'de offline buffer yok (event drop kabul edilir); Faz 2'de SQLite local queue.
5. Funnel analizleri için derived `properties.distinct_id` (PostHog convention) eklensin mi? Internal-only kullanım için gereksiz; external ship ediyorsak gerekli.
6. `step_up_auth.failed` event'i brute-force tespit için yeterli mi yoksa ayrı `AuditLog.SecurityEvent`'a da yazılsın mı? Cross-ref 16 + 18.
7. Yıllık analytics retention: UserEvent rows ne kadar tutulur? Mevcut policy `apps/web/src/app/api/cron/cleanup-user-events/route.ts` (varsa) — 13 ay tipik (önceki yıl karşılaştırma + GDPR makul). Yeni event hacmi storage'ı patlatabilir, monitor.
