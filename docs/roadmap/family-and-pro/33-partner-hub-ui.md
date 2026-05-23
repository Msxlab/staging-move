# Partner Hub UI

- **Status**: Proposed (Family/Pro launch, Sprint 3)
- **Tier**: Pro (full); Family sees preview/teaser; Individual/Free Trial: locked
- **Related decisions**: D4, D11, D15
- **Related docs**: `01-architecture-decisions.md`, `06-entitlements-system.md`, `30-pro-plan-definition.md`, `34-service-provider-action-registry.md`, `35-partner-sync-attempts.md`, `36-partner-deep-link-launcher.md`, `61-pricing-page-update.md`, `63-entitlement-banners-empty-states.md`

## Amaç

Pro plan'ının ana satış argümanı olan "100+ servisle one-click open & update" deneyimini sunan landing sayfası. Kullanıcı kategoriye, partner adına, aksiyon türüne göre tarayabilir; "benim aktif servislerim" filtresiyle hayatına en yakın listeyi görür; her partner card'ından doğrudan "Open & Update →" launcher'ı tetikler. D15 gereği lansmanda hiçbir "Verified Sync" rozeti yok — sadece kanal etiketi ("Update via partner site / email / PDF").

## Kapsam

**In scope**
- Web route `/partner-hub` (Pro + Family teaser)
- Layout: header + category nav + grid card listesi + filter sidebar
- 4 ana filter: kategori, aksiyon türü, "active for me" (kullanıcının servisi olan), arama
- Card expand → action list
- Loading skeleton, empty state, pagination/virtualization
- Family teaser: read-only browse, action butonları "Upgrade to Pro" CTA'ya dönüşür
- Mobile equivalent: basit liste (`apps/mobile/app/partner-hub/index.tsx`)
- Performance: 100+ partner, kategoriyle paginate veya `react-window` virtualize
- Cross-link from pricing page (61): "see Partner Hub demo →"

**Out of scope**
- ServiceProviderAction modeli ve seed (→ 34)
- Sync attempt tracking (→ 35)
- Launcher UX (clipboard + new tab) (→ 36)
- PDF letter generator (→ 37)
- mailto template kütüphanesi (→ 38)
- Admin provider/action CRUD (→ 51)
- AddressChangeEvent wizard (→ 13) — Partner Hub vs wizard ayrı entry point'ler

## User stories

- **As a Pro user**, `/partner-hub` aç → 100+ partner kategori sekmelerle gruplanmış. "Streaming" kategorisinden Netflix card'ı genişlet → "Update billing address" aksiyonunu seç → launcher tetiklenir (36).
- **As a Pro user**, "Active for me" filter'ı açar → sadece elimde Service kayıtlı 12 partner görünür → her birinden 30 sn'de adres güncelleme akışına girer.
- **As a Family user**, `/partner-hub`'a gider, browse edebilir ama tıklayınca "Upgrade to Pro to use Partner Hub" modal'ı + ekran içinde "Locked" overlay.
- **As an Individual / Free Trial user**, navigation menüsünde Partner Hub link'i upsell rozetiyle (kilit ikonu); tıklayınca pricing page'e yönlendirilir.
- **As a Pro user on mobile**, basit liste görür, kategori filter, arama; tıkla → launcher (36).

## Veri modeli

Bu doc yeni model yaratmaz. Bağımlı:

- `ServiceProvider` (mevcut, line 636) — partner katalog.
- `ServiceProviderAction` (→ 34) — partner başına yapılabilir aksiyonlar.
- `Service` (mevcut, line 451) — "active for me" filter için kullanıcının provider'a bağlı service kayıtları.
- `PartnerSyncAttempt` (→ 35) — geçmiş action history badge.

## API endpoint'leri

### Yeni
| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/partner-hub/providers` | required | required | query: `category?`, `actionType?`, `activeForMe?=true`, `q?`, `cursor?`, `limit?=24` | `{ items: ProviderWithActionsDto[], nextCursor?, total }` | 401, 403 (no entitlement.flags.partnerHub) |
| GET | `/api/partner-hub/providers/[id]` | required | required | — | `ProviderWithActionsDto` | 404 |

`ProviderWithActionsDto` shape (özet):

```ts
{
  id: string;
  name: string;
  slug: string;
  category: string;
  logoUrl?: string;
  popularityScore: number;
  isActiveForMe: boolean;    // server-computed: user has Service WHERE providerId = this.id
  actions: Array<{
    id: string;
    actionType: "ADDRESS_UPDATE"|"MAIL_FORWARDING"|"CANCEL"|"TRANSFER"|"VERIFY_ADDRESS"|"CONTACT_SUPPORT"|"UPDATE_PAYMENT";
    channel: "DEEP_LINK"|"MAILTO"|"PDF"|"PHONE"|"API";
    verificationTier: "UNVERIFIED"|"OFFICIAL_LINK"|"PARTNER_VERIFIED"|"API_VERIFIED";
    actionTier: "BASIC"|"EXTENDED"|"PREMIUM";  // D4 tier — server already filters out tiers user's plan can't see
    averageMinutes?: number;
    allowedByMyPlan: boolean;  // helper, redundant with server filter but useful for UI greyout if leak
  }>;
}
```

Server-side tier filter: `entitlements.actionTierMax` (D4 helper) → query filter `where: { actionTier: { in: allowedTiers } }`. Aşırı güvenlik için client de re-check.

### Mevcut endpoint'lere etki
- `GET /api/services` mevcut: provider relation zaten geliyor, ekstra iş yok.

## Web

### Yeni sayfa/route

- `apps/web/src/app/(app)/partner-hub/page.tsx` — server component, initial data fetch.
- `apps/web/src/app/(app)/partner-hub/loading.tsx` — skeleton.
- `apps/web/src/app/(app)/partner-hub/[providerId]/page.tsx` — opsiyonel detail route (modal yerine ayrı sayfa); MVP'de modal yeterli, route Faz 2.

### Mevcut sayfalara etki

- Navigation/sidebar (`apps/web/src/components/layout/Sidebar.tsx` veya benzeri): "Partner Hub" link eklenir. Entitlement kapalıysa link `<Lock>` ikonu + upsell.
- Account page'de "Partner Hub" widget'ı (opsiyonel, son zamanlarda tıklanan partner'lar). MVP'de skip.

### Componentler (file paths)

- `apps/web/src/components/partner-hub/PartnerHubHeader.tsx` — arama input + "active for me" toggle + "All actions" multi-select.
- `apps/web/src/components/partner-hub/PartnerCategoryNav.tsx` — horizontal tabs: `All | Utility | Finance | Insurance | Streaming | Government | Retail | Other`. Tab counts (provider sayısı) yanında.
- `apps/web/src/components/partner-hub/PartnerCard.tsx` — logo, name, "5 actions" badge, popularity, "Active for me" rozeti (varsa).
- `apps/web/src/components/partner-hub/PartnerActionList.tsx` — card expand olunca açılır; her action: ikon (channel), label ("Update address"), tahmini süre ("~2 min"), `<PartnerActionButton>` (36).
- `apps/web/src/components/partner-hub/PartnerHubEmptyState.tsx` — "No services match. Add a service first or try another category."
- `apps/web/src/components/partner-hub/PartnerHubPaywall.tsx` — Family/Individual için locked overlay + "Upgrade to Pro" CTA.
- `apps/web/src/components/partner-hub/PartnerHubGrid.tsx` — `react-window` virtualization 100+ kart için (kategori filter zaten ~20'ye iniyor, virtualization "All" tab için kritik).

### Butonlar / actionlar

| Buton | Davranış |
|---|---|
| Search input | Debounced (300ms) `?q=` query update |
| "Active for me" toggle | `?activeForMe=true` query update |
| Category tab | `?category=Utility` |
| Action type multi-select | `?actionType=ADDRESS_UPDATE,CANCEL` |
| Provider card click | Card expand (accordion); URL hash `#provider-{slug}` |
| `<PartnerActionButton>` "Open & Update →" | 36 launcher flow |
| "Upgrade to Pro" (Family/Indiv) | `/account?upgrade=pro` redirect |

### Wireframe (ASCII)

```
┌──────────────────────────────────────────────────────────────────┐
│  Partner Hub                                                     │
│  ┌─────────────────────────┐  [☑ Active for me]  [Actions ▾]    │
│  │ 🔍 Search 100+ partners │                                     │
│  └─────────────────────────┘                                     │
│  All(120) Utility(34) Finance(18) Insurance(12) Streaming(22)... │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ [USPS]   │  │ [Netflix]│  │ [Chase]  │  │ [AT&T]   │         │
│  │ Mail Fwd │  │ Streaming│  │ Finance  │  │ Utility  │         │
│  │ 2 actions│  │ 1 action │  │ 3 actions│  │ 4 actions│         │
│  │ ⭐⭐⭐⭐⭐  │  │ • active │  │          │  │ • active │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│  ... (virtualized, 24 per page)                                  │
├──────────────────────────────────────────────────────────────────┤
│  When card expanded:                                             │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ [Netflix]   netflix.com                                  │    │
│  │ ────────────────────────────────────────────────────────│    │
│  │ 📝 Update billing address   ~1 min   [Open & Update →]   │    │
│  │   via partner site (deep link)                           │    │
│  │ 📧 Cancel subscription      ~3 min   [Open & Update →]   │    │
│  │   via email template                                     │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

**Family/Individual paywall overlay**:

```
┌──────────────────────────────────────────────────────────────────┐
│  Partner Hub                          🔒 Pro-only                │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Browse 100+ services and update your address in one     │    │
│  │  click. [Upgrade to Pro →]                               │    │
│  │  ─────────────────────────────────────────────────────── │    │
│  │  (Greyed-out preview of cards below, click → CTA modal)  │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

## Mobile

### Yeni ekran

- `apps/mobile/app/partner-hub/index.tsx` — SectionList ile kategori-grouped basit liste.
- `apps/mobile/app/partner-hub/[providerId].tsx` — partner detail + action list.

### Mevcut ekranlara etki

- Bottom tab veya drawer'a "Partner Hub" sekme eklenir (entitlement gated).
- Entitlement kapalıysa tab gri + tıklayınca "Upgrade on web" alert (D11).

### Componentler

- `apps/mobile/src/components/partner-hub/PartnerListItem.tsx` — logo + name + chevron + "X actions" badge.
- `apps/mobile/src/components/partner-hub/CategoryFilterBar.tsx` — horizontal scroll chips.
- `apps/mobile/src/components/partner-hub/PartnerActionRow.tsx` — `<PartnerActionPressable>` (36).
- `apps/mobile/src/components/partner-hub/UpgradeGateScreen.tsx` — Family/Indiv için.

## Admin

### Yeni sayfa / Yetenekler

Bu doc admin sayfası eklemiyor — provider/action CRUD 51'de. Admin "preview as user" Faz 2 toolu.

## Güvenlik

- [ ] **Step-up auth**: Browse için gereksiz. Launcher tıklamasında `AddressChangeEvent` zaten step-up almış (D10/D19) olduğu için ek auth yok. Hub'tan **standalone** action (event olmadan) MVP'de mevcut değil (her action mutlaka bir event'e bağlı).
- [ ] **PII redaction**: Hub data PII içermez (partner katalog public-ish). `isActiveForMe` flag'i sadece caller'a döner; başkasının service'i sızmaz.
- [x] **Audit log**: Browse log'lanmaz (yüksek volume). Card expand → 65 analytics event. Action click → 36 + 35 audit.
- [x] **Rate limit**: `/api/partner-hub/providers` GET cache'lenebilir; user başına 60/dk yeterli. Search query 30/dk debounced.
- [x] **Permission matris**: `entitlements.flags.partnerHub` true olmalı. PRO: true. FAMILY: false (UI teaser). INDIVIDUAL/FREE_TRIAL: false. OVERFLOW member: read-only (browse OK, action click 403). CHILD: sadece kendi Service'lerine bağlı partner'ları görür (22).
- [ ] **Encryption at rest**: N/A (katalog public).
- [ ] **GDPR DSAR**: N/A (caller'ın `isActiveForMe` computed; persisted değil).

## Migration / backward compat

- Yeni route, mevcut user etkilenmez.
- ServiceProviderAction tablosu ve seed (34) bağımlı: o yapılmadan bu sayfa boş listeyle render olur. CI test: empty state grafikle render.
- Family teaser flag'i 30'da `partnerHub: "teaser"` veya feature flag ile toggle edilebilir; karar 30 update PR'ında.

## Etkilenen mevcut özellikler

- Navigation/sidebar component.
- Pricing page (61) cross-link: comparison row'da "Partner Hub" satırı (✓ Pro, teaser Family, — Individual).
- Service detail sayfasında "Open in Partner Hub →" link (Pro için) — Sprint 3 polish.
- Analytics events (65): `partner_hub_viewed`, `partner_card_expanded`, `partner_action_clicked`.

## Test plan

**Unit**
- `ProviderWithActionsDto` mapper: action tier filtering for FAMILY plan returns BASIC+EXTENDED only.
- `isActiveForMe` computation: user has Service with providerId=X → flag true.
- Empty state: 0 providers → component renders empty message.

**Integration**
- `GET /api/partner-hub/providers?activeForMe=true` Pro user with 5 services → returns 5 providers.
- Family user `GET /api/partner-hub/providers` → 200 with full list (browse allowed); but `actions[].allowedByMyPlan` false for PREMIUM tier ones (or filtered server-side; karar: server filter, hiç döndürme).
- Individual user same call → 403.

**E2E (Playwright)**
- Pro user opens `/partner-hub`, filter "Streaming", expand Netflix, click "Update address" → launcher (mock'lu).
- Family user opens `/partner-hub`, sees paywall overlay, clicks "Upgrade to Pro" → routes to pricing.

**Manual**
- Mobile: scroll perf 100+ items.
- Web: virtualization perf "All" tab.
- Loading skeleton render under slow 3G throttle.

## Açık sorular

- Family için Partner Hub teaser açık mı yoksa tamamen kilitli mi? Önerilen: **teaser açık** (Pro upgrade conversion driver). Karar 30/61.
- "Active for me" toggle default açık mı kapalı mı? Öneri: kapalı (yeni kullanıcı tüm katalog görsün), ama service sayısı ≥ 5 ise otomatik açık.
- Provider card click davranışı (modal vs expand vs route)? Karar: **inline expand** (accordion), URL hash sync. Detail route Faz 2.
- Search backend mi client mi? 100+ partner için client'ta `Fuse.js` yeterli — initial fetch tüm liste, filter client. Eğer 500+ olursa server search.
- Action history rozeti (kaç kez kullanıldı) Pro için motivation sağlar mı? Sprint 3+ polish.
