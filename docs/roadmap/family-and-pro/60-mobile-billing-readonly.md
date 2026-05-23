# Mobile Billing — Read-Only Entitlement (Faz 1)

- **Status**: Proposed (Family/Pro launch, Sprint 1 setup + Sprint 4 polish)
- **Tier**: Cross-cutting
- **Related decisions**: D11 (mobile read-only), D12 (iOS conflict guard), D14 (plan-limits adapter)
- **Related docs**: [21](./21-family-checkout-flow.md), [31](./31-pro-checkout-flow.md), [17](./17-ios-subscription-conflict-guard.md), [62](./62-subscription-plan-field-updates.md), [63](./63-entitlement-banners-empty-states.md)

## Amaç

Mobile uygulaması Family/Pro **satışını** Faz 1'de **yapmaz**. Mevcut Individual IAP yaşamaya devam eder. Mobile, owner'ın web'den satın aldığı Family/Pro entitlement'ı **okur**, workspace bağlamında çalışır, satın alma akışını web'e yönlendirir. Aynı zamanda Faz 2'de mobile-native Family/Pro satışı yapılabilmesi için App Store Connect + Play Console'da product ID'leri **şimdi** kayıt eder (D11 paralel hazırlık).

## Kapsam

**In scope (Faz 1, Sprint 1–4)**
- Mobile `/api/profile` üzerinden mevcut entitlement'ı okur (`UnifiedEntitlementSnapshot`)
- Settings ekranında plan adı + "manage" hedefi gösterir
- Workspace switcher, member list view, invite kabul deep-link (cross-ref 05, 04)
- Partner action launcher (cross-ref 36) ve bulk queue view (cross-ref 14) entitlement'ı tüketir
- Upgrade akışı tıklandığında external browser → `lf.io/upgrade`
- D12 iOS conflict mesajı mobile'da da gösterilir (kullanıcı kendi durumunu anlasın)
- App Store Connect + Google Play Console'da Family/Pro IAP product'ları "available for review" olarak hazırlanır, kod tarafında `MOBILE_FAMILY_PRO_PURCHASE_ENABLED=false` feature flag arkasında kalır

**Out of scope (Faz 2'ye)**
- Mobile'dan Family/Pro **satın alma**
- Family/Pro için paywall variant
- Mobile'dan Stripe Checkout WebView (Google Play kuralları sebebiyle güvenli değil)
- Plan değiştirme akışı mobile'dan

## User stories

- **US-60.1** — Free Trial'daki kullanıcı mobile'da settings > subscription'a girer; mevcut "Upgrade to Individual" CTA'sı korunur (IAP) + ek olarak küçük link: "Need a Family or Pro plan? Manage on web →".
- **US-60.2** — Web'den Family satın almış bir owner mobile'a giriş yapar; settings > subscription "Your plan: Family · Billed on web · $9.99/mo" gösterir; "Manage on Web" butonu çıkar; IAP "Upgrade to Individual" CTA gizlenir.
- **US-60.3** — Aktif iOS Individual sub'ı olan kullanıcı web'de Family'e geçmeyi denediğinde 409 alır (D12). Mobile'a geri döndüğünde settings'te "Action required" rozeti ile aynı mesajı görür: önce iOS'tan iptal, expire sonrası web'de upgrade.
- **US-60.4** — Family workspace üyesi (CHILD veya MEMBER) mobile'a giriş yapar; settings > subscription "Your plan: Family · Member · Owner: {ownerEmail}" gösterir; upgrade CTA gizlidir (owner ödüyor).
- **US-60.5** — Owner subscription expire olur (D2 grace start). Mobile'da `<OwnerSubExpiredBanner>` mobile karşılığı `<OwnerSubExpiredCallout>` üst banner gösterilir.

## Veri modeli

N/A — yeni tablo yok. Mevcut `Subscription`, `WorkspaceMember`, `Workspace` (cross-ref 02) yeterli.

## API endpoint'leri

Mobile sadece **okur**. Hiçbir yeni endpoint mobile için yaratılmaz, mevcut endpoint'lere ek alan eklenir:

- `GET /api/profile` (mevcut) — response'a `entitlement: UnifiedEntitlementSnapshot` (zaten var) + `workspace: { id, name, role, ownerEmail?, planSourceWorkspace: boolean }` (yeni)
- `GET /api/billing/checkout-availability` (yeni, küçük) — body `{ targetPlan: "FAMILY"|"PRO" }` → response `{ allowed: boolean, blockReason?: "IOS_ACTIVE_SUB"|"PLAY_ACTIVE_SUB"|"ALREADY_SUBSCRIBED", message: string, helpUrl: string }`. Mobile butona basmadan önce çağırır, doğru mesajı gösterir.

## Web

### Yeni sayfa/route

N/A bu doc için. Pricing/checkout sayfaları cross-ref 61, 21, 31.

### Mevcut sayfalara etki

`apps/web/src/app/upgrade/page.tsx` (varsa, yoksa yaratılır cross-ref 21): mobile'dan gelen deep-link'i karşılar (`?source=mobile&plan=family`). Sayfanın üstüne küçük banner: "Subscribing for use on your phone too? Sign in with the same account — no extra setup." Mobil deep-link state'ini takip için query string + redirect tutulur.

### Componentler (file paths)

Bu doc için web tarafında değişiklik minimal. Cross-ref 61 (pricing-section) primary.

### Butonlar / actionlar

`/upgrade` sayfası tamamlandıktan sonra success → mobile deep-link `locateflow://billing/refresh` (Faz 2). Faz 1'de kullanıcı manuel olarak mobile'ı yenilemek zorunda; bunu açıklayan tek satır kopya: "Open the LocateFlow app and pull to refresh to see your new plan."

## Mobile

### Yeni ekran

`apps/mobile/app/settings/billing.tsx` — **mevcut** `apps/mobile/app/settings/subscription.tsx` dosyasını alıp dönüştür. Yeni adı `billing.tsx`, eski dosyayı redirect bırakalım (Expo Router) ya da deeplink'leri kıracaksak doğrudan rename. Tercih: in-place değiştir, dosya adı `subscription.tsx` kalır (deep-link `lf://settings/subscription` muhtemelen kullanılıyor).

### Mevcut ekranlara etki

**`apps/mobile/app/settings/subscription.tsx`** — Major rework, tek dosya:

State machine (plan'a göre render):
- `plan=FREE_TRIAL` → mevcut "Start Trial / Upgrade" CTA (IAP path) korunur + alt link "Family or Pro? Manage on web →"
- `plan=INDIVIDUAL`, `provider=APP_STORE` → "Manage on App Store" (`StoreKit` linkSubscriptions deep-link) + alt link "Switch to Family/Pro on web →" (D12 mesajı conflict-check ile)
- `plan=INDIVIDUAL`, `provider=PLAY_STORE` → "Manage on Google Play" (Play subscription URL) + alt link
- `plan=INDIVIDUAL`, `provider=STRIPE` → "Manage on Web" (`Linking.openURL('https://lf.io/account/billing')`)
- `plan=FAMILY`, owner ise → "Family · Owner" badge + "Manage on Web" + member count + "Invite member" CTA (workspace flow, cross-ref 04)
- `plan=FAMILY`, owner DEĞİL ise → "Family · Member" + owner email + read-only: "Your owner manages this subscription."
- `plan=PRO`, owner ise → "Pro · Owner" + manage on web + workspace member overview
- `plan=PRO`, owner DEĞİL ise → "Pro · Member" + owner email + read-only
- `status=GRACE_PERIOD` → ek banner: "Your workspace owner's subscription expired. Read-only until {graceEndsAt}."

Conflict guard: "Switch to Family/Pro on web →" tıklanınca `GET /api/billing/checkout-availability` çağrılır:
- `allowed=true` → `Linking.openURL('https://lf.io/upgrade?source=mobile')`
- `allowed=false, blockReason=IOS_ACTIVE_SUB` → modal: D12 mesajı + "Open App Store Subscriptions" butonu

**`apps/mobile/app/(auth)/paywall.tsx`** (varsa) — değişmez. Sadece Individual upsell. Family/Pro variant **yok** Faz 1'de.

**`apps/mobile/app/settings/index.tsx`** — Settings index row "Subscription" altına küçük plan etiketi: "Family · Member" gibi. Member ise CTA "Switch plan" gizli; owner ise görünür.

**Workspace switcher** (cross-ref 05) header'da; member list view (cross-ref 03/04) ayrı doc'larda; partner launcher (cross-ref 36) ayrı doc.

### IAP product ID setup (Sprint 1, paralel)

App Store Connect, "Auto-Renewable Subscriptions" grubu (mevcut grup kullanılır):

| Reference Name | Product ID | Duration | Price Tier (proxy) |
|---|---|---|---|
| LocateFlow Family Monthly | `com.locateflow.family.monthly` | 1 Month | $9.99 (Tier 10) |
| LocateFlow Family Annual | `com.locateflow.family.annual` | 1 Year | $99 (Tier 99 custom) |
| LocateFlow Pro Monthly | `com.locateflow.pro.monthly` | 1 Month | $19.99 (Tier 20) |
| LocateFlow Pro Annual | `com.locateflow.pro.annual` | 1 Year | $199 (Tier 199 custom) |

Google Play Console: matching IDs (lowercase, dots OK), aynı fiyatlar (Play "Price templates").

Status: **Ready to Submit** (Apple) / **Active draft** (Play) — review için gönderilir ama uygulamada hidden:

```ts
// apps/mobile/src/lib/billing-flags.ts (mevcut dosya, ek flag)
export const MOBILE_FAMILY_PRO_PURCHASE_ENABLED = false; // Faz 2'de true
```

`expo-iap` purchase çağrılarında flag false ise Family/Pro product fetch ETME (Sentry noise olmasın).

## Admin

N/A — admin'in mobile-only ek aksiyonu yok. `apps/admin/src/app/(admin)/email-templates/` arayüzünden mobile bildirim metinleri yönetilir (zaten var).

## Güvenlik

- [x] **Step-up auth?** — Hayır, satın alma yok, sadece read-only entitlement.
- [x] **PII redaction?** — `ownerEmail` mobile'a verilirken member rolündeki kullanıcıya truncated form: `john****@gmail.com` (mevcut `apps/web/src/lib/audit-redaction.ts` benzeri util mobile'a port edilir veya server-side maskele).
- [x] **Audit log?** — `subscription.viewed_on_mobile` event'i ağır değil, atılmaz. Conflict guard hit (`ios_sub_conflict.shown`) loglanır (cross-ref 65).
- [x] **Rate limit?** — `GET /api/billing/checkout-availability` mevcut profile rate limit'i içinde kalır (60 rpm per user).
- [x] **Permission matris?** — OWNER plan yönetir; ADMIN/MEMBER/CHILD/VIEW_ONLY plan görür ama "manage" butonu render olmaz. CHILD özel: subscription ekranı tamamen gizli, sadece "Your account is managed by your family." mesajı.
- [x] **Encryption at rest?** — Mobile lokal storage'da yalnızca `plan`, `status` cache'lenir (kısa TTL, 5 dk). Token/secret saklanmaz.
- [x] **GDPR DSAR?** — Mobile sadece read-only, primary data web tarafında. DSAR `/api/account/export` üzerinden (mevcut) tüm subscription history'sini kapsar.

## Migration / backward compat

- Mevcut iOS Individual abone kullanıcılarına davranış değişikliği **yok** — IAP path aynen çalışmaya devam eder.
- Mevcut Stripe Individual abone kullanıcılarına davranış değişikliği **yok** — "Manage on Web" zaten mevcut.
- Yeni Family/Pro Stripe müşterileri Faz 1'de **sadece web'den** alınır; mobile'a giriş yapınca read-only görür.
- Faz 2'de mobile Family/Pro IAP enable edilince: `MOBILE_FAMILY_PRO_PURCHASE_ENABLED=true` + paywall variant eklenir.

## Etkilenen mevcut özellikler

- `apps/mobile/app/settings/subscription.tsx` — major rework (≈200 satır → ≈350 satır)
- `apps/mobile/src/lib/billing-flags.ts` — yeni flag eklenir
- `apps/web/src/app/api/profile/route.ts` (varsa, yoksa shared `getProfileResponse` util) — response'a `workspace.role`, `workspace.ownerEmailMasked`, `workspace.planSourceWorkspace` eklenir
- Mobile `apps/mobile/src/i18n/messages/en.json` + `es.json` (cross-ref 67) — yeni key'ler
- `apps/web/src/app/api/billing/checkout-availability/route.ts` — yeni endpoint
- `apps/mobile/src/lib/api/billing.ts` (varsa) — `checkoutAvailability()` fonksiyonu

## Test plan

**Unit**
- `billing-flags.ts` — `MOBILE_FAMILY_PRO_PURCHASE_ENABLED=false` ise expo-iap product list Family/Pro içermez
- `subscription.tsx` plan × role × provider matrisi render testleri (snapshot)
- `checkout-availability` server-side: aktif iOS sub varken `IOS_ACTIVE_SUB` döner

**Integration**
- Owner Family Stripe sub yaratır → mobile profile call sonrası UI doğru badge gösterir
- Member CHILD rolü subscription tab'ı gizlenir
- Grace period başlar → mobile'da banner görünür

**E2E (Detox veya Maestro)**
- Login → settings > subscription → "Switch to Family on web" tıklar → external browser açılır (URL doğrulama)
- iOS aktif sub → "Switch" tıklar → modal D12 mesajıyla açılır, browser açılmaz

**Manual**
- TestFlight build: 4 test hesabı (Free, Individual-Stripe, Individual-iOS, Family-Member) ile screen-by-screen QA
- Google Play internal test: aynı matris

## Açık sorular

1. Faz 2'de mobile Family/Pro IAP açıldığında "owner" semantiği nasıl olacak? Mobile'dan satın alan kişi her zaman OWNER mı (workspace yoksa create)? Apple/Play receipt → workspace mapping kararı Faz 2'de.
2. Deep-link `locateflow://billing/refresh` Faz 1'de implement edilsin mi yoksa Faz 2'ye bırakılsın mı? (Şimdi yaparsak web success page → app jump UX akıcı; ama scope creep riski var.)
3. Mobile'da `<OwnerSubExpiredCallout>` componenti React Native primitive'leriyle mi yazılır yoksa NativeWind ile shared design system'a mı taşınır? — Cross-ref 63'te karar.
4. Member rolündeki kullanıcıya `ownerEmail` masked gösterilmesi yeterli mi yoksa hiç gösterilmesin "Owner: A family member" mi denmeli? Privacy review gerekli.
