# Backward Compatibility & Rollback Plan

- **Status**: Proposed (Family/Pro launch, Sprint 1 → window aktif Sprint 2–4)
- **Tier**: Infrastructure
- **Related decisions**: D17, D14, D11
- **Related docs**: `01-architecture-decisions.md`, `06-entitlements-system.md`, `07-api-workspace-context-helper.md`, `08-x-workspace-id-header.md`, `09-existing-user-migration.md`, `20-family-plan-definition.md`, `30-pro-plan-definition.md`

## Amaç

Workspace mimarisine geçişte (1) eski client'ların çalışmaya devam ettiği bir **dual-read window** ve (2) bir şey çok ters giderse 24 saat içinde dönülebilecek bir **rollback path** garanti etmek. Mobile app'in store onay döngüsü 2-3 hafta sürebildiği için sunucu tarafının her iki şemada cevap vermesi zorunlu; tek-step "hot cutover" mobile için kabul edilemez.

Bu doc bir özellik değil, **operasyonel disiplin**: hangi feature flag, hangi kod branş, hangi geri alma adımları, ve neyin geri alınamayacağı dürüstçe yazılı.

## Kapsam

**In scope**
- `WORKSPACE_MODE` feature flag (`RuntimeConfigEntry` üzerinden)
- Dual-read kod path'leri (Prisma where clause branching)
- Rollback prosedürleri (flag flip, DB revert, table drop scripts)
- Communication plan (status page, email, in-app banner)
- Rollback'tan etkilenen müşteri datası (Family/Pro purchases refund flow)
- Risk matrisi

**Out of scope**
- Migration script kendisi (→ 09)
- Helper kodu (→ 07, 08)
- Entitlement resolver (→ 06)

## User stories

- **As an SRE on-call**: 02:00'de Family checkout endpoint error rate %15'e fırladı. `WORKSPACE_MODE = DUAL → OFF` tek satır flag değişikliği ile mevcut akışı eski path'a düşürebilir, downtime'sız.
- **As a customer who just bought Family**: Rollback yapılırsa $9.99 ücretim refund edilir, "Family kısa süreliğine geri çekildi" emaili alırım, hesabımdaki üyelerim INDIVIDUAL plan'a düşer.
- **As a developer**: 3 hafta sonunda dual-read kodunu silmek için `WORKSPACE_ONLY` mode aktif olur, OR clause'lar legacy path olarak işaretlenir, takip eden sprint'te kaldırılır.

## Veri modeli

### Yeni flag: `WORKSPACE_MODE`

`RuntimeConfigEntry` mevcut tablo; yeni key eklenir:

```
key: "WORKSPACE_MODE"
value: "OFF" | "DUAL" | "WORKSPACE_ONLY"
scope: "runtime"
category: "feature_flag"
editable: "Restricted"   // sadece admin + audit log
default: "OFF" (Sprint 1 deploy zamanı)
```

Lifecycle:
- Sprint 1 deploy → `OFF` (kod merged, flag inactive)
- Phase 1 migration + Phase 2 backfill bittikten sonra → `DUAL` (API'ler her iki path'i destekler)
- 2-3 hafta dual-read window → `WORKSPACE_ONLY`
- Phase 3 cleanup migration sonrası → flag silinir (kod legacy path'i kaldırılır)

### Code branching pattern

Prisma sorgularında:

```ts
// apps/web/src/lib/workspace-query.ts (yeni helper)
export function workspaceScopeWhere(
  workspaceId: string,
  userId: string,
  mode: "OFF" | "DUAL" | "WORKSPACE_ONLY",
) {
  switch (mode) {
    case "OFF":
      return { userId };
    case "DUAL":
      return {
        OR: [
          { workspaceId },
          { AND: [{ workspaceId: null }, { userId }] },
        ],
      };
    case "WORKSPACE_ONLY":
      return { workspaceId };
  }
}
```

Her veri-okuyan handler bu helper'ı kullanır. Write path her zaman `workspaceId` set eder (Phase 1 migration deploy'undan sonra her INSERT workspaceId taşır).

## API endpoint'leri

### Yeni
Yok bu doc'a özgü. Flag okuma `06`/`07` helper'larının içinde.

### Mevcut endpoint'lere etki

Sprint 2 retrofit edilen tüm route'lar `workspaceScopeWhere(mode)` ile sorgu kurar:

```ts
const mode = await getWorkspaceMode(); // cached per-request
const ctx = await requireWorkspaceContext(request);
const addresses = await prisma.address.findMany({
  where: { ...workspaceScopeWhere(ctx.workspaceId, ctx.userId, mode), deletedAt: null },
});
```

`OFF` mode'da `requireWorkspaceContext` hâlâ çağrılır ama sadece `userId` döner (workspaceId field değer atanır ama query'de kullanılmaz).

## Web

### Yeni sayfa/route
Yok.

### Mevcut sayfalara etki
SSR sayfaları aynı `workspaceScopeWhere` helper'ını kullanır. UI farkı yok — flag transparent.

### Componentler
- `lib/workspace-query.ts` — yeni
- `lib/workspace-mode.ts` — flag reader (cached)

### Butonlar / actionlar
Yok son kullanıcıya.

## Mobile

### Yeni ekran
Yok.

### Mevcut ekranlara etki
Mobile flag-aware değil; server tarafı flag'i okur, response aynı şekil. Mobile her zaman `X-Workspace-Id` header'ı (08) gönderir; `OFF` mode'da server header'ı ignore eder, `DUAL`/`WORKSPACE_ONLY`'de kullanır.

### Componentler
Yok.

## Admin

### Yeni sayfa
**`/admin/feature-flags` mevcut sayfaya satır**: `WORKSPACE_MODE` field. Dropdown: OFF/DUAL/WORKSPACE_ONLY. Her değişiklik `AdminAuditLog` row'u + Slack alert.

### Yetenekler
- Flag değişim öncesi confirmation modal: "Are you sure? This will change query behaviour globally."
- Migration progress widget (09) bu sayfayla birlikte yaşar
- Rollback runbook link

## Güvenlik

- [x] **Step-up auth?** Evet — flag change için admin step-up (mevcut admin step-up policy'sine ek).
- [x] **PII redaction?** Flag change audit log'u sadece admin id + eski/yeni değer içerir.
- [x] **Audit log?** `AdminAuditLog` action: `WORKSPACE_MODE_CHANGED`, before/after değerler, IP, user agent.
- [x] **Rate limit?** Flag endpoint per-admin 5/saat (abuse koruma).
- [x] **Permission matris?** Sadece `SUPER_ADMIN` rolü değiştirebilir. Diğer admin rolleri read-only.
- [x] **Encryption at rest?** N/A.
- [x] **GDPR DSAR + erase?** Flag değeri PII değil, DSAR'a girmez.

## Migration / backward compat

### Rollback prosedürleri

#### (a) Soft rollback — flag flip (yapılabilir herhangi bir noktada)

**Trigger condition**: post-deploy 60 dk içinde error rate baseline'a göre +10% veya kritik endpoint p95 > 2x baseline.

**Adımlar (5 dakika)**:
1. `/admin/feature-flags` → `WORKSPACE_MODE = OFF`
2. Cache invalidation (Redis flush + per-instance config refetch — `runtime-config.ts` mevcut mechanism)
3. Status page: "Investigating elevated error rates"
4. Monitoring: error rate baseline'a dönmeli 2 dk içinde

**Etkilenen müşteriler**: Aktif olarak workspace switcher kullanan kullanıcılar fark eder (chip "Personal"a düşer). Family/Pro satın alınmış sub'lar **aktif kalır** ama feature gate'ler workspace çözümlemediği için Individual gibi davranır. Bu **maximum 24 saat** tolere edilebilir; sonrasında ya forward-fix ya tam rollback.

#### (b) DB migration revert — Phase 3 öncesi

**Yapılabilir koşul**: `workspaceId NOT NULL` constraint henüz uygulanmadıysa (Phase 3 henüz çalışmadıysa).

**Adımlar**:
1. Soft rollback (a) yapılmış olmalı
2. `scripts/rollback-workspaces.ts` çalıştır:
   ```sql
   -- Tüm workspaceId'leri NULL'a çek (data loss yok, userId duruyor)
   UPDATE "Address" SET "workspaceId" = NULL;
   UPDATE "Service" SET "workspaceId" = NULL;
   UPDATE "MovingPlan" SET "workspaceId" = NULL;
   UPDATE "Budget" SET "workspaceId" = NULL;
   ```
3. Prisma migration revert: `prisma migrate resolve --rolled-back 20260601000000_workspace_phase1_forward_compat`
4. Yeni revert migration deploy: `20260601000001_workspace_phase1_revert` (kolonları ve tabloları düşürür)

#### (c) Drop workspace tables — geri dönüşü olmayan adımdan önce SON ÇARE

```sql
-- 20260601000001_workspace_phase1_revert/migration.sql
DROP TABLE IF EXISTS "WorkspaceAuthChallenge";
DROP TABLE IF EXISTS "WorkspaceInvitation";
DROP TABLE IF EXISTS "WorkspaceMember";
DROP TABLE IF EXISTS "Workspace";
ALTER TABLE "Address" DROP COLUMN IF EXISTS "workspaceId";
ALTER TABLE "Service" DROP COLUMN IF EXISTS "workspaceId";
ALTER TABLE "MovingPlan" DROP COLUMN IF EXISTS "workspaceId";
ALTER TABLE "Budget" DROP COLUMN IF EXISTS "workspaceId";
```

**Geri dönüşü olmayan**: Bu noktadan sonra mevcut tüm invitation/member/workspace history kaybolur. Yeniden migration için Phase 1+2 tekrar yapılır.

### Communication plan

**Internal**: Slack `#oncall` + `#eng-leadership` immediate. PagerDuty acknowledge.

**External (soft rollback)**:
- Status page yellow banner: "Investigating elevated error rates on shared workspace features"
- 1 saat içinde resolved → status page green, no further comms

**External (hard rollback with refunds)**:
- In-app banner: "Family/Pro temporarily unavailable. We've fully refunded affected customers and will share an update soon."
- Email to Family/Pro buyers: refund confirmation + apology + ETA for re-launch
- Status page incident with timeline
- 24 hours later: postmortem published on blog

### Rollback sonrası neye olur

**Survives (intact)**
- Tüm existing user data: addresses, services, moving plans, budgets, profile
- Mevcut INDIVIDUAL sub'lar: Stripe/IAP üzerinden aynen devam
- Mevcut Free Trial / Free Access durumları
- Auth, session, OAuth account, email log, blog, help, audit

**Does NOT survive**
- Family/Pro purchases (Stripe subscription) — **refund process**:
  - Stripe Dashboard veya `scripts/refund-family-pro.ts` ile bulk refund
  - Webhook handler refund event'i ile Subscription row'unu CANCELED yapar
  - Customer email: "Refund confirmed for $9.99/$19.99"
- Workspace member invitations
- Workspace switching state (cookie/storage temizlenir)
- AddressChangeEvent ve PartnerSyncAttempt history (henüz hiç olmamış gibi)
- Address labels (32) — eğer kullanılmaya başlanmışsa kolon kalır, UI gate düşer

### Risk matrix

| Risk | Olasılık | Etki | Mitigasyon |
|---|---|---|---|
| Phase 1 migration prod'da timeout | Düşük | Yüksek | Off-peak deploy, idempotent script, statement_timeout artırıldı |
| Phase 2 backfill yarıda kalır | Orta | Düşük | Cursor resume; her batch transaction |
| Dual-read OR clause yavaş sorgular | Orta | Orta | `workspaceId` index Phase 1'de eklendi, p95 izlenir; gerekirse Phase 2 sonrası index analyze |
| WORKSPACE_MODE flag cache stale | Düşük | Orta | Per-request fetch; manuel refresh endpoint admin için |
| Mobile eski build dual-read off mode'da `X-Workspace-Id` header gönderir | Düşük | Düşük | Server tarafı header'ı OFF mode'da silently ignore eder |
| Family/Pro Stripe webhook race | Düşük | Yüksek | Webhook idempotency mevcut (ProcessedWebhookEvent), test edilmiş |
| Rollback sonrası Family müşteri data'sı silinemez (kullanmaya devam etmek ister) | Orta | Orta | Workspace soft-delete (deletedAt set), data 30 gün retention, sonra hard delete |
| Phase 3 NOT NULL migration race (concurrent INSERT) | Düşük | Yüksek | Phase 3 öncesi maintenance window 5 dk, write lock |

## Etkilenen mevcut özellikler

- `apps/web/src/lib/runtime-config.ts` / `packages/shared/src/runtime-config.ts` — yeni key registration
- `apps/web/src/lib/feature-flags.ts` — flag exposure helper
- Tüm Sprint 2 retrofit edilen route'lar — `workspaceScopeWhere` helper kullanır
- Admin feature flags sayfası — yeni satır
- Migration pipeline (CI) — Phase 1/3 SQL'leri review gate'ten geçer

## Test plan

**Unit (`apps/web/src/lib/workspace-query.test.ts`)**
- Her mode için where clause snapshot
- DUAL mode'da `workspaceId IS NULL AND userId = ?` branch'i tetiklenir
- WORKSPACE_ONLY mode'da `userId` filtresi yok

**Integration**
- 3 mode'da `/api/addresses` GET farklı response set'leri:
  - OFF: tüm userId match (workspaceId fark etmez)
  - DUAL: workspaceId match + workspaceId null userId match
  - WORKSPACE_ONLY: sadece workspaceId match
- Mode geçişi sırasında race: cache TTL içinde stale read olabilir, kabul edilebilir (5 sn)

**E2E**
- Staging'de full rollback drill: Phase 1 + 2 → flag DUAL → ham mevcut user login → switcher OK → flag OFF → switcher kaybolur ama data erişilebilir → flag DUAL → switcher geri gelir
- Hard rollback drill: revert migration → Workspace tablosu yok → user login OK → mevcut data intact

**Manual QA**
- Production benzeri load testi: dual-read OR clause performance
- Random 50 user'da Phase 3 NOT NULL öncesi sıfır NULL doğrulaması

## Açık sorular

1. Dual-read window süresi: 2 hafta önerildi (D17); mobile App Store onay süresi gecikirse uzatılmalı. Karar matrisini hangi metrik tetikler? Öneri: dual-read window flag'i sadece `mobile_versions_below_x: < 5%` koşulu sağlanınca `WORKSPACE_ONLY`'e çevrilir.
2. Stripe Family/Pro Price ID'leri rollback durumunda Stripe Dashboard'dan archive edilmeli mi yoksa code-level enable/disable yeterli mi? Öneri: code-level (Stripe Price'ları idempotent kalır, re-launch'ta yeniden enable).
3. Rollback sırasında WorkspaceInvitation gönderilmiş email link'leri 410 GONE döner — invitee'lere "workspace yok artık" email'i mi gitmeli yoksa silent fail mi? Öneri: silent + revoked status.
4. Hard rollback sonrası kullanıcı UI'da hâlâ "Family" plan görüyorsa (cache) confusion riski — force logout etmek gerek mi? Öneri: rollback script'i tüm `UserLoginSession` invalidate eder.
5. `WORKSPACE_MODE = WORKSPACE_ONLY` deploy sonrası ne kadar süre legacy kod kalmalı? Öneri: 1 sprint (2 hafta), sonra cleanup PR'ı.
6. Mobile dual-read'in farkında olmaz; ama eski mobile build `X-Workspace-Id` göndermediğinde primary workspace fallback'i (07 + 08) Sprint 2 sonrası deploy edilmiş olmalı. Sprint sırası garanti edilmeli.
