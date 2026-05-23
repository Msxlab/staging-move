# Marketing Copy Updates — Homepage, FAQ, Blog, Email Signatures

- **Status**: Proposed (Family/Pro launch, Sprint 3 draft + Sprint 4 publish)
- **Tier**: Cross-cutting
- **Related decisions**: D1 (workspace labels), D11 (web-only sales), D15 (no false partner sync claims), D20 (pricing)
- **Related docs**: [61](./61-pricing-page-update.md), [20](./20-family-plan-definition.md), [30](./30-pro-plan-definition.md), [66](./66-email-templates.md), [67](./67-i18n-tr-en.md)

## Amaç

Lansman ile birlikte LocateFlow'un kamu yüzü "tek kişilik adres yöneticisi" mesajından "**you, your family, your portfolio**" üç-tier mesajına geçer. Bu doc: anasayfa hero, FAQ, blog pipeline, email signature, social cards ve SEO meta için **somut kopya değişiklikleri** + **kopya prensipleri** + hangi dosyaların güncelleneceği.

## Kapsam

**In scope**
- `apps/web/src/app/page.tsx` hero section copy + illustration slot
- FAQ block (anasayfa içinde veya ayrı `/faq` route) yeni 5 soru
- Blog post outline'ları (gerçek yazı içerik teamine; outline bu doc'ta)
- Marketing email footer / signature (cross-ref 66 ile koordine)
- Social cards (OG image) tasarım brief + path
- SEO meta description + Open Graph title yenilemesi
- i18n key envanteri (cross-ref 67)
- Testimonial slot (Family + Pro placeholder, gerçek müşteri review'ı yokken sentetik veya beta tester quote)

**Out of scope**
- Pricing kartlarının kendisi (cross-ref 61)
- Email template implementasyonu (cross-ref 66)
- Blog post **yazımı** (içerik teamine handoff — bu doc outline verir)
- Press release / partnership announce

## User stories

- **US-64.1** — Anonim ziyaretçi anasayfaya girer; hero "Move once. Update everything — for you, your family, or your whole portfolio." mesajını okur; alt subhead "Track every address, every account, every renewal. From one move to a hundred."; üç-tier illustration (kişi → aile → mülk listesi).
- **US-64.2** — Ziyaretçi FAQ'ye scroll eder; "Can I share my subscription with my family?" sorusunu görür → Family plan açıklaması, link to pricing.
- **US-64.3** — Landlord segmenti Google'dan "manage multiple rental property addresses" araması ile geldi; blog post "Family vs Pro: which is right for you?" landing page'i.
- **US-64.4** — Mevcut müşteri (Individual) anasayfaya tekrar gelir; hero değişmiş, "still works for you" mesajı kalmıştır (mevcut müşteriyi yabancılaştırmaz).
- **US-64.5** — Receipt email'in altında "LocateFlow — Move once, update everywhere." tagline (eski "for one person" varsa kaldırılır).

## Veri modeli

N/A — kopya değişikliği. Blog post'lar mevcut `BlogPost` modeli (cross-ref `packages/db/prisma/seed-blog.ts`).

## API endpoint'leri

N/A.

## Web

### Yeni sayfa/route

- (Opsiyonel, Sprint 4 stretch) `/family` ve `/landlords` veya `/property-managers` landing page'leri SEO için. **MVP**: hayır, anasayfa + blog yeterli. Faz 2'de segment-specific landing.

### Mevcut sayfalara etki

**`apps/web/src/app/page.tsx`** — Hero section:

Mevcut hero (yaklaşık):
> "Track your home services in one place."

Yeni hero (örnek, kopya teamine açık):
> "Move once. Update everything."
>
> Subhead: "Whether you're moving yourself, your family, or your rental portfolio — LocateFlow keeps every address, account and renewal in sync."

Görsel: Üç-tier illustration. Tek kişi (Individual) → ev içi aile (Family) → mülk grid'i (Pro). `apps/web/public/marketing/hero/three-tier.svg` (yeni asset, design team brief).

**Testimonial slot** — Mevcut `testimonial-quote.tsx` componenti tek kişilik kullanılıyor. Genişletme: 3 quote rotator (Individual müşteri, Family beta tester, Pro landlord). Beta tester yoksa placeholder + "Real customers, real moves" rozeti, çıkışta gerçek quote'lar enjekte edilir.

**Hard stats `hard-stats.tsx`** — Mevcut "5 minutes to set up" gibi stat'lar Family/Pro perspektifiyle güncellenir mi? Önerilen: stat'lar plan-agnostic kalır, ek bir stat: "Cancel a service in 30 seconds across every address" gibi cross-tier mesaj.

### Componentler (file paths)

| Dosya | Değişiklik |
|---|---|
| `apps/web/src/app/page.tsx` | Hero kopya + illustration slot |
| `apps/web/src/components/marketing/hero-phone-mock.tsx` | Belki rebrand "moving moment" — mevcut illustration korunur veya 3-tier varyant |
| `apps/web/src/components/marketing/testimonial-quote.tsx` | 3-quote rotator destekler (props array) |
| `apps/web/src/components/marketing/hard-stats.tsx` | Yeni cross-tier stat (opsiyonel) |
| `apps/web/src/components/marketing/bilingual-showcase.tsx` | TR/EN/ES showcase — etkilenmez veya yeni Family/Pro screenshot'larıyla genişler |
| `apps/web/src/components/marketing/marketing-footer.tsx` | Footer link grubu "Plans": Individual / Family / Pro / Compare |
| `apps/web/src/components/marketing/marketing-header.tsx` | Header nav "Pricing" link'i + "For families" / "For landlords" dropdown (opsiyonel Faz 1.5) |

**Yeni componentler** (varsa):
- `apps/web/src/components/marketing/three-tier-hero.tsx` — illustration + 3-tier label
- `apps/web/src/components/marketing/customer-segment-strip.tsx` — "For individuals / For families / For landlords" üç-kart strip

### FAQ block

Lokasyon: anasayfa içinde `<MarketingFaq>` componenti (varsa) veya ayrı `apps/web/src/components/marketing/marketing-faq.tsx` yaratılır. İçerik kaynağı: `apps/web/src/lib/help-content.ts` veya inline JSON.

**Yeni 5 soru** (cevap drafts):

1. **"Can I share my subscription with my family?"**
   > Yes — our Family plan lets up to 6 people share one workspace. Each member has their own login, their own services, and you choose what's shared (like the home address) vs private (like a personal email account). Owner pays once, everyone gets full access.

2. **"I have multiple rental properties — what's the right plan for me?"**
   > Pro is built for landlords and property managers. You get up to 100 addresses with labels (Home, Rental, Vacation, etc.), Partner Hub for one-tap utility updates, tax-ready property exports, and up to 50 collaborator seats for your team or accountant.

3. **"What happens if I downgrade from Pro to Family?"**
   > You won't lose any data. Existing addresses and members stay accessible. You won't be able to **add new** addresses or invite new members beyond the Family limits (25 addresses, 6 members) until you upgrade again. We call this read-write protection — never read-only on what you've built. (Details: 7-day grace period and seat overflow handling.)

4. **"Can my child have their own account on Family?"**
   > Absolutely. Children can be invited with the CHILD role — they manage their own addresses (like a dorm or first apartment), see their own services, but the family billing and account-level controls stay with the owner. Financial info stays private from the child by default.

5. **"How does the partner integration work?"**
   > Pro's Partner Hub lists 100+ utility, government, insurance and subscription providers. When you move, you tap "Open & Update →" on any provider — we pre-fill your old address, new address and account number on your clipboard, open the provider's change-of-address page in a new tab, and track that you've completed the update. **Today we don't have direct API agreements**, so nothing happens behind the scenes automatically — you're always the one clicking Submit on the provider's site. (Per D15 — no false claims.)

### Butonlar / actionlar

FAQ items'a "See plans" CTA — anchor to `#pricing`. Blog post linkleri Faz 2'de gerçek post URL'leri ile değişir, MVP'de "Coming soon" placeholder kabul edilebilir.

## Mobile

### Yeni ekran

N/A — mobile marketing surface yok.

### Mevcut ekranlara etki

- `apps/mobile/app/onboarding.tsx` (varsa) — onboarding kartlarında copy "Move once. Update everything." brand line eklenir
- `apps/mobile/src/i18n/messages/{en,es}.json` (cross-ref 67) — yeni brand line key'leri

## Admin

`apps/admin/src/app/(admin)/blog/` — blog post listing UI (varsa) blog post outline'larını draft olarak görür; içerik teami editler. CMS-driven (mevcut model).

## Blog post pipeline outline

İçerik teamine handoff için outline'lar (gerçek yazı 2000+ kelime hedef):

**Post 1**: "Family vs Pro: which LocateFlow plan is right for you?"
- Audience: Family decision-maker, mid-funnel
- Outline:
  - The 3-minute test: 1 person vs household vs portfolio
  - Family use cases (parents moving, kids in dorm, snowbird grandparents)
  - Pro use cases (1–2 rentals, 10+ rentals, small property management)
  - Side-by-side feature comparison
  - Pricing math: when does Pro pay for itself
  - CTA: try free trial

**Post 2**: "How to update your address with 50 companies without losing your mind"
- Audience: top-funnel SEO ("change of address checklist")
- Outline:
  - The 50-company reality (USPS, DMV, utility × 8, bank × 3, etc.)
  - Sequencing: what to do week-by-week (4 weeks before, 1 week before, day-of, after)
  - LocateFlow Partner Hub demo (Pro)
  - Free template: address-change checklist PDF download (lead magnet)
  - CTA: try free / Pro plan

**Post 3**: "Landlord's tax-ready property record: what to track"
- Audience: small landlord, year-end
- Outline:
  - IRS Schedule E reality
  - Per-property cost categories (mortgage interest, repairs, insurance, utilities, etc.)
  - LocateFlow address labels + tax export (Pro)
  - 1099/W9 mention briefly
  - CTA: Pro plan

Her post'un dosyası: `packages/db/prisma/seed-blog.ts` içine yeni `BlogPost` row'ları olarak seed edilir (slug, title, excerpt, content, publishedAt). Cover image: `apps/web/public/blog/{slug}.jpg`.

## Email signature changes (cross-ref 66)

Mevcut transactional email footer'ı (Resend templates veya `apps/web/src/lib/email-service.ts`):

Mevcut:
> "LocateFlow — Track your home services."

Yeni:
> "LocateFlow — Move once, update everywhere."

Family/Pro plan upgrade email signature varyantı (cross-ref 66 templates):
> "Welcome to {planName}. Move once, update everywhere — now with {memberCount} seats / {addressCount} addresses."

## SEO meta

**Anasayfa** `apps/web/src/app/page.tsx` veya `apps/web/src/app/layout.tsx`:
- `<title>`: "LocateFlow — Move once, update everywhere"
- `<meta description>`: "Track every address, account and renewal in one place. Plans for individuals, families and landlords."
- `og:title`: same
- `og:description`: same
- `og:image`: `apps/web/public/og/og-default-2026.png` (yeni 3-tier görsel, design brief)

**Pricing anchor (#pricing)** — title append: " — Pricing"

**Faz 1.5 segment landing** (varsa):
- `/family` → "LocateFlow Family — One workspace for the whole household"
- `/landlords` → "LocateFlow Pro — Address management for landlords"

## Güvenlik

- [x] **Step-up auth?** — Hayır, public copy.
- [x] **PII redaction?** — Testimonial quote'larında müşteri ismi consent ile (full name + city OK, email asla). Beta testers için signed consent gerekli.
- [x] **Audit log?** — N/A.
- [x] **Rate limit?** — N/A.
- [x] **Permission matris?** — N/A.
- [x] **Encryption at rest?** — N/A.
- [x] **GDPR DSAR?** — Testimonial quote'larında müşteri kaydı varsa DSAR erase request'inde quote kaldırılır (mevcut process).
- [x] **D15 compliance**: Hiçbir kopya "auto-sync" veya "we update for you" iddiası içermez. Partner Hub mesajı "you click, we track" tarzı.

## Migration / backward compat

- Mevcut hero copy değişikliği breaking değil (yeni metin daha kapsayıcı)
- Mevcut Individual müşteriler "for one person" mesajını kaybeder ama yeni mesaj onları da kapsar
- Mevcut FAQ items korunur, yeni 5 soru ekleme — değişiklik değil
- Mevcut blog post'lar korunur, yeni 3 post ekleme

## Etkilenen mevcut özellikler

- Anasayfa hero görseli — eski `hero-phone-mock.tsx` kalır veya 3-tier varyant ile değiştirilir (design call)
- Testimonial component — refactor (single → rotator)
- Footer footer link grubu — yeni "Plans" sütunu
- Header nav — pricing link aynen, segment dropdown opsiyonel
- Email signature — tüm `apps/web/templates/` veya `apps/web/src/lib/emails/` altındaki `.tsx` / `.html` template'lerinde footer tagline güncellemesi
- Blog seed `packages/db/prisma/seed-blog.ts` — 3 yeni post entry (draft içerik)
- Help content `apps/web/src/lib/help-content.ts` — Family/Pro açıklamaları
- i18n message dosyaları en/es (+TR cross-ref 67)

## Test plan

**Unit**
- Hero, FAQ ve footer komponentleri snapshot
- i18n key'lerinin tanımlı olduğu unit (cross-ref 67 test pattern)

**Integration**
- Anasayfa server render → hero text "Move once, update everything" içerir
- FAQ accordion items 5 yeni soru içerir

**E2E (Playwright)**
- Ziyaretçi anasayfaya girer → hero görür → FAQ scroll → "Can I share my subscription with my family?" tıklar → accordion açılır → "See plans" CTA'sı `#pricing`'e jump
- Blog post URL'leri 200 döner

**Manual**
- Copy review: pazarlama / kurucu eyes-on
- a11y: alt text yeni illustration'lar için
- Visual: light + dark mode 3-tier illustration kontrast OK
- Lighthouse: SEO score 100, meta tags doğru render
- Open Graph debugger: og:image, og:title, og:description Twitter + Facebook preview doğru
- Hreflang: en/es alternate link tag'leri yeni route'larda da doğru

## Açık sorular

1. Yeni brand tagline "Move once, update everything" finalize edildi mi? Founder/marketing onay gerekli. Alt seçenekler: "Your address, everywhere" / "Updates that update themselves" (sonuncu D15 ihlal).
2. Testimonial gerçek quote'ları lansman öncesi temin edilebilir mi? Beta tester pool var mı? Yoksa placeholder kabul edilir mi?
3. Blog post içeriği kim yazıyor? İçerik teami var mı yoksa freelance? Sprint 3 draft + Sprint 4 publish realistic mi?
4. `/family` ve `/landlords` segment landing page'leri Faz 1.5'e mi Faz 1'e mi? SEO traffic için Faz 1 ideal ama scope büyür. Tercih: Faz 1.5.
5. OG image 3-tier illustration design team bandwidth'i var mı? Stretch goal: video hero (15s loop) → Faz 2.
6. Mevcut "for one person" copy'sini ne kadar agresif değiştiriyoruz? Bazı yerlerde "Individual is still the best for solo movers" mesajı kalmalı (var olan müşteriyi yabancılaştırma).
