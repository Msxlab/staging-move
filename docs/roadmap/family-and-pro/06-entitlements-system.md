# Entitlements System

- **Status**: Proposed (Family/Pro launch, Sprint 1)
- **Tier**: Infrastructure (Both Family & Pro depend on this)
- **Related decisions**: D1, D2, D4, D14
- **Related docs**: `01-architecture-decisions.md`, `02-workspace-model.md`, `07-api-workspace-context-helper.md`, `09-existing-user-migration.md`, `10-backward-compat-rollback.md`, `62-subscription-plan-field-updates.md`, `63-entitlement-banners-empty-states.md`

## Amaç

Bugün `apps/web/src/lib/plan-limits.ts` ve `packages/shared/src/entitlement.ts` arasında ikiye bölünmüş, sadece `FREE_TRIAL | INDIVIDUAL` plan'larını tanıyan ve `userId` üzerinden çözümlenen entitlement mantığını **workspace-resolved**, **owner-paid**, dört plan'lı bir modele evirmek. Hedef: tek `getEntitlements(workspaceId)` çağrısıyla "bu workspace bugün hangi limit/feature flag'lere sahip, grace period mi, seat overflow var mı" sorusunun deterministik cevabı.

Bu sistem tüm yeni endpoint'lerin (Family/Pro features, Partner Hub, AddressChangeEvent vs.) gate kaynağı olur. D14 gereği mevcut `plan-limits.ts` helper'ları breaking change almasın diye **adapter** olarak korunur ve içeride yeni resolver'ı çağırır.

## Kapsam

**In scope**
- Yeni `ResolvedEntitlements` interface ve resolver (sunucu tarafı, `apps/web/src/lib/entitlements.ts`)
- Saf plan matrix + helper fonksiyonlar (`packages/shared/src/entitlements.ts`)
- Owner-resolved çözümleme (D2)
- Grace period mekaniği (7 gün, D2)
- Seat overflow mekaniği (downgrade'de mevcut üyeleri kick etmeden işaretle, D2)
- Action tier gating helper (`actionTierAllowedForPlan`, D4)
- Mevcut `plan-limits.ts` helper'larının adapter'a dönüşmesi (D14)
- Per-request caching (Next.js `React.cache` veya manual memoization)

**Out of scope**
- `Workspace`/`WorkspaceMember` tablolarının yaratılması (→ 02, 03)
- `requireWorkspaceContext` helper (→ 07)
- UI banner/empty-state metinleri (→ 63)
- Stripe Price oluşturma (→ 21, 31)
- `Subscription.plan` enum genişletme migration (→ 62)

## User stories

- **As an Owner** of a Family workspace, paid subscription ACTIVE: tüm Family limits ve flags açık olur.
- **As a MEMBER** of a Family workspace, kendi `Subscription`'ım FREE_TRIAL: workspace içinde Family entitlements görürüm, owner'ın aboneliği geçerli olduğu sürece.
- **As an Owner** whose card expired 3 gün önce: workspace 7 günlük grace period'da; yeni resource ekleyemem ama mevcutları görür/tamamlarım.
- **As an Owner** Pro → Family downgrade ettim, 8 üyem vardı: 6 ACTIVE + 2 OVERFLOW görürüm; OVERFLOW üyeler login olur ama hiçbir resource yaratamaz.
- **As a Pro subscriber**: `canRunBulkSync = true`, Partner Hub erişimi açık, `actionTierAllowedForPlan("PRO", "PREMIUM") = true`.

## Veri modeli

Bu doc yeni tablo yaratmaz. Aşağıdaki mevcut/planlı modellere **bağımlıdır**:

- `Workspace` (→ 02): `ownerUserId`, `deletedAt`, `name`
- `WorkspaceMember` (→ 03): `workspaceId`, `userId`, `role`, `status` (ACTIVE | OVERFLOW | SUSPENDED)
- `Subscription` (mevcut): `plan`, `status`, `currentPeriodEndsAt`, `provider`, `accessType`

`Subscription.plan` enum'unun `FAMILY` + `PRO` ile genişlemesi → `62-subscription-plan-field-updates.md`.

## API endpoint'leri

### Yeni
| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/workspace/entitlements` | required | required | — | `ResolvedEntitlements` | 401, 403, 410 |

Bu endpoint mobile read-only entitlement (`60-mobile-billing-readonly.md`) ve web header chip (`05-workspace-switcher-ui.md`) için kaynak.

### Mevcut endpoint'lere etki

Sprint 2'de aşağıdaki endpoint'ler `requireWorkspaceContext` (→ 07) üzerinden entitlement'ı alır:

- `/api/addresses` (POST), `/api/addresses/[id]` (PATCH/DELETE) — `entitlements.limits.maxAddresses`
- `/api/services` (POST), `/api/services/[id]` — `entitlements.limits.maxServices`
- `/api/moving/*` — `entitlements.flags.movingPlansEnabled` (her plan açık ama Free Trial limited)
- `/api/budget` — `entitlements.flags.consolidatedBudget` (FAMILY/PRO için household scope açar, 24)
- `/api/profile` — read-only, entitlement snapshot döner
- `/api/onboarding/progress` — setup grace ile beraber çalışır
- `/api/subscription/*` — entitlement değil, raw subscription döner (admin path haricinde)

`plan-limits.ts` exports (`canCreateAddress`, `canCreateService`, `canCreateMovingPlan`, `canCreateCustomProvider`, `canGenerateMoveTasks`, `canCreateMovingDestinationAddress`) imza değiştirmez ama içeride yeni resolver'ı çağırır. Çağrı yerleri bozulmaz; Sprint 2'de yavaş yavaş `workspaceId`-aware versiyona migrate edilir.

## Web

### Yeni sayfa/route
- `GET /api/workspace/entitlements` (yukarıda)

### Mevcut sayfalara etki
- Header chip (`05`) `useEntitlements()` hook'undan plan/grace banner verisini okur.
- `/billing`, `/account/subscription` sayfaları artık workspace-level entitlement'ı + raw subscription'ı yan yana gösterir (owner ve member için farklı view).
- Member dashboard'unda owner subscription expire olunca banner (→ 63).

### Componentler
- `lib/entitlements.ts` (server) — yeni dosya
- `hooks/useEntitlements.ts` (client) — `/api/workspace/entitlements` etrafında SWR wrapper

### Butonlar / actionlar
Doğrudan yok. Diğer feature doc'ları bu helper'ı kullanır.

## Mobile

### Yeni ekran
Yok. Mobile entitlement'ı `60-mobile-billing-readonly.md` üzerinden tüketir.

### Mevcut ekranlara etki
Mobile shared package'tan plan matrix ve `actionTierAllowedForPlan` helper'ını import eder. ApiClient (`packages/shared/src/api-client.ts`) `/api/workspace/entitlements` çağırır, response'u in-memory cache'ler.

### Componentler
- `packages/shared/src/entitlements.ts` mobile + web tarafından import edilir (saf, Prisma dependency yok).

## Admin

### Yeni sayfa
Yok (Admin Workspace Inspector → 50 bunu kullanır).

### Yetenekler
Admin tarafı bir workspace seçtiğinde `ResolvedEntitlements`'ı debug view olarak gösterir: resolved plan, owner, grace flag, overflow count, source subscription id. Manuel "force re-resolve" butonu (cache invalidation, 50'de detaylanır).

## Güvenlik

- [x] **Step-up auth?** Hayır — read endpoint, gate değil.
- [x] **PII redaction?** Response içinde owner email/name **yok**, sadece `ownerUserId` ve `plan` döner. Member'a owner subscription detay (kart, faturalar) sızdırılmaz.
- [x] **Audit log?** Hayır resolution kendisi audit-worthy değil; ama **plan downgrade** sonucu OVERFLOW tetikleyen event `audit.ts` üzerinden `WORKSPACE_SEAT_OVERFLOW` action ile loglanır (event source: Stripe webhook handler).
- [x] **Rate limit?** Endpoint `/api/workspace/entitlements` per-user 60/min (mobile poll'undan koruma).
- [x] **Permission matris?**
  - OWNER: full entitlement snapshot
  - ADMIN/MEMBER/CHILD/VIEW_ONLY: aynı snapshot (workspace çapında değer, role-bağımsız)
  - Workspace dışı user: 403
- [x] **Encryption at rest?** N/A — Subscription/Workspace zaten DB'de; entitlement türetilen, persist değil.
- [x] **GDPR DSAR + erase?** Entitlement persist değil; user erase olunca cascade `Workspace` → owner null → çözümleyici "no access" döner. DSAR export'ta `getEntitlements()` snapshot anlık üretilir.

## Migration / backward compat

Bkz. `09-existing-user-migration.md` ve `10-backward-compat-rollback.md`. Bu doc'un kendi migration adımı yok; sadece **yeni kod paths** ekler. Mevcut `plan-limits.ts` çağrı yerleri eski signature ile çalışmaya devam eder (adapter mode).

`Subscription.plan` enum'una `FAMILY`/`PRO` eklenene kadar (62), resolver `getEntitlements()` bilinmeyen plan değeri görürse warn loglar + `INDIVIDUAL` fallback'e düşer (fail-closed değil; mevcut müşterileri kilitlememek için).

## Etkilenen mevcut özellikler

- `apps/web/src/lib/plan-limits.ts` — adapter'a dönüşür, içerik `packages/shared/src/entitlements.ts`'e taşınır
- `apps/web/src/lib/api-gates.ts` — yeni `requireEntitlement(flag)` helper'ı eklenir
- `apps/web/src/lib/shared-billing.ts` — `getEffectiveEntitlement` çağrısı entitlements resolver'ı içinde delegation kalır
- `/api/profile` — entitlement snapshot field'ı genişler (`plan: "FAMILY" | "PRO"` döner)
- Mobile `useSubscription()` hook → `useEntitlements()` ile twin yaşar (Sprint 4'te birleştirme)

## Test plan

**Unit (`packages/shared/src/entitlements.test.ts`)**
- `actionTierAllowedForPlan` her plan×tier kombinasyonu
- `PLAN_LIMITS` matrix snapshot test
- Grace period bitiş hesabı (`gracePeriodEndsAt = subscription.currentPeriodEndsAt + 7d`)

**Integration (`apps/web/src/lib/entitlements.test.ts`)**
- Workspace + owner + active subscription → ACTIVE entitlement
- Workspace + owner + expired subscription within 7d → grace flags doğru
- Workspace + owner + expired subscription beyond 7d → hard-locked (yeni resource yok)
- Owner Pro→Family downgrade, 8 üyeli workspace → 2 OVERFLOW işaretlenir
- Member calling resolver → owner'ın subscription'ı kullanılır, kendi sub'ı ignored
- Workspace `deletedAt != null` → 410 üretir
- Plan değeri DB'de bilinmeyen string → INDIVIDUAL fallback + warn log

**E2E**
Sprint 2'de address create endpoint'i `requireWorkspaceContext` + entitlement gate ile birlikte test edilir; bu doc tek başına E2E'ye girmez.

**Manual QA**
- Stripe test mode: subscription cancel → 7 gün simülasyonu (test clock)
- Pro→Family Stripe webhook simülasyonu seat overflow tetiklediğini doğrula

## Açık sorular

1. `gracePeriodEndsAt` Stripe `cancel_at_period_end` vs hard expire farkını nasıl yansıtmalı? (öneri: hard expire'da 7 gün eklenir; cancel_at_period_end'de zaten `currentPeriodEndsAt` future → grace kicked in sayılmaz)
2. OVERFLOW üyeler için login akışı net mi — D2 "kick edilmez" diyor ama login'de hangi mesaj çıkar? `63-entitlement-banners-empty-states.md` cevap vermeli.
3. `actionTierAllowedForPlan` matrix lansman değerleri:
   - FREE_TRIAL → BASIC
   - INDIVIDUAL → BASIC, EXTENDED
   - FAMILY → BASIC, EXTENDED
   - PRO → BASIC, EXTENDED, PREMIUM
   Onay gerekli (D4 "Family'ye Premium aç" tartışmasına referans).
4. Per-request cache stratejisi: Next.js `React.cache()` mı `unstable_cache` mı? Test edilebilirlik için manual memo daha mı temiz?
5. Mobile cache TTL — 5 dk mı? Owner mid-session Stripe checkout yaparsa mobile entitlement ne zaman refresh olur? (Webhook → push notification → mobile cache invalidate öneri, Faz 2)
