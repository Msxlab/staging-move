# Family Plan Definition

> **Drift fix 2026-05-23** — Çelişkili değerler [`01a-canonical-values.md`](./01a-canonical-values.md) (§C1, §C5, §C11, §C12, §C16) ile geçersizdir. Family limitleri **6 üye / 17 adres / 250 servis** (§C1); aşağıda farklı sayılar varsa canonical kazanır. `Subscription.plan @db.VarChar(30)` (§C5). Partner Hub `none` (enum — §C11). Family adres etiketleri canonical §C12'ye göre `HOME | DORM | VACATION | OTHER` (Pro-only DEĞİL). Copy guardrails: "auto-sync", "one-tap utility updates" yasak (§C16).

- **Status**: Proposed (Family/Pro launch, Sprint 4)
- **Tier**: Family
- **Related decisions**: D1 (workspace tek root, plan = UI etiketi kaynağı), D2 (entitlement owner'ın subscription'ından türer, grace + overflow), D3 (field-level visibility, PRIVATE service yok), D5 (sabit 5 rol, CHILD dahil), D11 (mobile read-only, satış sadece web), D15 (Day 1 partner = deep-link/PDF/mailto, "auto-sync" yok), D17 (mevcut user → PERSONAL workspace), D20 (Family $9.99/mo, $99/yıl), D21 (limit canonical), D23 (partnerHubAccess enum), D24 (Family/Pro label split)
- **Related docs**: 01-architecture-decisions.md, 02-workspace-model.md, 03-workspace-member-roles.md, 06-entitlements-system.md, 21-family-checkout-flow.md, 22-child-role.md, 23-shared-services.md, 24-family-budget-consolidated.md, 25-family-reminders-consolidated.md, 30-pro-plan-definition.md, 60-mobile-billing-readonly.md, 61-pricing-page-update.md, 62-subscription-plan-field-updates.md, 63-entitlement-banners-empty-states.md, 64-marketing-copy-updates.md, 66-email-templates.md

## Amaç

Family planını LocateFlow'un ikinci ücretli tier'ı olarak **tanımlamak**: limit matrisi, fiyat, positioning, billing tip tanımı, Stripe ürün ID'leri ve plan'ın diğer tier'lara göre farkı. Bu dosya `packages/shared/src/billing.ts` ve `packages/shared/src/entitlements.ts` (yeni) için **kanonik kaynaktır**. Checkout akışı 21, üye rolleri 03 ve 22, ortak servis modeli 23, bütçe görünümü 24, hatırlatıcılar 25, marketing kopyası 61 ve 64'tedir.

## Kapsam

In scope:
- Family plan'ın `BillingPlanDefinition` objesi (display name, fiyat, feature listesi)
- Limit matrisi (maxAddresses, maxServices, maxMembers, feature flag'ler) — D2 ile hizalı
- Stripe Price config key'leri (`STRIPE_PRICE_FAMILY_MONTHLY`, `STRIPE_PRICE_FAMILY_YEARLY`)
- Mobile IAP product ID'leri (D11 — Sprint 1'de kayıt, lansmanda **disabled**)
- Family vs Individual vs Pro karşılaştırma matrisi (feature parity tablosu)
- `BillingPlan` enum genişletmesi (kod tarafı — DB enum tarafı 62'de)
- Positioning ve pazarlama mesajı çerçevesi (detay metin 64'te)
- FAQ taslak başlıkları (tam içerik 64'te)

Out of scope:
- Checkout, webhook, upgrade akışı → 21-family-checkout-flow.md
- CHILD rolü detayları → 22-child-role.md
- Shared services model (paidByUserId + `ServiceAssignee` junction) → 23-shared-services.md
- Pro tanımı → 30-pro-plan-definition.md
- Subscription.plan enum DB tarafı → 62-subscription-plan-field-updates.md
- Pricing sayfası UI → 61-pricing-page-update.md
- Email şablonları → 66-email-templates.md

## User stories

- **Yeni ziyaretçi**: Anasayfa'daki pricing tablosunda Family sütununu görüp 1 ekran içinde "kaç adres, kaç üye, kaç servis, ne kadar para" sorularını cevaplayabilmek istiyorum.
- **Mevcut Individual müşteri**: Eşim de aynı evi paylaştığı için Family'ye upgrade etmek istiyorum; settings > subscription'da net bir "Upgrade to Family" butonu olmalı (akış 21'de).
- **Family OWNER**: Plan içinde tam olarak 5 üye davet hakkım (1 OWNER + 5 = 6 toplam) ve 17 adres / 250 servis limitim olmalı; bunu hem app içinde hem pricing sayfasında aynı sayıyla görmeliyim.
- **Aile reisi (potansiyel)**: Family planında her üye için ayrı parola/email olduğunu, çocuk hesabının finansal verileri göremediğini bilgilendirme metninde okumak istiyorum.
- **Pro'yu değerlendiren güçlü kullanıcı**: Family ile Pro arasındaki farkı (address label, partner hub, member sayısı) açık bir karşılaştırma tablosunda görmeliyim.

## Veri modeli

`Workspace`, `Subscription`, `Address`, `Service` modellerinin **kendisi** değişmez (Family için yeni bir Prisma model'i yok — D2 gereği plan davranışı `Subscription.plan` üzerinden türer). DB seviyesindeki tek değişiklik **enum genişlemesi**dir, o da 62-subscription-plan-field-updates.md'de işlenir. Burada referans amaçlı yapılan tek diff:

Schema artık `01a-canonical-values.md` §C5'te canonical olarak yaşıyor — bu doc'a kopyalamayın. Önemli not: `Subscription.plan` mevcut alan `@db.VarChar(30)` (enum DEĞİL), FAMILY/PRO eklemesi DB migration **istemez** (D17). Allowed values güncellenir.

Tüm geri kalan kapasite/limit/feature flag mantığı **kodda** (`packages/shared/src/entitlements.ts`) yaşar — D4 gereği DB row'ları üzerinden plan gating yapmıyoruz.

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/billing/plans` | Public | — | — | `BillingPlanDefinition[]` (FREE_TRIAL, INDIVIDUAL, FAMILY, PRO) | — |
| GET | `/api/billing/plans/family` | Public | — | — | `BillingPlanDefinition` (Family yalnız) + limit matrisi | 404 if disabled |

Bu endpoint'ler `getBillingPlanDefinition()` ve yeni `getPlanLimits('FAMILY')` çıktısını JSON olarak döner; pricing sayfası (61) ve mobile read-only ekran (60) bu kaynaktan beslenir. Cache: `s-maxage=300, stale-while-revalidate=600`.

### Mevcut endpoint'lere etki

- `/api/stripe/checkout` (apps/web/src/app/api/stripe/checkout/route.ts) — `plan=FAMILY` ve `interval=monthly|yearly` parametrelerini kabul eder; detaylar 21'de.
- `/api/billing/entitlement` (varsa) — Family için yeni limit ve feature flag setini döner; tüketici 06.
- `/api/webhooks/stripe` — yeni FAMILY price ID'lerini tanıyıp Subscription.plan'ı `FAMILY` olarak güncellemek için switch genişler; detay 21.

## Web

### Yeni sayfa/route
- Yeni standalone sayfa yok. Family tanımı `apps/web/src/components/marketing/pricing-section.tsx` (sütun eklenir — 61) ve `/settings/subscription` görünümünde tüketilir.

### Mevcut sayfalara etki
- `apps/web/src/components/marketing/pricing-section.tsx`: 2 sütundan 4 sütuna (Free / Individual / Family / Pro) — bu doc Family **içeriğinin** kanonik kaynağı, layout 61'de.
- `apps/web/src/app/(app)/settings/subscription/*` (mevcut path): "Plan badge" ve karşılaştırma drawer'ı Family için yeni satır gösterir.
- `apps/web/src/components/billing/PlanComparisonTable.tsx` (yeni veya mevcut) — feature matrisinin tek kaynaktan render edilmesi.

### Componentler (file paths)
- `apps/web/src/components/marketing/pricing-section.tsx` — Family sütunu (kopya 64'ten, fiyat 20'den).
- `apps/web/src/components/billing/PlanComparisonTable.tsx` — feature matrisi tablosu (bu doc'taki matristen build).
- `apps/web/src/components/billing/FamilyValueProp.tsx` — pricing sayfası altındaki açıklama bandı (3 ikon: paylaşılan servisler, çocuk modu, aile bütçesi).

### Butonlar / actionlar
- Pricing sayfası "Choose Family" butonu → 21'deki checkout akışı tetiklenir.
- Settings > Subscription > "Compare plans" → drawer açar, Family/Pro karşılaştırması.

## Mobile

### Yeni ekran
- Yok. Sadece `apps/mobile/app/settings/subscription.tsx` mevcut ekranı Family için yeni satırı **read-only** gösterir.

### Mevcut ekranlara etki
- `apps/mobile/app/settings/subscription.tsx`: Plan badge'i `FAMILY` değerini destekler. CTA "Upgrade on web" → `Linking.openURL('https://lf.io/upgrade')` (D11).
- IAP setup: `apps/mobile/src/lib/iap.ts` (mevcut expo-iap wrapper) içinde Family product ID'leri **kayıtlı ama purchase fonksiyonu disabled** (Sprint 1 itibarıyla App Store Connect + Play Console'a girilir, Faz 2'de purchase açılır). Detay 60.

### Componentler
- `apps/mobile/src/components/billing/PlanBadge.tsx` — `FAMILY` değerini destekler, etiket "Family" + altın rozet.
- `apps/mobile/src/components/billing/UpgradeOnWebBanner.tsx` — Family/Pro için CTA banner'ı.

## Admin

- Yeni admin sayfası yok. Mevcut `/admin/subscriptions` listesi `Subscription.plan = FAMILY` filtresini destekler (62'de enum genişledikten sonra otomatik). Admin manuel `FAMILY` plan atama yetkisi `/admin/users/[id]/subscription` route'unda enum'a yeni option olarak çıkar.

## Güvenlik

- [x] **Step-up auth**: Family **tanımı** için gerekmez. Family **satın alma** akışı (21) Stripe Checkout standart auth'unu kullanır; mevcut Individual ile aynı pencere.
- [x] **PII redaction**: Plan definition objesi PII içermez (sadece string/number). Pricing endpoint çıktısı log'lara dökülse bile sorun yok.
- [x] **Audit log**: Plan upgrade event'i 21'de audit'lenir; bu doc kapsamında ayrı log noktası yok.
- [x] **Rate limit**: `/api/billing/plans*` public endpoint — 60 req/dakika IP başına (mevcut `apps/web/src/lib/rate-limit.ts`).
- [x] **Permission matris**: Plan definition tüm rollere okuma, hiçbir role yazma. Plan-bazlı feature gating 03 ve 06'da.
- [x] **Encryption at rest**: Plan config string değer; encryption gerekmez. Stripe Price ID'leri public-safe.
- [x] **GDPR DSAR**: Plan tanımı user verisi değil; DSAR export'a girmez.

## Migration / backward compat

- `packages/shared/src/billing.ts` değişiklikleri **purely additive**:
  - `BILLING_PLAN_ORDER` → `["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"] as const` (PRO da paralelde eklenir, 30'da işlenir).
  - `PAID_BILLING_PLANS` → `["INDIVIDUAL", "FAMILY", "PRO"] as const`.
  - `BILLING_PLAN_DEFINITIONS` → `FAMILY` ve `PRO` entry'leri eklenir (aşağıdaki tam obje).
  - `BILLING_PRODUCT_CONFIG_KEYS.web` → `FAMILY_MONTHLY`, `FAMILY_YEARLY`, `PRO_MONTHLY`, `PRO_YEARLY` key'leri.
- Mevcut Individual müşterileri **etkilenmez** (D20: grandfather yok, çünkü Individual fiyatı da değişmiyor).
- Mobile build'lerinin eski sürümleri yeni plan değerlerini görürse `getBillingPlanDefinition()` fallback FREE_TRIAL döner; UI'da "Unknown plan" yerine güvenli default gösterilir. Mobile minimum supported version 21 ve 60'ta tanımlanır.
- DB enum genişlemesi (62) ile bu kod değişikliği **aynı sprint deploy edilir**, sıra: önce DB migration (idempotent VARCHAR genişletmesi gerekmez, zaten VARCHAR(20)), sonra shared package release, sonra web/mobile.

### Tam BillingPlanDefinition entry'si

```ts
// packages/shared/src/billing.ts
FAMILY: {
  id: "FAMILY",
  displayName: "Family",
  shortDescription: "For households sharing a home and bills. Up to 6 members.",
  priceLabel: "$9.99",
  periodLabel: "/month",
  monthlyPriceUsd: 9.99,
  yearlyPriceLabel: "$99/year",
  yearlyPriceUsd: 99,
  isPaid: true,
  features: [
    "Up to 6 members (1 owner + 5)",
    "17 addresses",
    "250 services",
    "Shared services (who pays, who uses)",
    "Family budget view",
    "Consolidated household reminders",
    "Child mode (no financial visibility)",
    "USPS Mover's Guide deep link",
    "Bill & renewal reminders",
    "Document storage",
    "Export anytime (CSV, PDF)",
  ],
},
```

### Limit matrisi (entitlements.ts kaynak)

```ts
// packages/shared/src/entitlements.ts (yeni dosya — D14 adapter pattern)
FAMILY: {
  maxAddresses: 17,
  maxServices: 250,
  maxMembers: 6,                  // 1 OWNER + 5
  householdScopes: true,          // adres değişikliği scope'lu (D6 USER target)
  sharedServices: true,           // 23-shared-services.md
  familyBudgetView: true,         // 24-family-budget-consolidated.md
  consolidatedReminders: true,    // 25-family-reminders-consolidated.md
  addressLabels: ["HOME", "DORM", "VACATION", "OTHER"], // canonical §C12 / D24
  partnerHubAccess: "none",       // canonical §C11 / D23 — enum: none|teaser|full
  uspsDeepLink: true,             // Family için tek partner deep-link
  exports: ["CSV", "PDF"],
  actionTiers: ["BASIC", "EXTENDED"], // D4 — PREMIUM Pro'ya
},
```

## Etkilenen mevcut özellikler

- **`packages/shared/src/billing.ts`**: enum + definitions genişler (yukarıda).
- **`apps/web/src/lib/plan-limits.ts`**: D14 gereği adapter; içeride `entitlements.ts` çağrısı yapar. Mevcut `checkAddressLimit(userId)` imzası bozulmaz, içeride workspace'in owner subscription'ından okur.
- **`apps/web/src/lib/billing.ts`**: `isPaidBillingPlan('FAMILY')` true döner; mevcut tüm gate'ler otomatik çalışır.
- **`apps/web/src/components/marketing/pricing-section.tsx`**: 2 sütundan 4 sütuna (layout 61'de).
- **`apps/mobile/src/components/billing/PlanBadge.tsx`**: FAMILY etiketini destekler.
- **`packages/shared/src/acquisition.ts`**: Family için campaign tip desteği (21'de detay).
- **Tüm tests**: `packages/shared/src/__tests__/billing.test.ts` (eğer varsa) FAMILY entry'si için snapshot/assertion'lar eklenir.

## Karşılaştırma matrisi

| Özellik | Free Trial | Individual | **Family** | Pro |
|---|---|---|---|---|
| Aylık fiyat | $0 | $3.99 | **$9.99** | $19.99 |
| Yıllık fiyat | — | $39.99 | **$99** | $199 |
| Member sayısı | 1 | 1 | **6 (1+5)** | 10 (canonical §C1) |
| Adres limiti | 2 | 10 | **17** | 25 (canonical §C1) |
| Servis limiti | 10 | 100 | **250** | 1000 |
| Shared services (paidBy + ServiceAssignee) | — | — | **✓** | ✓ |
| Family budget view | — | — | **✓** | ✓ (Workspace budget) |
| Consolidated reminders | — | — | **✓** | ✓ |
| Child role | — | — | **✓** | ✓ |
| Address labels (canonical §C12) | HOME, OTHER | HOME, OTHER | **HOME, DORM, VACATION, OTHER** | + OFFICE, RENTAL, WAREHOUSE |
| Partner Hub (canonical §C11 enum) | none | none | **none** | full |
| USPS deep-link | ✓ | ✓ | **✓** | ✓ |
| Address change wizard (USER/ADDRESS/CUSTOM scope) | — | basit | **USER scope** | tüm scope'lar |
| Tax/property CSV export | — | CSV | **CSV + PDF** | CSV + PDF + per-label |
| Bulk action queue dashboard | — | — | **✓** | ✓ |
| Action tier'lar (D4) | BASIC | BASIC | **BASIC + EXTENDED** | BASIC + EXTENDED + PREMIUM |

## Family vs Individual — açıkça **ne kazanılır**

- 6x üye, 1.7x adres, 2.5x servis kapasitesi.
- Eşin/ev arkadaşının kendi login'iyle aynı evdeki internet/elektrik/su servislerini görebilmesi.
- Bütçe konsolidasyonu — "Bu ay Mehmet $230, Ayşe $180 ödedi" görünümü (24).
- Çocuk hesabı (CHILD) için para görünmez, sadece kendi adresi ve servisi (22).
- Tek bir adres değişikliği "Mehmet'in tüm servisleri" scope'unda toplu çalışır (D6 USER target).

## Family vs Pro — Pro'nun ek getirdiği

- `Address.label` Pro-only ek değerleri: OFFICE, RENTAL, WAREHOUSE (D18 + D24 — Family HOME/DORM/VACATION/OTHER kullanabilir; 32).
- Partner Hub `full` erişim (canonical §C11 / D23): 10–15 lansman partner + sonradan eklenecek registry (D28 sliced MVP); Family'de Partner Hub erişimi `none`, yalnızca USPS deep-link 'open & update' UX'i var.
- PartnerSyncAttempt tracking, deep-link launcher, PDF letter generator, mailto template kütüphanesi (35–38).
- Vendor contact book (kullanıcı kendi partner template'ini kaydeder, 39).
- Per-label tax export (40).
- PREMIUM action tier erişimi (D4 — ör. "Open USPS as a moving company representative").

## Stripe Price ID'leri (config key'ler)

`BILLING_PRODUCT_CONFIG_KEYS.web` içine eklenir:

```ts
FAMILY_MONTHLY: "STRIPE_PRICE_FAMILY_MONTHLY",
FAMILY_YEARLY:  "STRIPE_PRICE_FAMILY_YEARLY",
```

Gerçek Stripe Price ID değerleri Sprint 4'te Stripe Dashboard'da yaratılır ve `apps/web/.env` (server-only) içine yazılır:

```
STRIPE_PRICE_FAMILY_MONTHLY=price_xxx
STRIPE_PRICE_FAMILY_YEARLY=price_yyy
```

Validation: `apps/web/src/lib/billing-config.ts` startup'ta bu env'leri zorunlu kabul eder (FAMILY plan etkinse). Eksikse server boot fail → checkout endpoint 503.

## Mobile IAP product ID'leri (Sprint 1'de kayıt, lansmanda **disabled** — D11)

App Store Connect ve Play Console'da yaratılır:

```
com.locateflow.family.monthly
com.locateflow.family.annual
```

`apps/mobile/src/lib/iap.ts` içinde:

```ts
export const IAP_PRODUCTS = {
  FAMILY_MONTHLY: "com.locateflow.family.monthly",
  FAMILY_ANNUAL:  "com.locateflow.family.annual",
  PRO_MONTHLY:    "com.locateflow.pro.monthly",
  PRO_ANNUAL:     "com.locateflow.pro.annual",
} as const;

export const IAP_ENABLED_FOR_PURCHASE = {
  FAMILY_MONTHLY: false,  // Faz 2
  FAMILY_ANNUAL:  false,
  PRO_MONTHLY:    false,
  PRO_ANNUAL:     false,
} as const;
```

Lansmanda `Linking.openURL('https://lf.io/upgrade')` davranışı (60).

## FAQ entry'leri (taslak — tam metin 64-marketing-copy-updates.md'de)

1. "Kim Family için uygun?" → 2+ kişilik haneler, ev arkadaşları, ebeveyn + çocuk.
2. "Üyeler ayrı hesap mı?" → Evet, her üyenin kendi LocateFlow login'i; davet email + token (04).
3. "Çocuk hesabı parayı görür mü?" → Hayır; sadece kendi servisleri ve genel hatırlatıcılar (22).
4. "Eşim Family aboneliğimi App Store'dan iptal edebilir mi?" → Hayır, owner'ın subscription yönetimi (Stripe portal veya iOS app store — hangisinden satın alındıysa). D12 + 17.
5. "Pro'ya geçersem üyelerim ne olur?" → Korunur; limit 25'e çıkar (overflow yaratmaz).
6. "Family'den Individual'a düşersem?" → Owner subscription downgrade'inde 7 gün grace, sonra 5 ek üye `OVERFLOW` (D2); detay 63.
7. "Adres değişikliğinde her üyenin servisi otomatik mi taşınır?" → Hayır, USER scope'u seçilir, kullanıcı onaylar (D6, 13).
8. "Partner sync ne kadar otomatik?" → Day 1'de deep-link + clipboard + PDF/mailto (D15). Family'de yalnızca USPS deep-link aktif.

## Marketing copy çapaları (tam metin 64'te)

- **Hero**: "Aileniz için tek panel, paylaşılan adresler ve servisler."
- **Subhead**: "6 kişiye kadar üye, 17 adres, 250 servis. Çocuk hesabı, aile bütçesi, tek hatırlatıcı feed."
- **CTA**: "Try free for 14 days" → /signup?intent=family
- **Sosyal kanıt** (Faz 2): Testimonial slot'u (Day 1'de boş).

## Test plan

### Unit
- `packages/shared/src/__tests__/billing.test.ts`:
  - `getBillingPlanDefinition('FAMILY')` döner Family obj.
  - `isPaidBillingPlan('FAMILY')` true.
  - `BILLING_PLAN_ORDER` length === 4.
  - `BILLING_PRODUCT_CONFIG_KEYS.web` Family key'leri içerir.
- `packages/shared/src/__tests__/entitlements.test.ts` (yeni):
  - Family limit matrix: 17/250/6.
  - `addressLabels=false`, `partnerHub=false`, `householdScopes=true`.
- `apps/web/src/lib/billing-config.test.ts`: Family env eksikse boot fail (test-only flag ile mock).

### Integration
- `GET /api/billing/plans` → response includes Family with correct fields.
- `GET /api/billing/plans/family` → 200 + matrix; mobile cache header.
- Pricing component snapshot test 4 sütun.

### E2E (Playwright)
- Pricing sayfasından "Choose Family" → 21'deki checkout flow başlar (yalnızca redirect URL doğrulanır, akış 21 testlerinde).
- Settings > Subscription'da plan badge FAMILY için doğru render.

### Manual QA
- Stripe Dashboard'da yaratılan Price ID'leri env'e girip pricing sayfası, checkout redirect ve webhook'un Plan'ı `FAMILY` olarak yazdığını manuel test (Test mode).
- Mobile build'de plan badge FAMILY için doğru renk + "Upgrade on web" banner.

## Açık sorular

- [ ] Family yıllık fiyat $99 yerine $99.99 mı (Stripe display tutarlılığı)? — D20'de $99, **fixed**, ancak Stripe Price create ederken kuruş gösterimi `9900` olarak girilecek.
- [ ] Marketing'in "1 OWNER + 5 = 6 üye" cümlesini "6 family members" olarak basitleştirip basitleştirmemesi (yanıltıcı olabilir) — 64'te dilbilgisel kontrol.
- [ ] FREE_TRIAL kullanıcısı Family'ye trial uzantısıyla mı geçer yoksa direkt paid'e mi düşer? → 21'de açıklık.
- [ ] Faz 2'de mobile IAP açıldığında web vs mobile fiyat farkı (App Store %30 komisyonu) yansıtılacak mı? — şimdilik 60'ta "aynı fiyat, marj kabul" yorumu.
- [ ] Acquisition campaign'i Family için ayrı code namespace'i mi (`FAMILY-2026`) yoksa generic mi? — 21'de campaign desteği detayı.
