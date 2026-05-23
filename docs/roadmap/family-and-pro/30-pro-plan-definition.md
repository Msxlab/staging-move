# Pro Plan Definition

> **Drift fix 2026-05-23** — Çelişkili değerler [`01a-canonical-values.md`](./01a-canonical-values.md) (§C1, §C3, §C11, §C12, §C16) ile geçersizdir. Pro limitleri **10 üye / 25 adres / 1000 servis** (§C1); aşağıda farklı sayılar (örn. 50 üye / 100 adres) görülürse canonical kazanır. Partner Hub `full` (enum — §C11 / D23). Address labels canonical §C12 / D24. Copy guardrails (§C16): "one-click", "auto-sync", "Verified Sync" yasak — Pro lansmanı **0 partner anlaşması** ile başlar (D15).

- **Status**: Proposed (Family/Pro launch, Sprint 4)
- **Tier**: Pro
- **Related decisions**: D1, D2, D4, D11, D15, D18, D20, D21 (limit canonical), D23 (partnerHubAccess enum), D24 (label split), D28 (sliced MVP 10–15 partner)
- **Related docs**: `01-architecture-decisions.md`, `06-entitlements-system.md`, `20-family-plan-definition.md`, `31-pro-checkout-flow.md`, `32-address-labels.md`, `33-partner-hub-ui.md`, `60-mobile-billing-readonly.md`, `61-pricing-page-update.md`, `62-subscription-plan-field-updates.md`

## Amaç

`Subscription.plan = PRO` durumunda workspace'in tüm davranışını ürün ve fatura açısından tek noktada tarif etmek: limit'ler, feature flag'ler, fiyat, Stripe Price ID konfigürasyonu, mobile davranışı, marketing positioning ve Family/Individual'a karşı feature matrisi. Bu doc 33–41 arası Pro feature doc'larının tek başvuru kaynağıdır.

## Kapsam

**In scope**
- PRO plan'ının `packages/shared/src/entitlements.ts` matrisindeki tek satırı
- Stripe Price ID env config (`STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`)
- `apps/web/src/lib/billing.ts` map fonksiyonlarına PRO branch ekleme
- IAP product ID rezervasyonu (Sprint 1, satış disabled — D11)
- Üç-persona positioning (multi-property owner / nomad / small biz)
- Pricing page 4'üncü sütun copy + feature comparison row referansları
- Marketing landing wireframe (`/pro` veya pricing içinde 4'üncü sütun)

**Out of scope**
- Stripe checkout endpoint kodu (→ 31)
- Partner Hub UI (→ 33)
- Address label semantiği (→ 32)
- Bulk sync queue UI (→ 14)
- Tax/property export (→ 40)
- Move history timeline (→ 41)
- Vendor contact book (→ 39)
- Pricing page DOM (→ 61, sadece copy snippet bu dosyada)
- `Subscription.plan` enum migration (→ 62)

## User stories

- **As a multi-property owner** (3 evi, biri kiralık, biri yazlık) PRO'ya geçer ve `Address.label` (D18) ile her adresi etiketler; Partner Hub'tan utility + insurance partner'larını adres bazlı toplu açar.
- **As a digital nomad** (yılda 4–5 taşınma) PRO'ya geçer; move history timeline (41) ile geçmişte hangi servisi nereden taşıdığını görür, bulk sync queue ile her taşınmada 30+ partner'ı tek seansta açar.
- **As a small business owner** (home office + LLC) PRO'ya geçer; vendor contact book (39) ile özel partner template'leri kaydeder, address label `OFFICE`/`WAREHOUSE` ile vergi export'unu (40) gruplar. **Not**: LLC/EIN izolasyonu YOK (D18); etiket sadece UI hint.
- **As a Family workspace owner** PRO'ya upgrade ediyorum: seat limitim 6'dan 10'a çıkar (D2), mevcut üyeler kalır, Partner Hub açılır.
- **As any Pro user** mobile'da: planımı görürüm, davet kabul ederim, partner action tamamlarım, ama satın **alamam** (D11) — web link'i çıkar.

## Veri modeli

Bu doc yeni tablo yaratmaz. Aşağıdaki mevcut/planlı tablolara bağımlıdır:

- `Subscription.plan` enum'una `PRO` eklemesi → `62-subscription-plan-field-updates.md`
- `Workspace`, `WorkspaceMember` → `02`, `03`
- `Address.label` → `32`

Entitlement matrisinde PRO satırı (`packages/shared/src/entitlements.ts`):

```ts
PRO: {
  limits: {
    maxAddresses: 25,           // canonical §C1
    maxServices: 1000,
    maxMembers: 10,             // canonical §C1 (+ view-only public link separately tracked)
    maxMovingPlans: -1,         // unlimited
    maxCustomProviders: -1,
    moveHistoryRetentionMonths: -1, // unlimited
  },
  flags: {
    addressLabels: ["HOME", "OFFICE", "RENTAL", "VACATION", "WAREHOUSE", "DORM", "OTHER"], // D18 + D24 / canonical §C12
    partnerHubAccess: "full",   // D15 + D23 — enum: none|teaser|full; lansmanda 10–15 partner (D28 sliced MVP)
    bulkSync: true,             // see 14
    taxPropertyExport: true,    // see 40
    vendorContactBook: true,    // Faz 2 (D28) — see 39
    moveHistoryTimeline: true,  // see 41
    consolidatedBudget: true,
    addressVerification: "bundled", // Faz 2 — schema present, UI "coming soon"
    apiAccess: false,           // Faz 3 — placeholder
    childRoleAllowed: true,
    viewOnlyPublicLink: true,
  },
}
```

D4 gereği `actionTier` plan eşleştirmesi DB'de değil burada:
- PRO sees `BASIC | EXTENDED | PREMIUM` tiers.
- FAMILY sees `BASIC | EXTENDED`.
- INDIVIDUAL / FREE_TRIAL: `BASIC`.

## API endpoint'leri

### Yeni
Hiçbiri. Bu doc plan tanımı; checkout endpoint'i 31'de.

### Mevcut endpoint'lere etki

- `GET /api/workspace/entitlements` (06): PRO subscription'da yukarıdaki matrisi döner.
- `GET /api/subscription` ve `POST /api/subscription/cancel`: `plan: "PRO"` değerini handle eder; cancel davranışı Individual ile aynı (period sonuna dek aktif).
- `POST /api/stripe/webhook`: `customer.subscription.updated` event'inde `priceId === STRIPE_PRICE_PRO_*` ise `Subscription.plan = PRO` yazar (mevcut `mapStripePriceIdToPlanAndInterval` genişler, 31'de detay).

## Web

### Yeni sayfa/route

Bu doc tek başına yeni route eklemiyor. Pricing 4'üncü sütun → `61`. Pro landing içeriği opsiyonel `/pro` route'unda Sprint 4'te eklenebilir; karar 61'de.

### Mevcut sayfalara etki

- `apps/web/src/components/marketing/pricing-section.tsx` — 4'üncü sütun eklenir (`61` detayı; bu doc sadece copy sağlar).
- `apps/web/src/lib/billing.ts` — `mapStripePriceIdToPlanAndInterval` PRO branch:

```ts
const proMonthly = getRuntimeConfigValue("STRIPE_PRICE_PRO_MONTHLY");
const proYearly  = getRuntimeConfigValue("STRIPE_PRICE_PRO_YEARLY");
if (proMonthly && priceId === proMonthly) return { plan: "PRO", billingInterval: "MONTH" };
if (proYearly  && priceId === proYearly ) return { plan: "PRO", billingInterval: "YEAR" };
```

- `apps/web/src/lib/billing-config.ts` — PRO Price ID lookup helper genişler; FAMILY ile aynı pattern.
- `apps/web/src/app/(app)/account/page.tsx` — plan rozeti `PRO` için "Workspace" etiketi (D1).

### Componentler (file paths)

- `apps/web/src/components/marketing/pricing-section.tsx` — Pro column.
- `apps/web/src/components/billing/PlanBadge.tsx` (var olabilir, yoksa yaratılır) — PRO variant.
- `apps/web/src/components/marketing/ProPersonas.tsx` (yeni, opsiyonel) — 3 persona kartı.

### Butonlar / actionlar

- Pricing'de "Get Pro" CTA → `/api/stripe/checkout` (mevcut endpoint genişler — D26; 31).
- Account sayfasında "Upgrade to Pro" CTA Family veya Individual subscriber için görünür.

## Mobile

### Yeni ekran

Hiçbiri. D11 gereği mobile satış yapmaz.

### Mevcut ekranlara etki

- `apps/mobile/app/settings/subscription.tsx` (var olan veya benzeri): plan rozeti `PRO` ekler, "Upgrade on web" deep link (D11).
- `apps/mobile/src/lib/entitlements.ts` (varsa): PRO matrisini paylaşılan `packages/shared/src/entitlements.ts`'den okur, yeniden tanımlamaz.

### Componentler

- `apps/mobile/app/settings/subscription.tsx` — read-only Pro badge.

### IAP product ID rezervasyonu (Sprint 1, disabled)

Apple App Store Connect + Google Play Console'a kaydedilir, satış disabled (D11):

| Platform | Product ID | State at launch |
|---|---|---|
| iOS | `com.locateflow.pro.monthly` | Created, NOT submitted for review |
| iOS | `com.locateflow.pro.annual`  | Created, NOT submitted for review |
| Android | `com.locateflow.pro.monthly` | Created, inactive |
| Android | `com.locateflow.pro.annual`  | Created, inactive |

Faz 2'de aktif edilince `60-mobile-billing-readonly.md` flow'u IAP'a açılır.

## Admin

### Yeni sayfa / Yetenekler

Bu doc admin sayfası eklemiyor. Mevcut admin etkileri:

- `apps/admin/src/app/(admin)/users/[id]/page.tsx` — kullanıcının workspace subscription'ında PRO görünür.
- `apps/admin/src/app/(admin)/subscriptions/page.tsx` — filter dropdown'a `PRO` eklenir.

## Güvenlik

- [ ] **Step-up auth**: Plan tanımı için gereksiz. Pro feature'larından AddressChangeEvent için zorunlu (D10, 15/16).
- [ ] **PII redaction**: Plan tanımı PII içermez. Pro içinde vendor contact book PII tutar (→ 39).
- [x] **Audit log**: Plan değişimi (`subscription.plan PRO → FAMILY`) `BillingAuditLog`'a yazılır (mevcut Stripe webhook handler).
- [ ] **Rate limit**: N/A.
- [x] **Permission matris**: PRO'da `childRoleAllowed=true`; CHILD rolü Partner Hub'tan sadece kendi assigned servislerini görür (→ 22, 36).
- [ ] **Encryption at rest**: N/A.
- [x] **GDPR DSAR**: Subscription row export'una mevcut user-data-export endpoint dahil; plan tanımı extra alan eklemez.

## Migration / backward compat

- `Subscription.plan` enum'una `PRO` eklenir (`62`). Mevcut `INDIVIDUAL` müşterileri etkilenmez (D20 grandfather YOK ama mevcut fiyatlar değişmez).
- D14 adapter sayesinde mevcut `plan-limits.ts` çağrı yerleri bozulmaz; PRO branch'i adapter içinde sessizce devreye girer.
- Stripe Price ID'leri env'e Sprint 4'te eklenir. Eksikse `mapStripePriceIdToPlanAndInterval` PRO branch'i hiç vurmaz; checkout 503 döner (31).

## Etkilenen mevcut özellikler

- Pricing section component (61).
- Stripe webhook plan mapping (31).
- Account page plan badge.
- Mobile subscription screen (60).
- Admin subscriptions list filter.
- `packages/shared/src/entitlements.ts` matris (06).

## Pricing copy

**Headline** (pricing column): "Pro — for serious moves and serious portfolios."

**Sub** (üç persona aynı kartta rotasyonla):

- *Multi-property owner*: "Manage every home, rental, and vacation place under one roof. Label by use, switch between addresses in seconds."
- *Frequent mover / nomad*: "4 moves a year? We've got you. Open each partner with everything pre-filled and submit yourself — track every confirmation in one queue." (copy guardrail §C16)
- *Small business with a home office*: "Keep work and home separate with address labels and export-ready records for tax season."

**Bullet list** (Pro sütununda):
- Up to **25 addresses** and **1,000 services** (canonical §C1)
- Up to **10 workspace members** + 1 view-only public link
- **Partner Hub** — 10–15 services at launch (more coming), guided open & update (D15/D28; copy guardrail §C16 — "one-click" yasak)
- **Bulk sync queue** — track every move in one place
- **Address labels** — Home, Office, Rental, Vacation, Warehouse, Dorm (canonical §C12)
- **Tax & property export** — CSV + PDF
- **Vendor contact book** — your private partner templates *(Faz 2 — D28)*
- **Unlimited move history timeline**
- Address verification *(included, coming soon)*

**Footer note**: "Pro is for power users. Most households need [Family](#family)."

## Marketing page wireframe (ASCII)

```
[Hero]   Pro for portfolios, nomads, and home-office pros.
         $19.99/mo · $199/yr — Get Pro →   (web only)

[Persona toggle: 🏘 Owner | ✈ Nomad | 💼 Small Biz]

[Persona-specific subhead + 3 bullets]

[Comparison row (Pro vs Family vs Individual vs Free)]
   (cross-ref pricing-section, 61)

[Partner Hub teaser]   10–15 launch partners. We prepare, you submit.
   (screenshot, link → /partner-hub demo if logged out; copy §C16)

[Bulk Sync demo]       GIF: 12 services updated in 90 seconds.

[Address labels demo]  Home | Office | Rental — tag and filter.

[FAQ]
   - "Is Pro different from Business?" No business tier today (D18).
     LLC/EIN isolation not in MVP. Faz 3 if demand.
   - "Why no mobile checkout?" (D11 explanation)
   - "Does Pro auto-sync with my utilities?" No (D15). Deep-link + clipboard.

[CTA] Start your Pro workspace →
```

## Test plan

**Unit**
- `entitlements.ts`: `getEntitlements()` returns PRO matrix for `Subscription.plan = "PRO"`.
- `billing.ts`: `mapStripePriceIdToPlanAndInterval(STRIPE_PRICE_PRO_MONTHLY)` → `{ plan: "PRO", billingInterval: "MONTH" }`.
- `actionTierAllowedForPlan("PRO", "PREMIUM")` → true.
- `actionTierAllowedForPlan("FAMILY", "PREMIUM")` → false.

**Integration**
- Stripe webhook receives `customer.subscription.created` with PRO price ID → `Subscription` row written with `plan=PRO`.
- `GET /api/workspace/entitlements` returns PRO matrix when caller is Pro workspace member.

**E2E (Playwright)**
- Logged-in Family user visits pricing page → sees Pro column with "Get Pro" button.
- Click "Get Pro" → Stripe checkout opens with PRO_MONTHLY price (31'in test'i).

**Manual**
- Mobile: Pro user opens app → Subscription screen shows "Pro" badge + "Manage on web" link.
- Admin: filter subscriptions by `PRO` → list renders.

## Açık sorular

- `/pro` ayrı landing page mi yoksa pricing içinde 4'üncü sütun yeterli mi? (Karar 61'de.)
- Address verification "coming soon" Pro lansmanında pricing'de görünsün mü, yoksa Faz 2 lansmanına saklansın mı?
- View-only public link rate limit'i (link paylaşımı bot'larına karşı) ayrı doc gerektirir; bu MVP'ye girer mi? (Şimdilik out-of-scope, Sprint 4 sonu kararı.)
- Üç-persona positioning marketing'de aynı sütunda mı yoksa carousel mi olacak? (Tasarım kararı; copy hazır.)
