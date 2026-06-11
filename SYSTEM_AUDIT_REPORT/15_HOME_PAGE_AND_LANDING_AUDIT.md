# Home Page ve Landing Denetimi

## Sayfa/Screen Listesi

- Homepage: `apps/web/src/app/page.tsx`
- Pricing: `apps/web/src/app/pricing/page.tsx`, `components/marketing/pricing-section.tsx`
- How it works: `apps/web/src/app/how-it-works/page.tsx`
- About/FAQ/provider coverage/legal pages.

## Route Listesi

Public route'lar middleware `PUBLIC_PATHS` listesinde. Public API exact/prefix allowlist ayrı tutuluyor.

## Component Listesi

- Marketing header
- Moving moment mock
- Pricing section
- App Store CTA
- Connector section
- Family/workspace section
- Feature cards

## API Bağlantıları

Homepage doğrudan feature flag/runtime config ile bazı sectionları conditional render ediyor. Pricing CTA checkout'a query param ile yönlendiriyor; gerçek price server-side çözülüyor.

## Kullanıcı Akışları

1. Homepage CTA -> sign-up/login.
2. Pricing -> checkout/sign-up.
3. App Store CTA -> mobile app install/open.
4. FAQ/about/provider coverage -> education/trust.

## UI Bulguları

- AUD-001: Documents copy real feature ile uyumsuz.
- AUD-002: "Snap a bill" mobile capture vaadi yok.
- AUD-003: "USPS forwarding setup, automatically" fazla iddialı.

## UX Bulguları

- Positive: Manual coordination disclaimers mevcut.
- Positive: Connector section "supported partners" ve guided fallback dilini kullanıyor.
- Risk: Aynı landing içinde manual disclaimers ve automatic bullet birbiriyle çelişiyor.

## Hata/Eksik/Yanlış Bulguları

| ID | Copy | Sonuç |
|---|---|---|
| AUD-001 | Documents in one place | ❌ Feature yok |
| AUD-002 | Snap a bill | ❌ Mobile capture yok |
| AUD-003 | USPS forwarding setup automatically | ⚠️ Connector capability koşullu |

## Permission Bulguları

Landing public olduğu için permission yok. Ancak pricing/checkout CTA'sında backend auth ve subscription checks mevcut.

## Data Tutarlılığı

Pricing plan limitleri shared billing ve plan-limits dosyalarıyla büyük ölçüde uyumlu. Connector claims conditional olmalı.

## SEO / Open Graph

SEO helper ve public AI discovery metinleri var. Ancak AI discovery içinde documents ve provider update iddiaları current feature uyumluluğu açısından temizlenmeli.

## Öneriler

1. Copy audit testleri: forbidden claims list.
2. Connector capability-aware copy.
3. Documents/bill snap copy cleanup.
4. Pricing page server-side plan availability warning devam etmeli.
