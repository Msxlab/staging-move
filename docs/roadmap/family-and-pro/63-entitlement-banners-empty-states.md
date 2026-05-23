# Entitlement Banners & Empty States — Cross-cutting UI

- **Status**: Proposed (Family/Pro launch, Sprint 2 base + Sprint 4 polish)
- **Tier**: Cross-cutting
- **Related decisions**: D2 (owner-resolved entitlement + grace period + seat overflow), D11 (mobile read-only)
- **Related docs**: [06](./06-entitlements-system.md), [33](./33-partner-hub-ui.md), [40](./40-tax-property-export.md), [39](./39-vendor-contact-book.md), [13](./13-address-change-wizard-web.md), [04](./04-workspace-invitation.md), [65](./65-analytics-events.md)

## Amaç

Plan limit veya rol gating'ine takıldığında kullanıcıya **action-oriented, non-shaming** mesaj göstermek. Aynı pattern web + mobile'da tutarlı, tek componentten gelir. Üç ana sınıf:
1. **Locked feature** — kullanıcının planı bu özelliği desteklemiyor → upgrade CTA
2. **State edge** — owner sub expired (grace), seat overflow, trial ending
3. **Empty state** — workspace yeni, üye/adres yok

## Kapsam

**In scope (Sprint 2 base)**
- `<UpgradePromptBanner>`, `<UpgradePromptInline>`, `<LockedFeatureCard>` (page-level lock)
- `<OwnerSubExpiredBanner>`, `<SeatOverflowBanner>`, `<TrialEndingBanner>`
- Mobile equivalents: `<UpgradeCallout>`, `<StateBanner>`
- Copy guidelines + i18n key envanteri (cross-ref 67)
- Banner impression + click analytics (cross-ref 65)
- Test her locked feature için CTA doğru yere yönlendirir

**Out of scope**
- Çıkış CTA hedefi olan `/upgrade` sayfası (cross-ref 21, 31, 61)
- Plan tanımları ve limit değerleri (cross-ref 06, 20, 30)
- Email bildirimleri (cross-ref 66) — banner UI ile paralel ama ayrı kanal

## User stories

- **US-63.1** — Family plan kullanıcısı `/partner-hub`'a girer; tüm sayfa `<LockedFeatureCard>` ile yer değiştirir: başlık "Partner Hub is a Pro feature", alt "Track every utility, DMV, insurance and subscription you need to update when you move.", CTA "See Pro plan →" + thumbnail screenshot teaser.
- **US-63.2** — Free Trial kullanıcısı `/exports`'a girer; `<UpgradePromptBanner>` üstte: "Export your data with a paid plan. Upgrade to Individual to download CSV + PDF.", CTA "Upgrade".
- **US-63.3** — Individual kullanıcısı address-change wizard'ında "Scope: Custom" picker'da Family-only target type seçer; disabled radio + `<UpgradePromptInline>` lock icon + tooltip "Custom scope is part of Family. Upgrade →".
- **US-63.4** — Owner subscription 5 gün önce expire oldu (D2 grace, 7 gün pencere); workspace üyesi giriş yapar; her sayfada üstte `<OwnerSubExpiredBanner>` (sticky, yellow): "Your workspace owner's subscription expired. Read-only mode until {graceEndsAt}. {ownerName} can resubscribe to restore access.", "Dismiss" yok (önemli durum).
- **US-63.5** — Owner Pro → Family downgrade etti; workspace'te 8 üye var (Family limit 6); workspace settings/members sayfasında üstte `<SeatOverflowBanner>`: "You have 8 active members but Family supports 6. Everyone keeps access — no new invites until you either remove 2 or upgrade back to Pro.", CTA "Upgrade to Pro" + "Manage members".
- **US-63.6** — Trial Day 12/14 — `<TrialEndingBanner>`: "Your trial ends in 2 days. Add a payment method to keep going." (mevcut pattern, Family/Pro plan'larda da çalıştığı doğrulanır).
- **US-63.7** — CHILD rolündeki kullanıcı `/account/billing`'e direkt URL ile gider; `<LockedFeatureCard>`: "Billing is managed by the family owner. Ask {ownerFirstName} for any changes." (no CTA, dead-end with help link).
- **US-63.8** — VIEW_ONLY üye `/services/new`'ya gider; `<LockedFeatureCard>`: "You have view-only access to this workspace. Contact {ownerName} to add services."

## Veri modeli

N/A — pure UI. Banner state'i `ResolvedEntitlements` (cross-ref 06) ve `WorkspaceMember.status` (`ACTIVE | OVERFLOW`, cross-ref 02/03) okur.

## API endpoint'leri

Yeni endpoint yok. Banner componentleri server-rendered initial state'i `requireWorkspaceContext` (cross-ref 07) tarafından `entitlements` + `seatOverflow: boolean` + `graceEndsAt?: string` + `trialEndsAt?: string` alanlarıyla besler.

## Web

### Yeni sayfa/route

Yok. Componentler mevcut sayfaların layout'larına eklenir.

### Mevcut sayfalara etki

| Sayfa | Banner / Lock | Tetik koşulu |
|---|---|---|
| `/partner-hub` | `<LockedFeatureCard>` | `plan ∉ {PRO}` |
| `/exports` (yeni Sprint 4, cross-ref 40) | `<LockedFeatureCard>` | `plan ∉ {PRO}` (tax export Pro-only) |
| `/exports` basic CSV | `<UpgradePromptBanner>` | `plan === FREE_TRIAL` |
| `/vendor-book` (yeni, cross-ref 39) | `<LockedFeatureCard>` | `plan ∉ {PRO}` |
| `/address-change/new` "Scope: Custom" radio | `<UpgradePromptInline>` | `plan === INDIVIDUAL` (Family/Pro açık) |
| `/address-change/new` per-address target type | `<UpgradePromptInline>` | `plan === INDIVIDUAL` (ADDRESS scope Pro-only — Cross-ref D6) |
| `/workspace/members` invite button | `<UpgradePromptInline>` | seat dolu + plan upgradeable |
| `/workspace/members` üst banner | `<SeatOverflowBanner>` | `WorkspaceMember.status==OVERFLOW` count > 0 |
| Tüm üye sayfaları (layout-level) | `<OwnerSubExpiredBanner>` | `entitlements.status === GRACE_PERIOD && callerRole !== OWNER` |
| Tüm sayfalar (layout-level) | `<TrialEndingBanner>` | `entitlements.isTrial && daysRemaining ≤ 3` (mevcut pattern) |
| `/account/billing` (CHILD) | `<LockedFeatureCard>` | `role === CHILD` |
| `/services/new`, `/addresses/new`, `/budget/new` (VIEW_ONLY) | `<LockedFeatureCard>` | `role === VIEW_ONLY` |

### Componentler (file paths)

```
apps/web/src/components/entitlement/
  upgrade-prompt-banner.tsx      // top-of-page yellow banner
  upgrade-prompt-inline.tsx      // lock icon + tooltip on disabled control
  locked-feature-card.tsx        // full-page replacement
  owner-sub-expired-banner.tsx   // sticky, layout-level
  seat-overflow-banner.tsx       // workspace members page banner
  trial-ending-banner.tsx        // mevcut varsa rename + extend; yoksa yeni
  entitlement-context.tsx        // React context provider (entitlements + role)
  __tests__/
    upgrade-prompt-banner.test.tsx
    locked-feature-card.test.tsx
    seat-overflow-banner.test.tsx
```

**Tasarım tutarlılığı**: tüm banner'lar `apps/web/src/components/ui/alert.tsx` (shadcn) variant'ı üzerine kurulur. Renkler:
- Upgrade prompt → `variant=warning` (amber)
- Owner expired → `variant=destructive` (red)
- Seat overflow → `variant=warning` (amber)
- Trial ending → `variant=info` (blue)

**Props sözleşmesi**:

```ts
interface UpgradePromptBannerProps {
  feature: string;              // "data export", "partner hub", etc.
  requiredPlan: "INDIVIDUAL" | "FAMILY" | "PRO";
  currentPlan: BillingPlan;
  placement: string;            // analytics: "exports.header", "members.invite"
  onDismiss?: () => void;       // dismissable banner için
}

interface LockedFeatureCardProps {
  feature: string;
  requiredPlan: "INDIVIDUAL" | "FAMILY" | "PRO";
  description: string;          // ne yapabileceğin tek satır
  benefits: string[];           // 3–5 bullet
  thumbnailSrc?: string;        // teaser screenshot URL
  placement: string;
}

interface UpgradePromptInlineProps {
  requiredPlan: "FAMILY" | "PRO";
  tooltipText: string;          // "Custom scope is part of Family"
  ariaLabel: string;
}

interface OwnerSubExpiredBannerProps {
  ownerName: string;            // masked OK
  graceEndsAt: Date;            // 7-day window son
  currentPlan: BillingPlan;     // owner'ın eski planı
}

interface SeatOverflowBannerProps {
  activeCount: number;
  overflowCount: number;
  allowedCount: number;
  currentPlan: "FAMILY";        // downgrade Pro→Family için
  upgradeTargetPlan: "PRO";
}
```

### Butonlar / actionlar

Her CTA'da analytics event `entitlement.banner.clicked` (cross-ref 65) props: `{ placement, currentPlan, requiredPlan, action: "upgrade"|"dismiss"|"manage_members" }`. Impression: `entitlement.banner.viewed` IntersectionObserver ile (50% görünüm + 1s threshold, double-fire suppression session içinde).

CTA hedefleri:
- "Upgrade" → `/upgrade?plan={requiredPlan}&source=banner&placement={placement}`
- "Manage members" → `/workspace/members`
- "Dismiss" — sadece dismissable banner'larda (`<UpgradePromptBanner>` opsiyonel; owner expired ve seat overflow **dismiss edilemez**)
- Dismiss state localStorage `lf-banner-dismissed-{placement}-{date}` — gün başına reset (kullanıcı yarın yine görür)

## Mobile

### Yeni ekran

Yok. Componentler mevcut ekranlara eklenir.

### Mevcut ekranlara etki

```
apps/mobile/src/components/entitlement/
  UpgradeCallout.tsx           // <UpgradePromptBanner> mobile karşılığı (kart form)
  LockedFeatureScreen.tsx      // <LockedFeatureCard> full-screen
  StateBanner.tsx              // sticky top banner (sub expired, seat overflow)
```

Mobile'da inline tooltip yerine bottom-sheet modal: disabled buton tıklanınca "This feature requires Family. Upgrade on web →" modal açılır, dış browser link'i.

Etkilenen mobile ekranlar:
- `apps/mobile/app/(tabs)/services.tsx` — VIEW_ONLY rol → `<LockedFeatureScreen>`
- `apps/mobile/app/settings/subscription.tsx` (cross-ref 60) — owner expired banner üstte
- `apps/mobile/app/workspace/members.tsx` (yeni, cross-ref 03) — seat overflow banner
- `apps/mobile/app/_layout.tsx` (root) — `<StateBanner>` global slot (sub expired her ekranda görünür)

## Admin

`apps/admin/src/app/(admin)/workspaces/[id]/page.tsx` (yeni, cross-ref 50) — admin workspace inspector banner'ları **göstermez** ama "Effective entitlement state" panel'inde "Banner that user sees: OwnerSubExpired" debug info çıkar. Destek için faydalı.

## Güvenlik

- [x] **Step-up auth?** — Hayır, görüntüleme.
- [x] **PII redaction?** — `ownerName` banner'da gösterilirken first-name + masked initial (`John D.`); raw email gösterilmez. `apps/web/src/lib/audit-redaction.ts` benzeri util kullanılır.
- [x] **Audit log?** — Banner view/click analytics event'i (cross-ref 65), audit log değil (DSAR'a karışmaz).
- [x] **Rate limit?** — Impression event'lerinin throttling: 1 event/banner/session/dakika (client-side debounce).
- [x] **Permission matris?** — Banner render kararı `entitlements` + `role`'a göre, server-side trust edilir. Client-side gizleme **savunma derinliği**, gerçek koruma API gate (cross-ref 06/07).
- [x] **Encryption at rest?** — N/A.
- [x] **GDPR DSAR?** — Banner impression event'leri UserEvent'a yazılırsa DSAR export'unda görünür (PII içermez).

## Copy guidelines

- **Action-oriented**: "Upgrade to access" (✓) değil "Sorry, you can't" (✗)
- **No shame**: "X is part of Family" (✓) değil "You need to pay more" (✗)
- **Specific benefit**: "Track 100+ providers in Partner Hub" (✓) değil "Get more features" (✗)
- **Owner-aware**: CHILD/MEMBER'a "Ask {owner} to upgrade" (kullanıcı kendi açamaz)
- **Time-aware**: grace banner "until {date}" (urgency without panic)
- **i18n-safe**: cümle yapısı RTL gibi ileride patlamasın, value interpolation `{var}` token

## Migration / backward compat

- Mevcut trial-ending banner (varsa) `<TrialEndingBanner>`'a refactor edilir, mevcut görsel kontrak korunur
- Yeni `<UpgradePromptBanner>` Faz 1'de henüz feature locked endpoint yoksa görünmez (no-op)
- Mobile component eklemesi yeni dosya — backward compat sorunu yok

## Etkilenen mevcut özellikler

- Mevcut `apps/web/src/components/ui/alert.tsx` shadcn alert variant'ları — yeni "warning" + "info" variant eklenir (yoksa)
- Layout dosyaları (`apps/web/src/app/(app)/layout.tsx`) — `<OwnerSubExpiredBanner>` ve `<TrialEndingBanner>` global slot eklenir
- `requireWorkspaceContext` (cross-ref 07) response'a `bannerState: { ownerExpired, seatOverflow, trialEnding }` derived field eklenir (re-compute önlenir)

## Test plan

**Unit**
- Her banner componenti için props matrix snapshot
- `<LockedFeatureCard>` CTA href doğru plan + placement query string'i içerir
- `<SeatOverflowBanner>` count formatting ("8 of 6 active, 2 overflow")
- `<OwnerSubExpiredBanner>` `graceEndsAt` past olunca "ended yesterday" kopya değişir

**Integration**
- `/partner-hub` Family plan ile request → `<LockedFeatureCard>` render
- `/services/new` VIEW_ONLY rol ile → `<LockedFeatureCard>` render + form gizli
- Trial day 12 → banner görünür; day 15 (expired) → farklı durumdayız (trial ended ≠ banner gibi)

**E2E (Playwright)**
- Free Trial kullanıcısı `/exports` → banner gör → "Upgrade" tıkla → `/upgrade?plan=INDIVIDUAL&source=banner&placement=exports.header`
- Owner sub cancel → grace girer → member login → her sayfada banner sticky
- Family owner Pro→Family downgrade → 8 üyeli workspace → members page banner

**Manual**
- a11y: screen reader tüm banner'ları `role="alert"` veya `role="status"` ile okur
- Visual: light + dark theme her banner doğru kontrast (AAA target)
- i18n smoke: en + es + (TR varsa) çevirme tutarlılık

## Açık sorular

1. `<OwnerSubExpiredBanner>` member'a `ownerName` masked mı raw mı? Workspace içinde owner-member zaten birbirini biliyor (invite kabul ile); masked yerine first-name yeterli olabilir. Privacy review.
2. Trial ending banner mevcut implementation var mı? grep et — yoksa bu doc'tan yaratılır; varsa refactor scope'u bu doc'a girer.
3. Seat overflow downgrade akışında: kullanıcı 2 üye remove etmeyi seçerse hangileri? "Last invited" otomatik öneri mi yoksa user kendi seçer mi? **Tercih**: user seçer, ön-doldurulmuş öneri yok (yanlış silinen üye = destek krizi).
4. Mobile'da `<UpgradeCallout>` ile web'in `<UpgradePromptBanner>`'ı arasında copy paralel olmak zorunda mı yoksa mobile daha kısa varyant mı? Cross-ref 67 i18n key paylaşımı kararı.
5. `<LockedFeatureCard>` thumbnail screenshot teaser nereden geliyor? `/public/marketing/teasers/partner-hub.png` gibi static varlık. Sprint 4 design pass'inde üretilir.
6. Banner dismiss localStorage key TTL — gün başına reset agresif mi? Hafta başı reset daha iyi olabilir (less nag). User research.
