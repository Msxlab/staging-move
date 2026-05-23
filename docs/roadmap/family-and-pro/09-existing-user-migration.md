# Existing User Migration → PERSONAL Workspace Backfill

- **Status**: Proposed (Family/Pro launch, Sprint 1)
- **Tier**: Infrastructure
- **Related decisions**: D17, D1, D2
- **Related docs**: `01-architecture-decisions.md`, `02-workspace-model.md`, `03-workspace-member-roles.md`, `07-api-workspace-context-helper.md`, `08-x-workspace-id-header.md`, `10-backward-compat-rollback.md`

## Amaç

Mevcut tüm User'lara workspace-tabanlı modele geçerken tek bir downtime-sız migration sağlamak. Her user için otomatik bir "personal" workspace yaratılır (D17), kullanıcı bunu fark bile etmeden mevcut adresleri/servisleri/planları bu workspace altında görmeye devam eder. Aile/Pro plan'ına geçen kullanıcı aynı workspace'i upgrade eder; ayrı bir "Family workspace yarat" akışı yok (D1).

Migration üç faza ayrılır: (1) forward-compatible şema, (2) data backfill, (3) cleanup. Dual-read window (→ 10) sırasında hem eski (userId-only) hem yeni (workspaceId) sorgular birlikte çalışır.

## Kapsam

**In scope**
- Phase 1 Prisma migration: yeni tablolar + nullable `workspaceId` kolonları
- Phase 2 backfill script (`scripts/migrate-to-workspaces.ts`)
- Phase 3 cleanup migration (NOT NULL + index hardening)
- Idempotency stratejisi (script resumable)
- Progress logging, ETA, batch tuning
- Rollback notları (→ detay 10)
- Test/staging doğrulama planı

**Out of scope**
- Dual-read query branching code (→ 10)
- Feature flag mekaniği (→ 10)
- Workspace switcher UI (→ 05)
- Old `FamilyMember` tablosu (zaten phase0_cleanup ile düşürülmüş, geri gelmiyor)

## User stories

N/A — Infrastructure. Migration sonrası user-facing fark:
- Web header'da yeni "My Move" workspace chip'i görünür (→ 05)
- Mobile'da aynı şekilde
- Mevcut tüm data intact ve erişilebilir
- Hiçbir kullanıcı işlemi gerekmez

## Veri modeli

### Phase 1 migration: `20260601000000_workspace_phase1_forward_compat`

```prisma
+ model Workspace {
+   id           String   @id @default(cuid()) @db.VarChar(30)
+   ownerUserId  String   @db.VarChar(30)
+   owner        User     @relation("WorkspaceOwner", fields: [ownerUserId], references: [id], onDelete: Restrict)
+   name         String   @db.VarChar(120)
+   createdAt    DateTime @default(now())
+   updatedAt    DateTime @updatedAt
+   deletedAt    DateTime?
+
+   members      WorkspaceMember[]
+   invitations  WorkspaceInvitation[]
+   addresses    Address[]
+   services     Service[]
+   movingPlans  MovingPlan[]
+   budgets      Budget[]
+
+   @@index([ownerUserId])
+   @@index([deletedAt])
+ }
+
+ model WorkspaceMember {
+   id          String   @id @default(cuid()) @db.VarChar(30)
+   workspaceId String   @db.VarChar(30)
+   userId      String   @db.VarChar(30)
+   role        String   @db.VarChar(20)  // OWNER | ADMIN | MEMBER | CHILD | VIEW_ONLY
+   status      String   @default("ACTIVE") @db.VarChar(20)  // ACTIVE | OVERFLOW | SUSPENDED
+   joinedAt    DateTime @default(now())
+
+   workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
+   user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
+
+   @@unique([workspaceId, userId])
+   @@index([userId])
+ }
+
+ model WorkspaceInvitation {
+   id                 String   @id @default(cuid()) @db.VarChar(30)
+   workspaceId        String   @db.VarChar(30)
+   invitedEmail       String   @db.VarChar(255)
+   role               String   @db.VarChar(20)
+   tokenHash          String   @db.VarChar(64)
+   invitedByUserId    String   @db.VarChar(30)
+   expiresAt          DateTime
+   acceptedAt         DateTime?
+   acceptedByUserId   String?  @db.VarChar(30)
+   revokedAt          DateTime?
+   createdAt          DateTime @default(now())
+
+   workspace          Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
+
+   @@unique([workspaceId, invitedEmail, expiresAt])
+   @@index([tokenHash])
+ }
+
+ model WorkspaceAuthChallenge {
+   id          String   @id @default(cuid()) @db.VarChar(30)
+   userId      String   @db.VarChar(30)
+   workspaceId String   @db.VarChar(30)
+   method      String   @db.VarChar(20)  // PASSWORD | TOTP | SMS | EMAIL_OTP
+   tokenHash   String   @db.VarChar(64)
+   challengeFor String  @db.VarChar(40)  // e.g. "ADDRESS_CHANGE_EVENT"
+   expiresAt   DateTime
+   consumedAt  DateTime?
+   createdAt   DateTime @default(now())
+
+   @@index([userId, expiresAt])
+ }

  model Address {
    id     String @id @default(cuid()) @db.VarChar(30)
    userId String @db.VarChar(30)
+   workspaceId String? @db.VarChar(30)   // nullable in Phase 1
    user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
+   workspace Workspace? @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
    …
+   @@index([workspaceId])
  }

  model Service {
    …
+   workspaceId String? @db.VarChar(30)
+   workspace Workspace? @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
+   @@index([workspaceId])
  }

  model MovingPlan {
    …
+   workspaceId String? @db.VarChar(30)
+   workspace Workspace? @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
+   @@index([workspaceId])
  }

  model Budget {
    …
+   workspaceId String? @db.VarChar(30)
+   workspace Workspace? @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
+   @@index([workspaceId])
  }
```

`AddressChangeEvent` (henüz yok, → 11) zaten `workspaceId` zorunlu olarak doğar; Phase 1'de dahil değil.

### Phase 3 migration: `20260615000000_workspace_phase3_not_null`

(Dual-read window kapandıktan sonra, ~2 hafta sonra)

```sql
-- Verify zero NULLs before running:
-- SELECT COUNT(*) FROM "Address" WHERE "workspaceId" IS NULL; -- expect 0
ALTER TABLE "Address" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Service" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "MovingPlan" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Budget" ALTER COLUMN "workspaceId" SET NOT NULL;
```

`userId` kolonları **kalır** (rollback'ı mümkün kılmak için; query'lerde artık kullanılmaz ama drop edilmez).

## API endpoint'leri

### Yeni
Yok bu migration için. Migration sonrası workspace-related endpoint'ler ayrı doc'larda (02, 04).

### Mevcut endpoint'lere etki
Yok migration **sırasında**. Dual-read kod path'i ile API'ler her iki şemada da çalışır.

## Web

### Yeni sayfa/route
Yok.

### Mevcut sayfalara etki
Migration tamamlandığında "My Move" workspace chip görünür (→ 05). Kullanıcının açık bir aksiyonu gerekmez.

### Componentler
Yok bu doc'ta.

### Butonlar / actionlar
Yok.

## Mobile

### Yeni ekran
Yok.

### Mevcut ekranlara etki
Backfill sonrası `/api/workspace/entitlements` çağrısı dönmeye başlar; mobile workspace context init eder (→ 08). User-facing değişiklik minimum.

## Admin

### Yeni sayfa
Yok bu doc'a özgü.

### Yetenekler
Admin dashboard'a temporary "Migration Progress" widget eklenir: kaç user backfilled, kaç tablo NULL row kaldı. Migration tamamlandıktan sonra kaldırılır.

## Güvenlik

- [x] **Step-up auth?** N/A — server-side script.
- [x] **PII redaction?** Script log'larında email/name yazılmaz; sadece `userId` (cuid) ve count'lar.
- [x] **Audit log?** Her batch sonu `AdminAuditLog` row'u (`MIGRATION_BACKFILL_BATCH`, `processedUserIds`, `addressCount`, `serviceCount`, vs.). Tüm migration sonu özet row'u.
- [x] **Rate limit?** Script DB load koruma için configurable batch size (default 200 user/batch, 100ms sleep).
- [x] **Permission matris?** Script sadece deployment shell'den çalışır (admin secret env var gate).
- [x] **Encryption at rest?** Mevcut encrypted alanlar (`Service.accountNumber` vs.) dokunulmaz — sadece foreign key set edilir, plaintext görülmez.
- [x] **GDPR DSAR + erase?** Script tamamlandıktan sonra DSAR export workspaceId yolu üzerinden gider. Erase: User cascade hâlâ çalışır (`Workspace.owner onDelete: Restrict` — owner erase için önce workspace transfer edilir veya soft-delete edilir; bu akış 02'de detaylanır).

## Migration / backward compat

### Phase 2 script — `scripts/migrate-to-workspaces.ts`

**Algorithm (pseudocode)**

```ts
// Idempotent — safe to re-run after interruption.
async function migrate() {
  const batchSize = 200;
  let cursor: string | null = null;
  const stats = { users: 0, workspacesCreated: 0, addresses: 0, services: 0, movingPlans: 0, budgets: 0 };

  while (true) {
    const users = await prisma.user.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true, email: true, fullName: true },
    });
    if (users.length === 0) break;

    await prisma.$transaction(async (tx) => {
      for (const user of users) {
        // Idempotency: skip if already has owned workspace
        const existing = await tx.workspace.findFirst({
          where: { ownerUserId: user.id },
          select: { id: true },
        });
        const workspaceId = existing?.id ?? (await tx.workspace.create({
          data: {
            ownerUserId: user.id,
            name: deriveName(user.fullName) ?? "My Move",
          },
          select: { id: true },
        })).id;
        if (!existing) stats.workspacesCreated++;

        // Idempotency: OWNER membership
        await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId, userId: user.id } },
          create: { workspaceId, userId: user.id, role: "OWNER", status: "ACTIVE" },
          update: {},
        });

        // Backfill: only rows where workspaceId IS NULL (resumable)
        const a = await tx.address.updateMany({
          where: { userId: user.id, workspaceId: null },
          data: { workspaceId },
        });
        const s = await tx.service.updateMany({
          where: { userId: user.id, workspaceId: null },
          data: { workspaceId },
        });
        const m = await tx.movingPlan.updateMany({
          where: { userId: user.id, workspaceId: null },
          data: { workspaceId },
        });
        const b = await tx.budget.updateMany({
          where: { userId: user.id, workspaceId: null },
          data: { workspaceId },
        });
        stats.addresses += a.count; stats.services += s.count;
        stats.movingPlans += m.count; stats.budgets += b.count;
        stats.users++;
      }
    }, { timeout: 60_000 });

    cursor = users[users.length - 1].id;
    console.log(`[migrate] batch done, cursor=${cursor}, stats=${JSON.stringify(stats)}`);
    await sleep(100); // gentle on DB
  }

  console.log(`[migrate] complete: ${JSON.stringify(stats)}`);
}
```

**Estimated runtime**
- ~200 users/batch, ~5 queries/user, ~50ms/batch on warm Postgres → ~5–7 dakika per 10k users.
- 100k users → ~50–70 dakika. Production'da off-peak çalıştırılır.

**Idempotency guarantees**
- Workspace yaratma: `findFirst({ ownerUserId })` precheck → tek workspace
- Member upsert: `@@unique([workspaceId, userId])` doğal idempotent
- Backfill: `WHERE workspaceId IS NULL` clause sayesinde aynı row iki kez yazılmaz
- Cursor-based pagination: interruption sonrası `--from-user-id=<cursor>` flag ile resume

**Progress logging**
- Her batch sonu `console.log` + Postgres `migration_progress` ad-hoc tablosuna row (opsiyonel, gözlemlenebilirlik için)
- Slack webhook (admin alert) %25/50/75/100 milestone'larında

**Rollback (Phase 2 sonrası, Phase 3 öncesi)**
- Workspace ve WorkspaceMember tablolarını drop etmek **mümkün** çünkü `userId` kolonları kaldı.
- 10'da detaylı: feature flag `WORKSPACE_MODE = OFF` → eski query path
- `DELETE FROM "Workspace"` cascade ile member/invitation siler; `workspaceId` foreign key NULL'a düşer (nullable hâlâ).

**Test plan: staging dry-run**
1. Staging DB'ye 100 fake user + 5 address/user + 20 service/user seed
2. Migration script çalıştır
3. Doğrulamalar:
   - `SELECT COUNT(*) FROM "Workspace"` === user count
   - `SELECT COUNT(*) FROM "WorkspaceMember" WHERE role='OWNER'` === user count
   - `SELECT COUNT(*) FROM "Address" WHERE "workspaceId" IS NULL` === 0
   - `SELECT COUNT(*) FROM "Address"` (toplam) === migration öncesi count
   - Random 10 user için: address listesi userId vs workspaceId join identical
4. Script'i tekrar çalıştır → 0 yeni workspace yaratılır, 0 backfill (idempotent)
5. Bir user'ın workspaceId'sini elle NULL'a çek, script'i tekrar koş → tek o user backfilled

## Etkilenen mevcut özellikler

- `apps/web/src/lib/plan-limits.ts` — Phase 1 sonrası hâlâ userId-based, dual-read window'da çalışır
- Tüm prisma sorguları (`WHERE userId = ?`) Sprint 2 retrofit'inde yavaş yavaş `WHERE workspaceId = ?`'a geçer (10)
- Admin `/admin/users/[id]` sayfası migration sonrası "Owns workspace: …" satırı gösterir
- Mevcut `phase0_cleanup` migration'ı geri gelmez; `FamilyMember` tablosu yeniden gelmez — onun yerine `WorkspaceMember` kullanılır

## Test plan

**Unit (`scripts/migrate-to-workspaces.test.ts`)**
- `deriveName(fullName)` edge case'ler (null, empty, çok uzun, special chars)
- Single user backfill happy path
- Re-run sonrası idempotency (workspace count değişmez)
- Partial backfill (bazı row'lar NULL kaldı) → resume completion

**Integration**
- Test DB ile end-to-end: 100 user seed → script → schema doğrulama
- Concurrency: script çalışırken yeni address INSERT olursa (race) → yeni INSERT `workspaceId = null` ile gelir, sonraki batch yakalar (önemli: API tarafı dual-read mode'da olmalı, Phase 1 deploy'undan sonra Phase 2 başlamadan önce yeni insert'leri durduran değil)
- Interrupt + resume: 50 user işlenince kill, `--from-user-id=<cursor>` ile resume → sıfır data loss

**E2E**
- Production-shape staging dataset (sanitized snapshot) üzerinde tam migration + smoke test: random 20 user login → mevcut data görünüyor mu

**Manual QA**
- Production migration sonrası first-hour: error rate dashboard, API p95, support ticket trendi izle
- Rollback tatbikatı staging'de bir kez yapılmış olmalı

## Açık sorular

1. `deriveName` formülü: "<fullName>'s space" mi sadece "My Move" mu? Marketing/copy ekip kararı. Öneri: fullName varsa "<First>'s Workspace", yoksa "My Move".
2. OAuth-only kullanıcıların `fullName` boş olabilir — bu durumda "My Move" + email prefix fallback?
3. Phase 1 ve Phase 2 arasında pencere: API code dual-read'e geçmeden Phase 2 başlarsa yeni INSERT'ler `workspaceId = null` ile gelir → Phase 2 onları yakalar mı? Cevap: evet, ama sıralama önemli — order: (a) Phase 1 migration deploy, (b) API code deploy with dual-read flag `DUAL` mode, (c) Phase 2 backfill, (d) flag `WORKSPACE_ONLY`, (e) Phase 3 NOT NULL.
4. Backfill sırasında çok büyük user (10k+ services) timeout riski — transaction'ı user başına vs batch başına bölmek gerekir mi? Öneri: user başına transaction (yukarıdaki pseudocode), batch transaction değil.
5. `Workspace.owner onDelete: Restrict` user erase akışını engeller — owner erase için önce workspace soft-delete + transfer protokolü gerekir (02'de detaylanmalı).
6. Dual-read window süresi 2 hafta yeterli mi? Mobile yayın güncellemeleri (App Store/Play onayı) için 3-4 hafta gerekebilir. Öneri: minimum 21 gün, hard expire flag bazlı manuel.
