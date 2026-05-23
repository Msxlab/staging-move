# iOS Subscription Conflict Guard

- **Status**: Proposed (Family/Pro launch, Sprint 4)
- **Tier**: Infrastructure (Family + Pro checkout)
- **Related decisions**: D11, D12
- **Related docs**: [21](./21-family-checkout-flow.md), [31](./31-pro-checkout-flow.md), [60](./60-mobile-billing-readonly.md), [62](./62-subscription-plan-field-updates.md), [63](./63-entitlement-banners-empty-states.md)

## Amaç

App Store üzerinden aktif aboneliği olan bir kullanıcı web Stripe checkout başlatırsa **çift ödeme + senkronizasyon problemi** doğar (Stripe sub + APP_STORE sub aynı user'da). D12 kararı: backend `/api/billing/checkout` endpoint'i `Subscription.provider = APP_STORE` + aktif/grace status görürse 409 döner ve kullanıcıya App Store > Subscriptions üzerinden iptal etmesini söyler.

Bu doc tek bir guard'ın server logic + web UI + mobile UI + support runbook bütününü tarifler. Edge case'leri (expired iOS, refunded iOS, Stripe → Stripe upgrade) açıklar.

## Kapsam

**In scope**
- `/api/billing/checkout` endpoint conflict logic
- Web UI 409 handling
- Mobile UI mevcut banner messaging
- Audit log entry
- Customer support runbook
- Edge case matrix

**Out of scope**
- Checkout success path (→ 21, 31)
- App Store webhook receipt validation (mevcut billing kodu)
- Family/Pro mobile satışı (D11 — yok)

## User stories

- **As an iOS Individual user**: Web'de Family upgrade'e basarım, "Aboneliğiniz App Store üzerinden, önce iptal edin" mesajı + nasıl iptal edileceği talimatı ile karşılaşırım.
- **As a refunded iOS user**: iOS aboneliğim refund edildi, web Family checkout başarılı olur.
- **As a Stripe Individual user**: Family upgrade'e basarım, Stripe checkout başlar (conflict yok, sadece tier change).
- **As a support agent**: Müşteri "iptal ettim ama hâlâ çıkıyor" diyorsa runbook'tan ne yapacağımı bulurum.

## Veri modeli

Yeni schema yok. Mevcut `Subscription` modeli:

```prisma
// already in schema.prisma (illustrative)
model Subscription {
  provider SubscriptionProvider  // TRIAL | STRIPE | APP_STORE | PLAY_STORE | ADMIN | UNKNOWN
  status   SubscriptionStatus    // ACTIVE | TRIALING | PAST_DUE | CANCELED | EXPIRED | GRACE_PERIOD
  // ...
}
```

**Conflict logic için bakılan alanlar**:
- `provider = APP_STORE`
- `status IN (ACTIVE, TRIALING, GRACE_PERIOD, PAST_DUE)` — yani **aktif sayılan** her şey
- `currentPeriodEnd > now()` — extra safety (expire'a çok yakın değil)

EXPIRED, CANCELED → conflict YOK, web upgrade serbest.

## API endpoint'leri

### Mevcut endpoint'lere etki

**`POST /api/billing/checkout`** (mevcut endpoint, conflict guard eklenir):

```ts
// apps/web/src/app/api/billing/checkout/route.ts
export async function POST(request: Request) {
  const { userId } = await requireWorkspaceContext(request);
  const { plan, interval } = await validateBody(request);

  // NEW: iOS conflict guard
  const conflict = await checkIosSubscriptionConflict(userId);
  if (conflict) {
    await auditLog({
      userId,
      action: 'checkout_blocked_ios_conflict',
      entityType: 'Subscription',
      entityId: conflict.subscription.id,
      changes: JSON.stringify({ attemptedPlan: plan, iosStatus: conflict.subscription.status }),
    });
    return NextResponse.json(
      {
        code: 'IOS_SUB_ACTIVE',
        message: 'Aboneliğiniz App Store üzerinden yönetiliyor. Family/Pro\'ya geçmek için önce App Store > Subscriptions\'tan mevcut aboneliği iptal edin, expire olduktan sonra burada upgrade edebilirsiniz.',
        appStoreManageUrl: 'https://apps.apple.com/account/subscriptions',
        currentPeriodEnd: conflict.subscription.currentPeriodEnd,
      },
      { status: 409 }
    );
  }

  // ... mevcut Stripe session creation
}
```

`checkIosSubscriptionConflict` helper (`apps/web/src/lib/billing/ios-conflict-guard.ts`, yeni dosya):

```ts
export async function checkIosSubscriptionConflict(userId: string): Promise<{ subscription: Subscription } | null> {
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      provider: 'APP_STORE',
      status: { in: ['ACTIVE', 'TRIALING', 'GRACE_PERIOD', 'PAST_DUE'] },
      currentPeriodEnd: { gt: new Date() },
    },
    orderBy: { currentPeriodEnd: 'desc' },
  });
  return sub ? { subscription: sub } : null;
}
```

### Yeni endpoint

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/billing/upgrade-eligibility` | Session | required | — | `200 { canUpgrade: boolean, reason?: 'IOS_SUB_ACTIVE', currentPeriodEnd?, manageUrl? }` | 401 |

Bu endpoint client-side preflight için: upgrade butonu tıklanmadan önce ya da pricing sayfasında "you can't upgrade because…" banner için kullanılır. Stateless, side-effect yok.

## Web

### Yeni sayfa/route

Yok ayrı sayfa. UI mevcut sayfalara entegre.

### Mevcut sayfalara etki

**`/pricing`**:
- Sayfa yüklenirken `/api/billing/upgrade-eligibility` çağır (server component fetch)
- iOS conflict varsa Family/Pro CTA butonu **disabled** + tooltip + warning banner sayfa üstünde

**`/billing`** (mevcut billing sayfası):
- "Manage subscription" bölümünde iOS sub aktifse banner:

```
┌────────────────────────────────────────────────────────────┐
│ ℹ️ Your subscription is managed by Apple                   │
│                                                            │
│ You're currently on the LocateFlow Individual plan billed │
│ through the App Store. To upgrade to Family or Pro:        │
│                                                            │
│ 1. Open Settings → [Your Name] → Subscriptions on iOS     │
│ 2. Tap LocateFlow → Cancel Subscription                    │
│ 3. Wait until {currentPeriodEnd} (or earlier if no refund)│
│ 4. Come back here to upgrade                              │
│                                                            │
│ [ Open App Store Subscriptions → ] (apple URL)            │
│ [ Need help? Contact support → ]                          │
└────────────────────────────────────────────────────────────┘
```

**`/upgrade`** (Family/Pro upsell pages — 21, 31'in CTA hedefleri):
- "Upgrade" butonu tıklandığında client-side preflight; conflict varsa yukarıdaki banner gösterilir checkout başlamadan.
- Server-side guard yine zorunlu (defense in depth).

### Componentler

- **`<IosConflictBanner>`** (`apps/web/src/components/billing/IosConflictBanner.tsx`)
  - Props: `{ currentPeriodEnd: Date, manageUrl: string }`
  - Reusable across pricing, billing, upgrade pages

### Butonlar / actionlar

- "Open App Store Subscriptions" → `https://apps.apple.com/account/subscriptions` yeni sekmede
- "Contact support" → `/support?topic=ios_subscription`

## Mobile

### Yeni ekran

Yok. Mobile zaten satış yapmıyor (D11).

### Mevcut ekranlara etki

- **Billing screen** (mobile): User Family/Pro upsell banner görürse (Sprint 4'te eklenecek) tıklayınca:
  - Eğer iOS sub aktifse: "Web'de upgrade etmek için önce App Store'dan iptal et" alert
  - Eğer iOS sub yoksa: "Web'de upgrade" deep link (Safari/in-app browser açar `/pricing`)

```
┌──────────────────────────────────────┐
│ Family plan available!               │
│                                      │
│ Upgrade on web to add family members.│
│ Note: Cancel your App Store sub first│
│                                      │
│ [ Open App Store Settings ]          │
│ [ Open web pricing ]                 │
└──────────────────────────────────────┘
```

### Componentler

- **`<MobileIosConflictAlert>`** — native Alert wrapper.

## Admin

### Yeni sayfa

Yok ayrı. Mevcut user inspector'a alan ekleme:

### Yetenekler

- User detay sayfasında "Active iOS subscription detected" badge (eğer guard tetiklenecek durumda)
- Manual override butonu: "Bypass conflict guard for next checkout" (1 saatlik bypass token; AdminAuditLog). Yetkili: SUPPORT_LEAD.
- Kullanılma: edge case'lerde (Apple Sandbox sub test gibi) destek müdahalesi.

## Güvenlik

- [x] **Step-up auth**: Conflict guard reactive; ek auth gerekmez. Checkout sırasında zaten BILLING_CHANGE step-up (D10) çağrılır (opsiyonel MVP).
- [x] **PII redaction**: AppStore subscription transaction ID log'larda hash'lenir.
- [x] **Audit log**: Her bloklanan checkout için `checkout_blocked_ios_conflict` audit. Bypass token kullanımı ayrıca audit'li.
- [x] **Rate limit**: Eligibility endpoint 60/min per user. Checkout endpoint zaten 10/min.
- [x] **Permission matris**: Bu guard kullanıcının kendi sub'ına bakar; cross-user etki yok. Admin bypass SUPPORT_LEAD+.
- [x] **Encryption at rest**: Subscription metadata zaten mevcut policy.
- [x] **GDPR DSAR**: User erase'de Subscription cascade silinir; guard otomatik no-op olur.

## Edge case matrix

| Durum | İstenen davranış |
|---|---|
| iOS sub ACTIVE, currentPeriodEnd > now | Block checkout 409 |
| iOS sub TRIALING | Block (trial period parayı temsil eder) |
| iOS sub GRACE_PERIOD | Block (ödeme problemi var ama hâlâ aktif) |
| iOS sub PAST_DUE | Block (collection retry sürüyor) |
| iOS sub EXPIRED | Allow web upgrade |
| iOS sub CANCELED (still in period) | **Block** (currentPeriodEnd > now ise hâlâ aktif sayılır) |
| iOS sub CANCELED + expired | Allow |
| iOS sub REFUNDED (status = CANCELED + cancelReason = REFUND) | Allow immediate (special case helper'da: `cancelReason = 'REFUND'` ise currentPeriodEnd check bypass) |
| Stripe Individual → Family upgrade | Allow (no provider conflict) |
| Stripe Individual → Pro upgrade | Allow |
| Play Store sub (Android) | Faz 2 — şimdilik aynı mantık `PLAY_STORE` için kopya guard (`checkPlayStoreSubscriptionConflict`) |
| Multiple subscriptions (data integrity issue) | Tüm rows kontrol, herhangi biri aktifse block + Sentry log |
| ADMIN provider (test sub) | Allow (admin manuel set, biliyor ne yaptığını) |

## Customer support runbook

**Senaryo**: Müşteri "iptal ettim ama hâlâ aktif görünüyor" diyor.

1. Admin panel → User search → ilgili user
2. "Subscriptions" sekmesi → provider=APP_STORE row'una bak
3. `status` ve `currentPeriodEnd` kontrol:
   - `CANCELED` + `currentPeriodEnd > now`: müşteri iptal etmiş ama Apple billing period bitmeden hâlâ servis veriyor. Beklemesi gerek **veya** App Store refund talep edebilir.
   - `ACTIVE`: iptal işlemi App Store'a düşmemiş. Müşteriye "Settings → Apple ID → Subscriptions → LocateFlow → Cancel" adımları gönder.
4. **Refund yolu**: Apple App Store > Report a Problem > Request Refund. LocateFlow refund veremez; sadece Apple verir.
5. Acil ihtiyaç: SUPPORT_LEAD "Bypass conflict guard" butonunu kullanır (1 saatlik), müşteri checkout tamamlar, daha sonra App Store refund Apple tarafından işlenir.
6. **Asla**: Manuel `Subscription.status = EXPIRED` set ETME (Apple webhook'u tekrar override eder + audit gözünde fraud risk).

Doküman link: `docs/support/ios-subscription-conflicts.md` (ayrı dosya, bu spec dışında).

## Migration / backward compat

- Mevcut checkout endpoint extend; eski client'lar hâlâ çalışır (yalnız 409 alacaklar).
- Mobile billing screen değişikliği Sprint 4'te.
- Feature flag `FEATURE_IOS_CONFLICT_GUARD` — default on; emergency off için var (bypass tüm checkout'lar — sadece extreme durum).

## Etkilenen mevcut özellikler

- `apps/web/src/app/api/billing/checkout/route.ts` — guard eklenir.
- `apps/web/src/lib/billing.ts` — `checkIosSubscriptionConflict` eklenir.
- `/billing` sayfası UI banner.
- `/pricing` upgrade button states.
- Mobile billing screen banner (Sprint 4).
- Admin user inspector subscription panel.

## Test plan

**Unit**
- `checkIosSubscriptionConflict` her durum × status kombinasyonu
- Refund special case: `cancelReason = 'REFUND'` → allow
- Multiple subs scenario: 1 aktif iOS + 1 expired Stripe → block

**Integration**
- POST /api/billing/checkout with iOS active sub → 409 + correct body
- GET /api/billing/upgrade-eligibility iOS active → canUpgrade:false
- iOS expired → checkout success path reached
- Stripe → Stripe upgrade: no conflict path

**E2E**
- iOS user pricing page → Family CTA disabled + tooltip + banner
- iOS user upgrade button (force) → conflict banner inline
- Stripe user upgrade → checkout success
- Admin bypass button → 1-hour window allows checkout

**Manual**
- Sandbox Apple sub → guard triggers
- Cancel via Apple settings → wait + retry web checkout
- Mobile alert flow

## Açık sorular

1. PLAY_STORE Android conflict guard MVP'de var mı? **Karar önerisi**: Aynı pattern + dosya kopya helper (`checkPlayStoreSubscriptionConflict`); D11 paralel, Android mağaza zorunluluğu aynı tarzda var.
2. Refund detection güveniliği: Apple S2S webhook'tan mı sadece DB'den mi okunur? **Karar önerisi**: Sadece DB (webhook zaten sync ediyor); real-time Apple API call latency kötü.
3. Bypass token TTL 1 saat mi 30 dakika mı? **Karar önerisi**: 1 saat (destek workflow için).
4. Bypass token sadece checkout için mi tüm billing endpoint'ler için mi? **Karar önerisi**: Sadece checkout endpoint scoped.
5. Sayfa üstündeki banner kalıcı mı dismiss edilebilir mi? **Karar önerisi**: Dismiss edilemez (kritik bilgi); kullanıcı zaten aksiyon almak istiyor.
