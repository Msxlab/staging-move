# Subscription Plan Field — FAMILY + PRO Expansion

- **Status**: Proposed (Family/Pro launch, Sprint 1 types + Sprint 4 Stripe wiring)
- **Tier**: Infrastructure
- **Related decisions**: D20 (pricing), D17 (phase0_cleanup geçmişi), D14 (plan-limits adapter)
- **Related docs**: [20](./20-family-plan-definition.md), [30](./30-pro-plan-definition.md), [06](./06-entitlements-system.md), [21](./21-family-checkout-flow.md), [31](./31-pro-checkout-flow.md), [61](./61-pricing-page-update.md)

## Amaç

`Subscription.plan` field'ı Prisma'da `String` olarak tanımlı (enum **değil**) — bu yüzden Family ve Pro'yu allowed value listesine eklemek **DB migration gerektirmez**. Değişiklik `packages/shared/src/billing.ts` içindeki TypeScript union ve definitions'a iner. Bu doc, tüm güncellemeleri ve consumer audit'i tanımlar.

## Kapsam

**In scope**
- `BILLING_PLAN_ORDER` union'a `FAMILY`, `PRO` eklenmesi
- `PAID_BILLING_PLANS` union'a `FAMILY`, `PRO` eklenmesi
- `BILLING_PLAN_DEFINITIONS` map'ine iki yeni entry (D20 fiyatları)
- `BILLING_PRODUCT_CONFIG_KEYS.web` map'ine 4 yeni Stripe price key
- `packages/shared/src/runtime-config.ts` `ENV_FIRST_RUNTIME_CONFIG_KEYS` ve runtime-override allowlist'lere aynı key'ler
- Tests: `packages/shared/src/__tests__/billing.test.ts` Family/Pro test caseleri
- Consumer audit: `BILLING_PLAN_ORDER`, `PAID_BILLING_PLANS`, `BILLING_PLAN_DEFINITIONS` kullanan **her** dosyanın Family/Pro davranışı kontrol edilir
- Mobile shared types (mobile zaten `@locateflow/shared` import eder) otomatik takip eder

**Out of scope**
- Stripe Price ID üretimi (cross-ref 20, 30 — Sprint 4)
- Checkout flow (cross-ref 21, 31)
- Pricing page UI (cross-ref 61)
- Entitlement computation (cross-ref 06)

## User stories

Pure plumbing — N/A. Developer-facing değişiklik.

## Veri modeli

**DB migration: yok.** `Subscription.plan` String(20) zaten Family/Pro kabul eder. `20260417000000_phase0_cleanup` migration'ında `FAMILY → INDIVIDUAL` UPDATE yapıldığı için tarihsel `FAMILY` row'u yok, yeni `FAMILY` müşterileri fresh insert.

Doğrulama: `SELECT DISTINCT plan FROM Subscription;` — sadece `FREE_TRIAL`, `INDIVIDUAL` döner (production). Yeni değerler eklenince yeni row'lar `FAMILY` veya `PRO` olarak yazılır.

**Constraint**: DB seviyesinde `plan` için CHECK constraint **yok** (Prisma `String`). Validasyon TypeScript + runtime guard'ında. Bu doc'tan sonra:

```ts
export function isBillingPlan(value: string): value is BillingPlan {
  return BILLING_PLAN_ORDER.includes(value as BillingPlan);
}
```

`isBillingPlan` her API'de Stripe webhook ve checkout completion handler'ında çağrılır (cross-ref 21, 31).

## API endpoint'leri

Yeni endpoint yok. Mevcut endpoint'lerin response'larında `plan` artık `FAMILY | PRO` da dönebilir:
- `GET /api/profile` → `entitlement.plan` genişler
- `GET /api/account/subscription`
- `POST /api/webhooks/stripe` — `metadata.plan` parsing'i Family/Pro tanır
- `POST /api/billing/checkout` — `body.targetPlan` Family/Pro accept eder

## Web

### Yeni sayfa/route

N/A bu doc için.

### Mevcut sayfalara etki

Audit listesi (grep "BILLING_PLAN_ORDER" `apps/web/src` `apps/admin/src` `apps/mobile`):

| Dosya | Etki | Aksiyon |
|---|---|---|
| `apps/web/src/lib/shared-billing.ts` | re-export shim | Otomatik (import'tan gelir) |
| `apps/web/src/lib/plan-limits.ts` | Plan → limit mapping | **Manual** — Family (6 user, 25 address, 250 service), Pro (50 user, 100 address, 1000 service) eklenir (cross-ref 20, 30 değerleri) |
| `apps/web/src/lib/api-gates.ts` | Plan gate logic | Audit: gate'ler Family/Pro plan'da nasıl davranır kararı (cross-ref 06) |
| `apps/web/src/lib/billing-config.ts` | Stripe config lookup | Yeni 4 price key okuma path'i |
| `apps/web/src/app/api/billing/checkout/route.ts` | Checkout handler | Family/Pro targetPlan kabul + Stripe price ID lookup |
| `apps/web/src/app/api/webhooks/stripe/route.ts` | Webhook parser | `subscription.metadata.plan` Family/Pro accept |
| `apps/web/src/app/account/billing/page.tsx` | Account billing page | Plan badge "Family" / "Pro" render eder; mevcut switch zaten string'i gösterir, doğrula |
| `apps/admin/src/app/(admin)/users/[id]/page.tsx` | User detail | Plan kolonu Family/Pro render eder |
| `apps/admin/src/app/(admin)/subscriptions/page.tsx` | Sub list | Filter dropdown Family/Pro seçeneği |
| `apps/admin/src/lib/shared-billing.ts` | re-export | Otomatik |
| `apps/mobile/app/settings/subscription.tsx` | Subscription screen | Plan rendering Family/Pro states (cross-ref 60) |

### Componentler (file paths)

Doğrudan yeni component yok. Etkilenen mevcut componentler:

- `apps/web/src/components/billing/PlanBadge.tsx` (varsa, yoksa `account/billing/plan-card.tsx`) — Family/Pro display name + color token
- `apps/web/src/components/marketing/pricing-section.tsx` (cross-ref 61) — `BILLING_PLAN_DEFINITIONS.FAMILY` ve `.PRO` doğrudan tüketir

### Butonlar / actionlar

N/A bu doc için.

## Mobile

### Yeni ekran

N/A.

### Mevcut ekranlara etki

- `apps/mobile/app/settings/subscription.tsx` (cross-ref 60) — `BILLING_PLAN_DEFINITIONS` import doğrudan tüketilir; Family/Pro plan'ı algılayıp doğru ekran render eder
- `apps/mobile/src/lib/billing-flags.ts` — yeni Family/Pro fiyat string'leri product fetch için kullanılmaz (Faz 1 sales disabled)

## Admin

`apps/admin/src/app/(admin)/runtime-config/` — yeni 4 key admin runtime config UI'da görünür:

| Key | Category | Default ENV | Mask |
|---|---|---|---|
| `STRIPE_PRICE_FAMILY_MONTHLY` | BILLING | `(env)` | `id` |
| `STRIPE_PRICE_FAMILY_YEARLY` | BILLING | `(env)` | `id` |
| `STRIPE_PRICE_PRO_MONTHLY` | BILLING | `(env)` | `id` |
| `STRIPE_PRICE_PRO_YEARLY` | BILLING | `(env)` | `id` |

Mevcut Individual key'leri ile aynı pattern (`ENV_FIRST_RUNTIME_CONFIG_KEYS` allowlist).

## Güvenlik

- [x] **Step-up auth?** — Hayır, type değişikliği.
- [x] **PII redaction?** — Hayır.
- [x] **Audit log?** — Stripe webhook entry'leri zaten log'lanıyor; Family/Pro plan değişimi otomatik audit'e düşer (mevcut `audit.ts` infra).
- [x] **Rate limit?** — N/A.
- [x] **Permission matris?** — N/A (plan field, role değil).
- [x] **Encryption at rest?** — N/A.
- [x] **GDPR DSAR?** — Subscription history zaten export'a dahil; Family/Pro otomatik takip.

## Migration / backward compat

- DB migration **yok**. Tip değişikliği TypeScript safe (union genişler, contract daralmaz).
- Mevcut `INDIVIDUAL` aboneler etkilenmez — fiyat değişmez (D20).
- `getBillingPlanDefinition()` function default fallback `FREE_TRIAL` kalır; bilinmeyen plan değeri (eski tarihsel `FAMILY` benzeri legacy edge case) FREE_TRIAL'a düşer (graceful degradation).
- `isPaidBillingPlan()` Family/Pro için `true` döner — gating logic'i otomatik genişler.
- Mobile + admin shared package'tan import ettiği için **redeploy ile** yeni değerleri otomatik alır. Backward-compat package version bump gerekmez (additive change).

## Etkilenen mevcut özellikler

`grep -rn "BILLING_PLAN_ORDER\|BILLING_PLAN_DEFINITIONS\|PAID_BILLING_PLANS" /home/user/move-main --include="*.ts" --include="*.tsx"` audit'i (Sprint 1 başında çalıştırılır). Beklenen liste:

- `packages/shared/src/billing.ts` (source)
- `packages/shared/src/__tests__/billing.test.ts` (tests)
- `apps/web/src/lib/shared-billing.ts`
- `apps/admin/src/lib/shared-billing.ts`
- `apps/web/src/components/marketing/pricing-section.tsx`
- `apps/web/src/components/marketing/pricing-section.test.tsx`
- `apps/mobile/app/settings/subscription.tsx`
- `apps/web/src/lib/plan-limits.ts` (manuel limits eklenir)
- `apps/web/src/lib/api-gates.ts` (gate'ler audit)
- `apps/web/src/lib/billing-config.ts` (config lookup)
- `apps/web/src/app/api/billing/checkout/route.ts` (Faz 4)
- `apps/web/src/app/api/webhooks/stripe/route.ts` (Faz 4)
- `docs/design-system/reference/codebase/web/src/components/marketing/pricing-section.tsx` (reference snapshot — güncel tutulmalı mı tartışılır)

Her satır audit edilir, Family/Pro davranışı not düşülür. Eksik branch kalan dosya için issue açılır.

## Test plan

**Unit (`packages/shared/src/__tests__/billing.test.ts`)**
- `BILLING_PLAN_ORDER` 4 değer içerir: FREE_TRIAL, INDIVIDUAL, FAMILY, PRO (order korunur)
- `PAID_BILLING_PLANS` 3 değer içerir: INDIVIDUAL, FAMILY, PRO
- `BILLING_PLAN_DEFINITIONS.FAMILY` D20 alanlarını doğru içerir:
  - `monthlyPriceUsd === 9.99`
  - `yearlyPriceUsd === 99`
  - `displayName === "Family"`
  - `isPaid === true`
- `BILLING_PLAN_DEFINITIONS.PRO` D20 alanlarını doğru içerir:
  - `monthlyPriceUsd === 19.99`
  - `yearlyPriceUsd === 199`
- `getBillingPlanDefinition("FAMILY")` Family definition döner
- `getBillingPlanDefinition("FAMILY ")` (whitespace) FREE_TRIAL fallback'e düşer (find strict equality)
- `getBillingPlanDefinition(null)` FREE_TRIAL döner
- `isPaidBillingPlan("FAMILY")` true; `isPaidBillingPlan("PRO")` true; `isPaidBillingPlan("FREE_TRIAL")` false
- `isActiveSubscriptionStatus()` Family/Pro plan'lar için aynı status set'ini kabul eder (status plan'dan bağımsız, regression test)

**Integration**
- `apps/web/src/lib/billing-config.test.ts` (varsa) — yeni 4 Stripe key okunur, ENV varsa ENV, yoksa runtime config
- `apps/web/src/lib/runtime-config.test.ts` — yeni key'ler ENV_FIRST listesinde

**E2E**
- N/A bu doc için (UI smoke testler 61'de)

**Manual**
- Database query: production-clone'da `SELECT plan, COUNT(*) FROM Subscription GROUP BY plan;` — sadece `FREE_TRIAL`, `INDIVIDUAL`. Yeni değerlerin eklenmesi sonrası Stripe webhook simülasyonu ile FAMILY row insert edilir, query yeni row'u gösterir.

## Açık sorual

1. Audit grep listesi mekanik olarak çalıştırılıp `docs/roadmap/family-and-pro/_audit-plan-consumers.md` olarak commit'lensin mi? Faydası: review'da gözden kaçan dosya kalmaz. Maliyet: ek doc bakımı.
2. `Subscription.plan` field'ına Prisma seviyesinde CHECK constraint (`@db.VarChar(20)` zaten var; allowed value listesi raw SQL migration ile eklenebilir) eklensin mi? **Tercih**: hayır, TypeScript yeterli, DB constraint future-proof değil (yeni plan eklerken migration gerekir).
3. `docs/design-system/reference/codebase/web/src/components/marketing/pricing-section.tsx` — bu reference snapshot otomatik mi güncellenir yoksa manuel commit ile mi? Bu doc kapsamı dışı, ayrı PR.
4. `BILLING_PLAN_ORDER` tuple sırası UI order'ı belirliyor mu? Bazı consumer'lar `.map()` ile sıralı render ediyor olabilir. Audit'te kontrol et — eğer order önemliyse Free → Individual → Family → Pro **doğru** sıra.
5. `runtime-config.ts` `ENV_FIRST_RUNTIME_CONFIG_KEYS` literal `as const` array'i kontrak — yeni key'ler eklenince downstream consumer'larda type widening sorunu çıkıyor mu? Test ekle.
