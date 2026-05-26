# Marketing Pricing Page — 4-Column Update

> **Drift fix 2026-05-23** — Canonical kaynak [`01a-canonical-values.md`](./01a-canonical-values.md) §C1 (limit matrix) ve §C2 (pricing). Bu doc'taki sayısal/string değerler canonical ile çelişirse canonical kazanır. `61` doc'unun hardcoded Individual refactor not'u zaten içeride; data-driven UI (`BILLING_PLAN_DEFINITIONS`) tek kaynak olmalı.

- **Status**: Proposed (Family/Pro launch, Sprint 4)
- **Tier**: Cross-cutting
- **Related decisions**: D20 (fixed pricing), D1 (workspace labels), D11 (web-only sales), D21 (limit canonical)
- **Related docs**: [20](./20-family-plan-definition.md), [30](./30-pro-plan-definition.md), [62](./62-subscription-plan-field-updates.md), [64](./64-marketing-copy-updates.md), [65](./65-analytics-events.md), [67](./67-i18n-tr-en.md)

## Amaç

Marketing pricing section'ı mevcut **2 sütun (Free Trial + Individual)** yapısından **4 sütun (Free / Individual / Family / Pro)** yapısına geçirmek. D20 sabit fiyat tablosunu sergilemek, plan comparison matrix'iyle desteklemek, monthly/annual toggle ile annual indirimini öne çıkarmak, "Most Popular" rozeti Pro'da göstermek.

## Kapsam

**In scope**
- `apps/web/src/components/marketing/pricing-section.tsx` 4-column refactor (~382 satır → ~600 satır)
- Plan comparison matrix beneath cards (feature × plan grid)
- Monthly/Annual toggle (Annual default selected → savings prominent)
- FAQ block güncelleme (`apps/web/src/components/marketing/` içinde FAQ varsa veya inline)
- "Most Popular" badge Pro card'ında
- Mobile responsive: ≥1024px 4 col, 768–1024px 2×2 grid, <768px tek sütun vertical stack
- Analytics: per-card CTA click track
- Cross-link: header'dan `/pricing`'e link (zaten var, değişmez)

**Out of scope**
- `/upgrade` checkout sayfası (cross-ref 21, 31)
- Stripe Price ID setup (cross-ref 20, 30)
- Mobile in-app paywall (cross-ref 60)
- Blog post yazımı (cross-ref 64)

## User stories

- **US-61.1** — Anonim ziyaretçi `/` (anasayfa) veya `/pricing`'e gelir; 4 plan kartını görür; her birinde aylık/yıllık fiyat, feature listesi, CTA.
- **US-61.2** — Ziyaretçi "Monthly / Annual" toggle'ını çevirir; her kartta fiyat ve "save 17%" / "save 17%" rozetleri güncellenir.
- **US-61.3** — Pro card'ında "Most Popular" rozeti — landlord/multi-property kullanıcısı için (hedef segment, cross-ref 30 positioning).
- **US-61.4** — Plan comparison matrix'inde "Workspace members", "Addresses", "Services", "Partner Hub", "Tax export" gibi rows; her plan column'unda ✓ / sayı / —.
- **US-61.5** — FAQ "What's the difference between Family and Pro?" tıklanır; accordion açılır; cross-link bloglara (cross-ref 64).
- **US-61.6** — Mobile cihazda 4 kart tek sütunda vertical scroll; Pro üstte (most popular) veya tier order'da — A/B test parametresi.
- **US-61.7** — Logged-in Individual kullanıcı pricing sayfasına gelir; kendi planı "Current plan" rozetiyle işaretli; Family/Pro CTA'sı "Upgrade to Family" / "Upgrade to Pro".

## Veri modeli

N/A — pure FE/copy değişikliği. Plan tanımları `packages/shared/src/billing.ts` `BILLING_PLAN_DEFINITIONS` extension (cross-ref 62) burada **import edilir**, hardcode edilmez.

## API endpoint'leri

N/A. Mevcut `PublicCampaignForPricing` / `PublicOffersForPricing` prop'ları korunur (acquisition campaign override için).

## Web

### Yeni sayfa/route

`/pricing` ayrı bir route olarak **zaten yok** muhtemelen (anasayfa içinde section). Bu doc bunu değiştirmiyor; `apps/web/src/app/page.tsx` içindeki `<PricingSection>` çağrısı yeterli. Eğer `/pricing` standalone yapılacaksa ayrı doc.

### Mevcut sayfalara etki

- `apps/web/src/app/page.tsx` — `<PricingSection>` import değişmiyor, sadece prop sözleşmesi genişler (campaign için Family/Pro override eklenirse Faz 1.5).
- `apps/web/src/app/(marketing)/individual/page.tsx` (varsa) — Individual-specific landing; etkilenmez ama footer'da "See all plans" link'i pricing section'a anchor.
- Header CTA "See pricing" — anchor `#pricing` aynı kalır.

### Componentler (file paths)

**`apps/web/src/components/marketing/pricing-section.tsx`** — Major rework. Yeni dahili componentler:

```
PricingSection (existing, exported)
├── PricingHeader            // toggle + intro copy
├── PlanCard × 4             // Free | Individual | Family | Pro
│   ├── PlanBadge            // "Most Popular" only on Pro
│   ├── PlanPriceBlock       // $ + period + annual savings
│   ├── PlanFeatureList      // 5–7 bullet items per plan
│   └── PlanCta              // primary button
├── PlanComparisonMatrix     // feature × plan grid (collapsible on mobile)
└── PricingFaq               // 5–6 accordion items
```

Dosya bölümleme: `pricing-section.tsx` (orchestrator) + alt componentler aynı dosyada **veya** ayrı dosyalar `apps/web/src/components/marketing/pricing/` klasörü altında. Tercih: ayrı klasör (382 satır zaten büyük, 4 plan ile 800+ olur, modülerlik şart).

```
apps/web/src/components/marketing/pricing/
  pricing-section.tsx         // exported, orchestrator
  plan-card.tsx               // parameterized card
  plan-comparison-matrix.tsx  // table
  pricing-faq.tsx             // accordion list
  pricing-billing-toggle.tsx  // monthly/annual switch
  plan-data.ts                // tier-specific FE-only data (badge, color, order)
  pricing-section.test.tsx    // mevcut test taşınır, genişler
```

Mevcut testler (`pricing-section.test.tsx`) refactor: 4 plan kartının render edilmesi, toggle davranışı, "Most Popular" sadece Pro'da, comparison matrix toggle.

**Plan order, soldan sağa**: Free Trial → Individual → Family → Pro. Pro "Most Popular" rozetli en sağda (görsel hierarchy: en pahalı en sağ, eye → highest-LTV son durur).

**Color theming**: mevcut `bg-primary/10` paleti ile uyum:
- Free: muted gray border
- Individual: subtle primary outline
- Family: warm accent (yeni token önerisi `--accent-family`, fallback amber-500)
- Pro: primary solid border + "Most Popular" badge primary fill

### Butonlar / actionlar

Plan card CTA'ları (logged-out kullanıcı için):

| Plan | CTA copy | Hedef |
|---|---|---|
| Free Trial | "Start 14-day free trial" | `/signup?plan=free` |
| Individual | "Start with Individual" | `/signup?plan=individual&interval={monthly|annual}` |
| Family | "Start with Family" | `/signup?plan=family&interval={monthly|annual}` |
| Pro | "Start with Pro" | `/signup?plan=pro&interval={monthly|annual}` |

Logged-in kullanıcı için:

| Mevcut plan | Card | CTA |
|---|---|---|
| FREE_TRIAL | herhangi paid | "Upgrade to X" → `/upgrade?plan=X&interval=...` |
| INDIVIDUAL | Individual | "Current plan" disabled |
| INDIVIDUAL | Family/Pro | "Upgrade to X" |
| FAMILY | Family | "Current plan" disabled |
| FAMILY | Pro | "Upgrade to Pro" |
| FAMILY | Individual | "Downgrade" (muted, modal warning) |
| PRO | Pro | "Current plan" disabled |
| PRO | Family/Individual | "Downgrade" |

`ctaIntent` prop genişler: `"anonymous" | "manage" | "upgrade" | "downgrade"`.

Annual toggle state URL'e yansıtılır (`?billing=annual`) — paylaşılan link doğru toggle ile açılır.

## Mobile

### Yeni ekran

N/A — mobile in-app'te pricing sayfası gösterilmez (D11). Mobile'dan "Upgrade on web" tıklanınca `https://lf.io/upgrade` external browser'da açılır (cross-ref 60).

### Mevcut ekranlara etki

`apps/mobile/app/(auth)/paywall.tsx` (varsa) sadece Individual gösterir, değişmez. Faz 2'de mobile paywall'a Family/Pro eklenirse ayrı doc.

## Admin

Admin'de `apps/admin/src/app/(admin)/acquisition/` campaign editör'ü Faz 1 sonrası "Family CTA override" / "Pro CTA override" alanlarıyla genişlemeli (Sprint 5 stretch). MVP'de plan tanımları `BILLING_PLAN_DEFINITIONS`'tan gelir, override yok.

## Güvenlik

- [x] **Step-up auth?** — Hayır, public marketing sayfası.
- [x] **PII redaction?** — Hayır, PII yok.
- [x] **Audit log?** — Hayır. Analytics event (`pricing.cta.clicked` cross-ref 65) yeterli.
- [x] **Rate limit?** — Hayır, static render. CTA click endpoint'i (analytics) mevcut rate limit'i içinde.
- [x] **Permission matris?** — Public.
- [x] **Encryption at rest?** — N/A.
- [x] **GDPR DSAR?** — N/A.

## Migration / backward compat

- Mevcut `<PricingSection>` prop'ları (campaign, offers, ctaHref) korunur — geriye uyumlu.
- Mevcut testler taşınır, kırılmaz (yeni testler eklenir).
- Mevcut `pricing-section.tsx` `INDIVIDUAL_FEATURES` array'i Individual card'ında aynen kullanılır; Family/Pro için **yeni** feature array'leri (D20 + cross-ref 20, 30).
- Anchor `#pricing` korunur (eski link'ler çalışır).

## Etkilenen mevcut özellikler

- Anasayfa `apps/web/src/app/page.tsx` — section hala render olur, görsel ağırlık artar
- Acquisition campaign override flow (`apps/web/src/lib/acquisition-campaigns.ts`) — Family/Pro override Faz 2'ye, MVP'de yok
- SEO meta `apps/web/src/app/page.tsx` veya `layout.tsx` — meta description "for individuals, families and landlords" güncellenir (cross-ref 64)
- Footer plan link'leri (varsa `marketing-footer.tsx`) — "Family" + "Pro" link'leri eklenir → anchor `#pricing`

## Test plan

**Unit**
- `pricing-section.test.tsx` (mevcut, genişler):
  - 4 plan kartı render edilir
  - Toggle "monthly" → fiyat $9.99 (Family); "annual" → $99/year + "save 17%" rozeti
  - "Most Popular" sadece Pro card'ında
  - Logged-in INDIVIDUAL kullanıcı: Individual card disabled, Family/Pro "Upgrade"
- `plan-comparison-matrix.test.tsx` (yeni) — feature × plan grid doğru hücreleri doldurur
- `pricing-faq.test.tsx` (yeni) — accordion açılır/kapanır, içerikler render olur

**Integration**
- `apps/web/src/app/page.tsx` E2E (Playwright veya Vitest with browser): pricing scroll'a, 4 kart görünür, CTA tıklanır → `/signup?plan=family` route'a yönlenir

**E2E (Playwright)**
- Anonim kullanıcı → toggle annual → Family CTA tıklar → signup'a `plan=family&interval=annual` query ile gider
- Logged-in Individual → /pricing scroll → Family "Upgrade to Family" tıklar → `/upgrade?plan=family` → checkout (cross-ref 21)
- Mobile viewport (375×667) → 4 kart vertical stack, "Most Popular" hala görünür

**Visual regression**
- Chromatic veya Percy: desktop (1440), tablet (768), mobile (375) snapshot'ları

**Manual**
- Lighthouse: LCP < 2.5s (önceki baseline ile karşılaştır), CLS ≤ 0.1
- a11y: keyboard nav 4 kart arası tab order doğru, screen reader "plan: Family, price: $9.99/month" gibi okur

## Açık sorular

1. **A/B test**: Pro her zaman "Most Popular" mı yoksa Family de denenmeli mi? Hedef segment Family > Pro hacim olarak, ama Pro LTV daha yüksek. Marketing team karar versin.
2. **`/pricing` standalone route**: SEO için ayrı sayfa daha mı iyi? Anasayfa section'ı kalır + ek `/pricing` page (deep-link friendly). Faz 1.5'e bırak.
3. **Annual interval default**: Toggle ilk yüklemede "monthly" mi "annual" mı seçili gelsin? Annual = daha düşük fiyat görünür ama "okay price" hissi. A/B test parametresi.
4. **i18n**: TR string'leri (cross-ref 67) ne zaman eklenir? Çıkış 1: en + es (mevcut). TR ileride. Doc 67 bunu açıklıyor.
5. **"Custom Enterprise" 5. kart**: Pro'nun üstüne contact-sales kartı eklenir mi? MVP'de hayır — Pro yeterli.
6. **Plan comparison matrix mobile UX**: Tam tablo yatay scroll mu yoksa "Compare plans" linki açılan modal mı? Tercih: mobile'da default kapalı, "Compare all features" butonu modal/expand.
