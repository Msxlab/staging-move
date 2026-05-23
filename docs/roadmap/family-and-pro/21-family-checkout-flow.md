# Family Checkout Flow

- **Status**: Proposed (Family/Pro launch, Sprint 4)
- **Tier**: Family
- **Related decisions**: D2 (owner-resolved entitlement, grace + overflow), D11 (mobile read-only, satış sadece web), D12 (iOS active sub varken web upgrade reddedilir), D17 (mevcut user PERSONAL workspace), D20 (Family fiyat)
- **Related docs**: 01-architecture-decisions.md, 02-workspace-model.md, 04-workspace-invitation.md, 06-entitlements-system.md, 17-ios-subscription-conflict-guard.md, 20-family-plan-definition.md, 30-pro-plan-definition.md, 60-mobile-billing-readonly.md, 61-pricing-page-update.md, 62-subscription-plan-field-updates.md, 63-entitlement-banners-empty-states.md, 66-email-templates.md

## Amaç

Family planını **satın alma**, mevcut Individual aboneliğinden **upgrade etme**, Free Trial'den Family'ye geçiş, downgrade (Family → Individual), refund/iptal ve acquisition campaign desteği için son uçtan uca akışı tarif etmek. Stripe Checkout / Subscription Update API / webhook handler / DB state machine entegrasyonu burada toplanır. Plan tanımı 20'de, mobile read-only banner 60'ta.

## Kapsam

In scope:
- Web Stripe Checkout Session yaratımı (`plan=family` + `interval=monthly|annual`)
- Success/cancel callback URL'leri ve UX
- Webhook handler genişlemesi: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` Family için
- Individual → Family upgrade: Stripe `subscriptions.update` proration API
- Free Trial → Family: trial-then-paid Checkout (Stripe `subscription_data.trial_period_days`)
- Workspace state: ilk Family ödemesinde workspace yeniden adlandırılır mı (D1 — UI etiketi otomatik), member invite prompt'u
- Mobile davranışı: Family checkout yok → "Upgrade on web" banner + deep-link
- D12 iOS conflict guard `/api/stripe/checkout` route'a entegrasyon
- Acquisition campaign desteği (FAMILY için promotional code/trial extension)
- Refund policy (Stripe Dashboard manuel + web copy)
- Downgrade flow (Family → Individual) ve seat overflow UI tetikleyici

Out of scope:
- Family limit/feature definition → 20-family-plan-definition.md
- Pro checkout (paralel doc) → 31-pro-checkout-flow.md
- Workspace member invite mekaniği → 04-workspace-invitation.md
- Email şablonları (welcome, payment-failed, downgrade-warning) → 66-email-templates.md
- Pricing sayfası UI → 61-pricing-page-update.md
- Mobile IAP fiili aktivasyon (Faz 2) → 60-mobile-billing-readonly.md

## User stories

- **Free Trial kullanıcı**: Pricing sayfasında "Choose Family" → Stripe Checkout → kart bilgisi → success → workspace'im FAMILY plan'ında, davet ekranı önümde.
- **Individual müşteri**: Settings > Subscription > "Upgrade to Family" → tek tıkla Stripe proration → anında yeni limit, kalan dönem için pro-rated invoice, yeni dönem $9.99.
- **iOS Individual abonesi (App Store)**: Web'de "Upgrade to Family" denediğimde D12 guard kibar bir hata mesajıyla beni App Store iptaline yönlendirir.
- **Family OWNER (mevcut)**: Family'den vazgeçip Individual'a düşürmek istiyorum → 7 gün grace pencere, ek üyelerim OVERFLOW etiketi alır, 30 günlük cancel-at-period-end mesajı.
- **Family OWNER**: Yıllık fiyatla almak istiyorum, pricing sayfasında "Annual" toggle → $99/yıl Checkout.
- **MEMBER**: Plan değişikliğinden etkilenirim ama checkout butonum yok; banner "Owner manages billing" görürüm.
- **CHILD**: Billing sayfasını **hiç** görmem (22).
- **Marketing manager**: `FAMILY-2026` campaign code'uyla 30 gün trial uzantısı promosyonu açabilmek istiyorum.

## Veri modeli

`Subscription` modeli **değişmez**; sadece `plan` enum kabul edilen değerleri arasına FAMILY/PRO girer (62'de). Yeni hiçbir tablo yok.

```prisma
// packages/db/prisma/schema.prisma — Subscription (62'den kopya, referans için)
model Subscription {
  id                  String    @id
  userId              String    @unique @db.VarChar(30)
  plan                String    @db.VarChar(20) // FREE_TRIAL | INDIVIDUAL | FAMILY | PRO
  status              String    @db.VarChar(30)
  provider            String    @db.VarChar(20) // STRIPE | APP_STORE | PLAY_STORE | TRIAL | ADMIN
  platform            String?   @db.VarChar(10)
  stripeSubscriptionId String?  @unique @db.VarChar(100)
  stripeCustomerId    String?   @db.VarChar(100)
  currentPeriodStart  DateTime?
  currentPeriodEnd    DateTime?
  cancelAtPeriodEnd   Boolean   @default(false)
  trialEnd            DateTime?
  ...
}
```

Acquisition için mevcut `AcquisitionCampaign` / `AcquisitionRedemption` tabloları (acquisition.ts) kullanılır; sadece campaign config'inde `applicablePlans: ['FAMILY']` filtresi gerekir (mevcutsa kullanılır, yoksa eklenir — bu doc'un dışında basit alan).

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/api/billing/checkout` | Required (session) | Owner of caller's primary workspace | `{ plan: 'FAMILY' \| 'PRO', interval: 'monthly' \| 'annual', campaignCode?: string, successUrl?: string, cancelUrl?: string }` | `{ url: string }` (Stripe hosted checkout URL) | 400 invalid plan/interval, 401 unauth, 403 not owner, 409 D12 iOS conflict, 409 mid-billing-state, 429 rate, 502 Stripe error |
| POST | `/api/billing/upgrade` | Required | Owner | `{ targetPlan: 'FAMILY' \| 'PRO', interval: 'monthly' \| 'annual', prorationBehavior: 'create_prorations' \| 'none' }` | `{ subscriptionId, status, currentPeriodEnd, invoiceUrl? }` | 400, 403, 404 no existing sub, 409 same plan, 502 |
| POST | `/api/billing/downgrade` | Required | Owner | `{ targetPlan: 'INDIVIDUAL' \| 'FREE_TRIAL', effective: 'period_end' }` | `{ scheduledAt, willOverflowMembers: number }` | 400, 403, 409 owner only |
| GET  | `/api/billing/checkout/return` | Optional | — | query: `session_id` | Redirects to `/settings/subscription?success=1` | 400 |

**Not**: Mevcut `apps/web/src/app/api/stripe/checkout/route.ts` halen var; bu spec onu `/api/billing/checkout` namespace'i altında ya **rename** eder ya da yeni endpoint paralel yaşar ve eski Individual-only kodu deprecate edilir. Tercih: rename + redirect (logical olarak tek endpoint, plan parametresiyle).

### Mevcut endpoint'lere etki

- `/api/stripe/checkout` → `/api/billing/checkout`'a redirect (2-3 sürüm geri uyum). Test: `apps/web/src/app/api/stripe/checkout/route.test.ts` güncellenir.
- `/api/stripe/checkout/cancel` → `/api/billing/checkout/cancel`'a taşınır.
- `/api/stripe/portal` (Stripe Billing Portal session) — Family için **aynı** portal URL döner; portal Stripe tarafında plan upgrade/downgrade'i de gösterir (config Stripe Dashboard'da).
- `/api/webhooks/stripe`:
  - `checkout.session.completed` → eğer `session.metadata.plan === 'FAMILY'`, Subscription.plan = `FAMILY`, status `ACTIVE` veya `TRIALING`.
  - `customer.subscription.updated` → plan değişimi tespit edilir (price ID → plan map), DB güncellenir, **downgrade ise** OVERFLOW hesaplanır (D2).
  - `customer.subscription.deleted` → status `CANCELED`, plan korunur (grace 7 gün D2 başlar).
  - `invoice.payment_failed` → status `PAST_DUE`; member'lara banner gönder (63), email queue (66).
- `/api/acquisition/redeem` → `applicablePlans: ['FAMILY']` campaign'lerini destekler; redeem sonrası checkout `subscription_data.trial_period_days` artırılır.

## Web

### Yeni sayfa/route
- `/billing/checkout?plan=family&interval=annual` — middleware niteliğinde server component, oturum + workspace context (D13) çözer, `/api/billing/checkout` çağırır, Stripe Checkout URL'ine `redirect()`. Hata durumunda `/billing/error?code=...`'a yönlendirir.
- `/billing/success?session_id=...` — minimal teşekkür sayfası: "Welcome to Family!", invite CTA → `/workspace/members?intent=invite`, ardından otomatik `/settings/subscription` linki. Server tarafında session.id'yi Stripe ile doğrular (defense-in-depth).
- `/billing/canceled` — "Maybe later" tonu, pricing sayfasına link.
- `/billing/error?code=ios_conflict|...` — D12 ve diğer hata kodları için Türkçe + EN açıklama.

### Mevcut sayfalara etki
- `apps/web/src/components/marketing/pricing-section.tsx` — "Choose Family" butonu logged-in ise `/billing/checkout?plan=family&interval=<toggle>`, logged-out ise `/signup?next=/billing/checkout?plan=family&interval=<toggle>`.
- `apps/web/src/app/(app)/settings/subscription/page.tsx` — Family için "Upgrade to Family" CTA (Individual'dayken) veya "Manage subscription" (Family'deyken → Stripe Portal). Downgrade butonu confirmation modal'ı açar.
- `apps/web/src/app/api/webhooks/stripe/route.ts` — handler switch genişler (yukarıda).

### Componentler (file paths)
- `apps/web/src/components/billing/UpgradeButton.tsx` — props `{ targetPlan, interval, source }`, click → POST `/api/billing/checkout` → window.location.
- `apps/web/src/components/billing/DowngradeModal.tsx` — overflow uyarısı + "X members will be marked OVERFLOW" + confirm.
- `apps/web/src/components/billing/IosConflictBanner.tsx` — D12 kullanıcı mesajı (17'den paylaşılan).
- `apps/web/src/components/billing/FamilyWelcomeCard.tsx` — `/billing/success` üzerindeki invite CTA.

### Butonlar / actionlar
- Pricing sayfası "Choose Family" (monthly/annual toggle): logged-out → /signup, logged-in → /billing/checkout.
- Settings > Subscription "Upgrade to Family" → POST /api/billing/upgrade ya da checkout (yeni Stripe Customer yoksa checkout, varsa update).
- Settings > Subscription "Downgrade" → DowngradeModal → POST /api/billing/downgrade.
- /billing/success "Invite members" → /workspace/members (04).

## Mobile

### Yeni ekran
- Yok.

### Mevcut ekranlara etki
- `apps/mobile/app/settings/subscription.tsx`:
  - Plan FAMILY ise: "Manage on web" link (Stripe Portal proxy via `/api/billing/portal-link`).
  - Plan INDIVIDUAL ya da FREE_TRIAL ise: `UpgradeOnWebBanner` ("Upgrade to Family on lf.io/upgrade").
- `apps/mobile/app/(tabs)/index.tsx` (dashboard) — Family upgrade prompt'u (sadece settings'te, dashboard'a koymuyoruz, App Store guideline trigger riski).

### Componentler
- `apps/mobile/src/components/billing/UpgradeOnWebBanner.tsx` — TouchableOpacity + `Linking.openURL('https://lf.io/upgrade?from=mobile&plan=family')`.

## Admin

### Yeni sayfa / Yetenekler
- `/admin/users/[id]/subscription` — manuel plan atama dropdown'una FAMILY eklenir; admin reason zorunlu, audit log (`SubscriptionAdminOverride`).
- `/admin/subscriptions` — filtre: `plan=FAMILY`, status, provider. Refund button mevcut Individual ile aynı yol.

## Güvenlik

- [x] **Step-up auth**: Checkout başlatmak için **gerekmez** (Stripe Checkout zaten kart girişi ister). Ancak downgrade (`/api/billing/downgrade`) ve admin override **step-up** ister (D10 pattern — mevcut admin tools'taki gibi).
- [x] **PII redaction**: Stripe customer email server-side log'larda redact (`packages/shared/src/audit-redaction.ts` üzerinden). Webhook payload log'lara basılmaz, sadece `event.id` + `event.type`.
- [x] **Audit log**: Yeni audit event tipleri: `SUBSCRIPTION_UPGRADED`, `SUBSCRIPTION_DOWNGRADED`, `CHECKOUT_STARTED`, `CHECKOUT_COMPLETED`, `WEBHOOK_PROCESSED`. Mevcut `AuditEvent` modeli kullanılır.
- [x] **Rate limit**: `/api/billing/checkout` user başına 10 req/dakika; abuse loop önler.
- [x] **Permission matris**:
  - Checkout/upgrade/downgrade: **sadece OWNER**.
  - MEMBER/CHILD: hata 403 + UI'da buton gizli (defense in depth).
- [x] **Encryption at rest**: Stripe Customer/Subscription ID düz string (zaten public-safe identifiers). DB column normal VARCHAR.
- [x] **GDPR DSAR**: User export'unda Subscription kaydı zaten dahil; Family için ek alan yok.

### D12 iOS Conflict Guard

`/api/billing/checkout` ilk adım:

```ts
const currentSub = await db.subscription.findUnique({ where: { userId } });
if (
  currentSub?.provider === "APP_STORE" &&
  isActiveSubscriptionStatus(currentSub.status)
) {
  return NextResponse.json(
    { error: "IOS_SUBSCRIPTION_CONFLICT", message: "..." },
    { status: 409 }
  );
}
```

UI tarafında `IosConflictBanner` render. Detay 17.

## Migration / backward compat

- **Hiçbir mevcut Individual abonesi etkilenmez**. Stripe Subscription row'ları olduğu gibi kalır; price ID'leri değişmez.
- Webhook handler'ın yeni switch case'leri **additive**; eski Individual webhook'ları aynı kodda çalışmaya devam eder.
- `/api/stripe/checkout` route 1 sürüm boyunca **alias** olarak yaşar (308 redirect → `/api/billing/checkout`), 2-3 hafta sonra silinir.
- Mevcut Individual müşteriler upgrade ettiğinde Stripe **proration** uygular: kalan dönem için diff fatura edilir; bu davranış Stripe Dashboard Subscription settings'inde standart "create_prorations" olarak ayarlı (default).

### Workspace handling on first Family payment

```
on `checkout.session.completed` where plan=FAMILY:
  - Subscription updated to plan=FAMILY (D2 owner-resolved → workspace limits change otomatik)
  - Workspace.displayName otomatik **değişmez** (D1: plan'dan UI etiketi türetilir, DB row'unda type yok)
  - If workspace.memberCount === 1:
      Push notification + email: "Invite up to 5 members"
      /billing/success'te invite CTA visibility=true
  - Else:
      Silent success; sadece limit aktive olur
```

## Etkilenen mevcut özellikler

- **Stripe Webhook handler** (`apps/web/src/app/api/webhooks/stripe/route.ts`): switch genişler, plan map (price ID → BillingPlan) eklenir.
- **`apps/web/src/lib/billing.ts`** ve **`shared-billing.ts`**: plan determination helper'ları FAMILY/PRO döner; mevcut imzalar bozulmaz.
- **`apps/web/src/lib/billing-config.ts`**: yeni env var beklentileri (Family/Pro price ID'leri); test ile boot validation.
- **`packages/shared/src/acquisition.ts`**: `applicablePlans` filtresi mevcutsa kullan, yoksa minor extension.
- **Settings/Subscription sayfası**: UpgradeButton + DowngradeModal entegrasyonu.
- **Pricing component (61)**: CTA URL'leri yeni endpoint'e.
- **Mobile settings/subscription.tsx**: read-only banner + Manage on web link.

## Downgrade flow detayı (Family → Individual)

1. Kullanıcı Settings > Subscription'da "Downgrade to Individual" tıklar.
2. `DowngradeModal` workspace member count + overflow uyarısı (`willOverflowMembers = max(0, memberCount - 1)`).
3. Confirm → POST `/api/billing/downgrade { targetPlan: 'INDIVIDUAL', effective: 'period_end' }`.
4. Backend `stripe.subscriptions.update(id, { cancel_at_period_end: false, items: [{ id, price: INDIVIDUAL_PRICE }], proration_behavior: 'none' })` veya schedule API.
5. Subscription.plan **henüz değişmez**; `scheduledPlanChangeAt` (yeni alan veya metadata) currentPeriodEnd'e set.
6. currentPeriodEnd'de webhook `customer.subscription.updated` → plan FAMILY → INDIVIDUAL, status ACTIVE.
7. Aynı anda D2 OVERFLOW logic tetiklenir: `WorkspaceMember.status` 5 üyeden fazlasını `OVERFLOW`'a çevirir (rolleri korunur, yeni invite kilitli).
8. Email queue (66): downgrade-warning + downgrade-completed.

### Family → Free Trial (cancel)

Stripe `cancel_at_period_end=true` ile period sonunda CANCELED + 7 gün grace (D2), sonra FREE_TRIAL plan'ına düşmez (Free Trial bir kerelik), `FREE_ACCESS_EXPIRED` status'una geçer. Member'lar OVERFLOW olur ve workspace yeni resource yaratamaz.

## Refund policy

- Refund **Stripe Dashboard üzerinden manuel** (admin/operations). Web'de self-serve refund yok.
- Customer support için mevcut `/admin/subscriptions/[id]/refund` butonu Family için aynı yol.
- Marketing copy (64) "30-day money-back guarantee" yazılırsa burada lafı geçer; aksi takdirde "pro-rated cancellation".
- Refund sonrası Subscription.status `REFUNDED`, workspace 7 gün grace (D2).

## Acquisition campaign support

Mevcut `AcquisitionCampaign` modeli `applicablePlans: string[]` alanını destekler (yoksa minor extension). Campaign örneği:

```json
{
  "code": "FAMILY-2026",
  "kind": "TRIAL_EXTENSION",
  "applicablePlans": ["FAMILY"],
  "trialDaysBonus": 16,
  "startsAt": "2026-06-01",
  "endsAt": "2026-08-31",
  "maxRedemptions": 1000
}
```

Checkout flow:
1. Kullanıcı pricing veya signup'ta `?code=FAMILY-2026` ile gelir.
2. `/api/acquisition/redeem` redemption row'u yaratır + cookie set.
3. `/api/billing/checkout` cookie'yi okur, Stripe Checkout session'ında `subscription_data.trial_period_days = 14 + 16 = 30`.
4. Subscription oluşunca `RedemptionApplied` audit + email "Your bonus trial is active".

## Test plan

### Unit
- `apps/web/src/lib/billing.test.ts`: price ID → plan map FAMILY için doğru.
- Webhook handler unit: `checkout.session.completed` fixture (Family monthly + annual) → DB update doğru.
- Downgrade overflow hesabı: 6 üye → 5 OVERFLOW (1 OWNER + 1 active MEMBER kalır = Individual cap 1 → 5 OVERFLOW).
- D12 guard: APP_STORE active sub → 409.

### Integration
- `POST /api/billing/checkout { plan: 'FAMILY', interval: 'monthly' }` → Stripe API mock → 200 + url.
- Acquisition campaign code dahil flow.
- Webhook idempotency: aynı event 2 kez → tek DB write.
- `/api/billing/upgrade` Individual → Family: Stripe update mock, DB güncel.

### E2E (Playwright + Stripe test mode)
- Free Trial user → /pricing → Choose Family → Stripe Checkout (test card 4242…) → /billing/success → workspace plan FAMILY.
- Individual user → /settings/subscription → Upgrade → success.
- iOS sub mock (DB seed) → web checkout 409 banner.
- Downgrade → confirm modal → success message + scheduled date.

### Manual QA
- Stripe test mode: 4 kart sonucu (success / declined / 3DS / dispute).
- Webhook retries (Stripe Dashboard "send test event").
- Mobile build: "Upgrade on web" banner Linking → tarayıcı açar.
- Customer Portal: plan upgrade Stripe portal üzerinden → webhook → DB doğru.

## Açık sorular

- [ ] Family Annual fiyatında "save $19.88" gibi ek vurgu UI'ya yazılmalı mı? (64 marketing kararı)
- [ ] FREE_TRIAL kullanıcısı Family seçtiğinde **trial uzar mı** yoksa kart girilince trial biter mi? Karar: trial uzamaz, kart girilince Family trial 14 gün başlar (Stripe `trial_period_days=14`); mevcut trial gün sayısı sıfırlanır. Onay bekliyor.
- [ ] Downgrade'i annual yıl ortasında yapan kullanıcıya refund? — şimdilik "no pro-rated refund, downgrade at period end" (Stripe default). Marketing copy buna göre.
- [ ] Stripe Customer Portal'da plan switch açık mı kapalı mı? Açık → kullanıcı kendi başına Family ↔ Pro geçer; kapalı → sadece bizim UI üzerinden. Karar: **kapalı**, davranışı kontrol altında tutmak için (App Store karışıklığı riski).
- [ ] Campaign + iOS conflict: campaign code'lu kullanıcı iOS conflict yaşarsa redemption tüketilir mi? — Karar: tüketilmez, redemption "PENDING" kalır (D12 ekranında).
- [ ] FAMILY-PRO upgrade için ayrı flow mu, generic mı? → Generic `/api/billing/upgrade { targetPlan }`, ayrı doc 31'de Pro spesifik nüans.
