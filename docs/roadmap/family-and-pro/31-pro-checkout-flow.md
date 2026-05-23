# Pro Checkout Flow

- **Status**: Proposed (Family/Pro launch, Sprint 4)
- **Tier**: Pro
- **Related decisions**: D2, D11, D12, D20
- **Related docs**: `01-architecture-decisions.md`, `06-entitlements-system.md`, `17-ios-subscription-conflict-guard.md`, `21-family-checkout-flow.md`, `30-pro-plan-definition.md`, `60-mobile-billing-readonly.md`, `61-pricing-page-update.md`, `62-subscription-plan-field-updates.md`

## Amaç

Pro aboneliğinin satışı, plan değişimleri (Family↔Pro, Individual→Pro, Free Trial→Pro), iOS aktif abonelik guard'ı (D12), iptal/downgrade akışları, refund politikası ve Stripe webhook handler güncellemeleri. Web-only (D11). Aynı pattern 21-family-checkout-flow ile paralel; bu dosya PRO-spesifik delta'yı tarifler.

## Kapsam

**In scope**
- `POST /api/billing/checkout` endpoint'inin `plan=PRO` parametresini handle etmesi
- Stripe Price ID env config (`STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`)
- Plan upgrade akışları (Family→Pro proration, Individual→Pro, Free Trial→Pro)
- Plan downgrade akışları (Pro→Family seat overflow + Partner Hub lock, Pro→Individual address/service overflow)
- iOS active sub guard (D12) — backend 409
- Refund policy (D20 fiyatlarına göre)
- Stripe webhook handler (`/api/stripe/webhook`) PRO branch
- Customer Portal entegrasyonu (mevcut)

**Out of scope**
- PRO plan tanımı, matris, copy (→ 30)
- Family upgrade flow detayı (→ 21)
- IAP / mobile checkout (→ 60 — D11)
- Pricing page DOM (→ 61)
- Entitlement banners "your subscription expired" mesajı (→ 63)

## User stories

- **As a Free Trial user**, web pricing'de "Get Pro" → Stripe Checkout → ödeme → workspace anında PRO entitlement'a geçer; trial sayacı durur.
- **As an Individual subscriber** ($3.99/mo), "Upgrade to Pro" → Stripe `customer.subscription.update` ile price değişir, proration uygulanır, period end'i korunur.
- **As a Family workspace owner** (8 üye var), Pro'ya upgrade ediyorum: seat 6→10 olur, hiç kimse kick edilmez, partner hub anında açılır.
- **As a Pro workspace owner** Family'ye downgrade ediyorum (10 üye, 30 adres): üyeler kalır (8 üye fazlaysa 2'si OVERFLOW — D2), Partner Hub kilitlenir ama geçmiş `PartnerSyncAttempt`'ler okunabilir, adres limiti 6'ya düşer ama mevcut 30 adres silinmez (read-only overflow).
- **As an iOS Individual subscriber** (App Store), web'de "Get Pro" tıklarım → 409 hata + açıklayıcı modal (D12).

## Veri modeli

Yeni tablo yok. Mevcut/planlı:

- `Subscription`: mevcut tablo; `plan` enum'a `PRO` eklenir (62).
- `BillingAuditLog`: mevcut; plan transition (`PRO → FAMILY`) loglanır.
- `Workspace`, `WorkspaceMember`: 02, 03.
- `WorkspaceMember.status`: `ACTIVE | OVERFLOW | SUSPENDED` (D2).

## API endpoint'leri

### Yeni
| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/api/billing/checkout` | required | required | `{ plan: "PRO", interval: "MONTH"\|"YEAR" }` | `{ url: stripeCheckoutUrl }` | 401, 403, 409 (iOS conflict D12), 422 (invalid plan/interval), 503 (price ID missing) |
| POST | `/api/billing/upgrade` | required | required (owner only) | `{ plan: "PRO", interval }` | `{ subscriptionId, status, prorationPreviewCents }` | 401, 403, 409, 422 |
| POST | `/api/billing/downgrade` | required | required (owner only) | `{ targetPlan: "FAMILY"\|"INDIVIDUAL", effective: "PERIOD_END"\|"IMMEDIATE" }` | `{ scheduledChangeAt }` | 401, 403, 422 |

`/api/billing/checkout` aynı endpoint — `plan` parametresine göre dallanır (Family ve Pro tek handler).
`/api/billing/upgrade` ve `/downgrade` Sprint 4'te yaratılır; Family için 21'de, Pro için bu dosyada PRO-spesifik branch.

### Mevcut endpoint'lere etki

- `POST /api/stripe/webhook`:
  - `customer.subscription.created` / `.updated`: priceId PRO_MONTHLY veya PRO_YEARLY ise `Subscription.plan="PRO"` yazılır.
  - `customer.subscription.deleted`: `plan=PRO` ise workspace 7 gün grace (D2).
  - `invoice.paid`: PRO plan'da herhangi bir ek davranış yok.
- `POST /api/subscription/cancel`: PRO için Family ile aynı; period sonuna dek aktif kalır.
- `GET /api/workspace/entitlements`: downgrade scheduled durumda mevcut `plan` döner, `scheduledChange` alanı eklenir.

## Web

### Yeni sayfa/route

- `apps/web/src/app/(app)/billing/upgrade/success/page.tsx` — Stripe Checkout dönüş sayfası (mevcut success page genişletilir; "Welcome to Pro" copy varyantı eklenir).
- `apps/web/src/app/(app)/billing/downgrade/page.tsx` — Pro → lower plan onay sayfası (overflow uyarısı + onay).

### Mevcut sayfalara etki

- `apps/web/src/app/(app)/account/page.tsx`:
  - "Upgrade to Pro" butonu Family/Individual subscriber için görünür.
  - "Downgrade to Family" / "Cancel Pro" butonları Pro subscriber için.
- `apps/web/src/components/marketing/pricing-section.tsx` (61): "Get Pro" CTA → `/api/billing/checkout`.

### Componentler (file paths)

- `apps/web/src/components/billing/UpgradeToProButton.tsx` (yeni).
- `apps/web/src/components/billing/DowngradeConfirmModal.tsx` (yeni) — overflow uyarısı:
  - "Your 8 members will stay but 2 will become read-only until you remove someone."
  - "Your Partner Hub history will remain visible but you can't run new bulk sync."
- `apps/web/src/components/billing/IosSubConflictModal.tsx` (yeni, 17 ile paylaşımlı) — D12 mesajı.

### Butonlar / actionlar

| Buton | Plan | Davranış |
|---|---|---|
| "Get Pro" | FREE_TRIAL | `POST /api/billing/checkout {plan:"PRO"}` → Stripe Checkout |
| "Upgrade to Pro" | INDIVIDUAL | `POST /api/billing/upgrade {plan:"PRO"}` — Stripe `subscription.update` + proration |
| "Upgrade to Pro" | FAMILY | Aynı; seat limit 6→10 anında, mevcut üyeler kalır |
| "Downgrade to Family" | PRO | Modal → onay → `POST /api/billing/downgrade {targetPlan:"FAMILY", effective:"PERIOD_END"}` |
| "Downgrade to Individual" | PRO | Modal → uyarı (workspace üyeleri kaybedeceksin) → onay |
| "Cancel Pro" | PRO | Mevcut cancel flow — period end'e dek aktif |

## Mobile

### Yeni ekran

Hiçbiri. D11 read-only.

### Mevcut ekranlara etki

- `apps/mobile/app/settings/subscription.tsx` — Pro plan rozeti + "Manage on web → locateflow.app/account" deep link.
- "Upgrade to Pro" butonu **görünmez** (mobile'da satış yok). Yerine: "Pro plans available on the web." metni.

### Componentler

- `apps/mobile/src/components/billing/PlanBadge.tsx` — PRO variant.

## Admin

### Yeni sayfa / Yetenekler

- `apps/admin/src/app/(admin)/subscriptions/page.tsx` — `PRO` filter ve manuel "Comp Pro" (destek için 30 günlük PRO entitlement) aksiyonu. Manuel comp Sprint 4'te opsiyonel; eklenirse `BillingAuditLog`'a `actor=adminUserId` yazılır.

## Güvenlik

- [x] **Step-up auth**: Plan değişimi için fresh-auth pencere içinde olmalı (mevcut pattern, login'den 15 dk). Stripe Checkout zaten Stripe-side 3DS isteyebilir. AddressChangeEvent step-up'ı (D10) burada yok.
- [x] **PII redaction**: Webhook log'larında Stripe customer email tutulur (zaten log'lanıyor). Card data Stripe tarafında, bizde değil.
- [x] **Audit log**: Tüm plan transition `BillingAuditLog`'a yazılır (`fromPlan`, `toPlan`, `actor`, `stripeEventId`, `prorationCents`).
- [x] **Rate limit**: `/api/billing/checkout` ve `/upgrade` IP başına 10/dk; user başına 5/dk. Mevcut middleware (`apps/web/src/lib/rate-limit.ts`) tier ekler.
- [x] **Permission matris**: Sadece `WorkspaceMember.role = OWNER` checkout/upgrade/downgrade çalıştırabilir. ADMIN ve diğer roller 403.
- [ ] **Encryption at rest**: N/A (Stripe IDs zaten DB'de plain).
- [x] **GDPR DSAR**: Subscription + audit log mevcut user-data-export'a dahil.

## Migration / backward compat

- `Subscription.plan` enum'a `PRO` (62 migration'ı). Mevcut INDIVIDUAL satırları etkilenmez.
- Stripe Price ID'leri Sprint 4 başında Stripe Dashboard'da yaratılır:
  - `STRIPE_PRICE_PRO_MONTHLY` ($19.99/mo)
  - `STRIPE_PRICE_PRO_YEARLY` ($199/yr)
- Env değişkenleri eksikse `mapStripePriceIdToPlanAndInterval` PRO branch'i null döner; checkout 503 + uyarı log'u.
- D14 adapter gereği `plan-limits.ts` API çağrı yerleri PRO için sessizce yeni matrisi çağırır.

### Family → Pro upgrade

1. Owner "Upgrade to Pro" tıklar.
2. Backend Stripe `subscriptions.update({items:[{id, price: STRIPE_PRICE_PRO_MONTHLY}], proration_behavior: "create_prorations"})`.
3. Webhook `customer.subscription.updated` → `Subscription.plan = "PRO"`.
4. `WorkspaceMember.status = OVERFLOW` olan üyeler varsa (önceden downgrade ettiyse) ACTIVE'e döner.
5. Partner Hub anında açılır (entitlement cache invalidate).

### Individual → Pro skip

1. Owner "Upgrade to Pro" tıklar.
2. `subscriptions.update({price: STRIPE_PRICE_PRO_MONTHLY, proration_behavior: "create_prorations"})`.
3. Webhook → plan=PRO. Workspace'te zaten 1 OWNER üye var; seat 10'a açılır, invite kullanılabilir.

### Free Trial → Pro

1. Free Trial user "Get Pro" → Stripe Checkout (yeni subscription create).
2. Webhook `checkout.session.completed` + `customer.subscription.created` → `Subscription` row create, `plan=PRO`.
3. Trial sayacı durur (mevcut `FreeTrial.status = CONVERTED`).

### Pro → Family downgrade

1. Owner "Downgrade to Family" → modal:
   - "10 → 6 seat: 4 members will become read-only (OVERFLOW). Remove some first to avoid this." [Continue] [Cancel]
   - "Partner Hub will be locked. Existing PartnerSyncAttempts remain visible." [Continue]
2. Backend `subscriptions.update({price: STRIPE_PRICE_FAMILY_MONTHLY, proration_behavior: "none"})` veya schedule for period end.
3. `effective: "PERIOD_END"` (default): Stripe Subscription Schedule yaratılır.
4. Period end'de webhook → `plan=FAMILY`; `WorkspaceMember` query: ACTIVE üye sayısı > 6 ise en son join olanlar OVERFLOW'a çevrilir (deterministic: createdAt DESC).
5. Partner Hub UI'da feature lock banner; geçmiş `PartnerSyncAttempt` read-only erişilebilir.

### Pro → Individual downgrade

1. Modal uyarısı:
   - "All workspace members except you will lose access. Continue?"
   - "Your 18 addresses exceed Individual's limit (3). Read-only access kept; you must delete addresses before adding new ones."
2. Backend downgrade.
3. Webhook → `plan=INDIVIDUAL`. Tüm non-OWNER `WorkspaceMember.status = OVERFLOW` (D2 pattern); UI'da owner-only deneyim.

### iOS active sub guard (D12)

- `POST /api/billing/checkout` öncesi: `await checkIosSubConflict(userId)` (17 helper).
- Eğer `Subscription.provider = "APP_STORE"` ve `status` aktifse → 409 + body:

```json
{
  "error": "IOS_ACTIVE_SUBSCRIPTION",
  "message": "Aboneliğiniz App Store üzerinden yönetiliyor...",
  "actionUrl": "https://apps.apple.com/account/subscriptions"
}
```

Client `IosSubConflictModal` gösterir.

### Refund policy

- Aylık abonelik: refund yok (mevcut INDIVIDUAL policy). Yıllık: ilk 14 gün full refund (manuel admin aksiyonu, `apps/admin/src/app/(admin)/subscriptions/[id]/refund/page.tsx` — Sprint 4 task).
- Webhook: `charge.refunded` → `Subscription.status = "CANCELLED"`, workspace grace 7 gün başlar.

## Etkilenen mevcut özellikler

- `/api/billing/checkout` (handler imzası genişler).
- Stripe webhook handler (`/api/stripe/webhook/route.ts`).
- `apps/web/src/lib/billing.ts` price mapping.
- Customer Portal: Stripe portal otomatik PRO line item'ları gösterir; özel iş yok.
- Account page UI.
- Pricing section (61).
- `BillingAuditLog` yeni event türleri (`PLAN_UPGRADED`, `PLAN_DOWNGRADED_SCHEDULED`, `DOWNGRADE_APPLIED`).

## Test plan

**Unit**
- `mapStripePriceIdToPlanAndInterval`: PRO_MONTHLY ve PRO_YEARLY her ikisi de doğru plan/interval döner.
- `checkIosSubConflict`: APP_STORE + active → throws; STRIPE + active → ok.
- Downgrade overflow seçimi: 10 üyeyi createdAt DESC sıralayıp 4'ünü OVERFLOW yapar; OWNER hiç dokunulmaz.

**Integration**
- Stripe webhook fixture (`customer.subscription.created` with PRO price) → DB'de `Subscription.plan="PRO"`.
- `POST /api/billing/upgrade {plan:"PRO"}` Individual subscriber → Stripe mock `subscriptions.update` çağrılır, response success.
- `POST /api/billing/downgrade {targetPlan:"FAMILY"}` Pro subscriber 8 üyeli workspace → schedule create, period end simülasyonu sonra 2 üye OVERFLOW.

**E2E (Playwright)**
- Free Trial user → pricing → "Get Pro" → Stripe test mode card → success page → account shows "Pro".
- Family owner → "Upgrade to Pro" → success → Partner Hub link açılır.

**Manual**
- iOS subscriber web'de "Get Pro" → 409 modal + App Store link.
- Pro → Family downgrade → period end'e dek Pro davranışı; sonra Family.
- Refund (admin) → workspace grace banner görünür.

## Açık sorular

- Yıllık → aylık geçişte proration nasıl? (Default Stripe behavior: bir sonraki period'a kalan günler crediten yazılır. UI'da "you'll be credited $X" göster?)
- Pro → Free Trial downgrade desteklensin mi? (Hayır — sadece cancel → period end → FREE_TRIAL fallback yok; expire olur. Karar D2 grace pattern'i.)
- "Comp Pro" admin tool MVP'de mi yoksa Faz 2 mi? (Önerilen: Sprint 4 zamanı varsa MVP, yoksa Faz 2.)
- Downgrade modal'ında "Remove members first" linkleri tıklanabilir olsun mu (üye yönetimine yönlendir)? Önerilen: evet.
