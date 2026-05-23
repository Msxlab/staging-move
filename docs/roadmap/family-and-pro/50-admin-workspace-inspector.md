# Admin Workspace Inspector

- **Status**: Proposed (Family/Pro launch, Sprint 1)
- **Tier**: Admin
- **Related decisions**: D2 (entitlements owner-resolved + grace + overflow), D3 (field-level service visibility), D5 (sabit rol matrisi), D7 (PartnerSyncAttempt idempotent), D17 (existing user migration)
- **Related docs**: [`02-workspace-model.md`](./02-workspace-model.md), [`03-workspace-member-roles.md`](./03-workspace-member-roles.md), [`06-entitlements-system.md`](./06-entitlements-system.md), [`11-address-change-event-model.md`](./11-address-change-event-model.md), [`35-partner-sync-attempts.md`](./35-partner-sync-attempts.md)

## Amaç

Destek ekibinin "müşterimin workspace'i bozuk, neyi göremiyor / hangi servis kayıp / kim ne yaptı" sorularını **kullanıcının hesabına girmeden** cevaplayabilmesi. Mevcut `apps/admin/src/app/(admin)/providers/` ve `waitlist/page.tsx` pattern'inin üstüne, workspace odaklı bir inspector inşa ederiz.

Bu sayfa **owner workspace'in dijital kimliği** olur: kim üye, ne ödüyor, kaç adres var, son hangi adres değişikliği olmuş, hangi partner sync'leri patlamış.

## Kapsam

**In scope**
- `/workspaces` list (search + paginate)
- `/workspaces/[id]` detail
- 4 admin action: impersonate-read, transfer ownership, reset member roles, suspend workspace
- AdminAuditLog her aksiyona yazılır
- 3 yeni AdminPermission: `workspace.impersonate.read`, `workspace.transfer.ownership`, `workspace.suspend`, `workspace.search.by_email`

**Out of scope**
- Write impersonation (admin asla kullanıcı adına yazamaz — D5 audit ilkesi)
- Workspace hard delete (sadece suspend; gerçek silme GDPR DSAR akışında ayrı)
- Subscription manipulation (Stripe portal'a link verilir, burada düzenlenmez)
- PartnerConsent yönetimi (D8 — schema-only, MVP'de UI yok)

## User stories

- As an **Admin** (with `workspace.impersonate.read`): bir destek bileti açıldı, kullanıcı "ev faturalarımı göremiyorum" diyor; workspace ID ile detail aç, impersonate-read modunda kullanıcının workspace'inde ne gördüğünü gözlemle.
- As an **Admin** (with `workspace.transfer.ownership`): owner hesabı suspend edilmiş, eş kişi destek talep etti; ownership'i adminin ikinci üyeye transfer et (step-up auth zorunlu).
- As a **support agent** (sadece `workspace.read` permission'lı): workspace search yap, member listesini gör, üye e-postaları **maskelenmiş** (`m***@gmail.com`) gör; full email için `workspace.search.by_email` gerekir.
- As an **Admin** (with `workspace.suspend`): kötüye kullanım raporu alındı; workspace'i suspend ederek tüm üye giriş ve write işlemlerini durdur, ekibe yansıt.

## Veri modeli

Bu doc **yeni tablo eklemez**. `Workspace`, `WorkspaceMember`, `AddressChangeEvent`, `PartnerSyncAttempt` (Sprint 1–3'te oluşturulur) okunur.

`Workspace` tablosuna **iki opsiyonel alan** eklenir:

```prisma
model Workspace {
  // existing fields...
  suspendedAt        DateTime?
  suspendedReason    String?    // free text from admin form, max 500 chars
  suspendedByAdminId String?    // FK -> AdminUser.id
}
```

`AdminPermission` seed insert:

```ts
const newPermissions = [
  { code: "workspace.read",              description: "Read workspace + member list (PII masked)" },
  { code: "workspace.search.by_email",   description: "Unmask member emails in inspector" },
  { code: "workspace.impersonate.read",  description: "Read-only browse as workspace member" },
  { code: "workspace.transfer.ownership",description: "Reassign Workspace.ownerUserId" },
  { code: "workspace.suspend",           description: "Set Workspace.suspendedAt" },
];
```

## API endpoint'leri

### Yeni

| Method | Path | Auth | Permission | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/admin/workspaces` | Admin session | `workspace.read` | query: `q`, `page`, `pageSize` (max 50) | `{ items: WorkspaceSummary[], total, page }` | 401, 403 |
| GET | `/api/admin/workspaces/[id]` | Admin session | `workspace.read` | — | `WorkspaceDetail` (members emails masked unless `workspace.search.by_email`) | 401, 403, 404 |
| POST | `/api/admin/workspaces/[id]/impersonate-read` | Admin session + step-up | `workspace.impersonate.read` | `{ memberUserId }` | `{ sessionToken, expiresAt }` (15 dk) | 401, 403, 404, 409 (suspended) |
| POST | `/api/admin/workspaces/[id]/transfer-ownership` | Admin session + step-up | `workspace.transfer.ownership` | `{ newOwnerUserId, reason }` | `{ workspace }` + audit ID | 400 (member not active), 403, 404, 409 (owner still active) |
| POST | `/api/admin/workspaces/[id]/reset-member-roles` | Admin session + step-up | `workspace.transfer.ownership` | `{ updates: { memberId, role }[] }` | `{ updated: number }` | 400 (cannot demote sole OWNER), 403 |
| POST | `/api/admin/workspaces/[id]/suspend` | Admin session + step-up | `workspace.suspend` | `{ reason }` | `{ workspace }` | 403, 404, 409 (already suspended) |
| POST | `/api/admin/workspaces/[id]/unsuspend` | Admin session | `workspace.suspend` | — | `{ workspace }` | 403, 404 |

`q` arama: owner email exact match → `workspace.search.by_email` permission'lı admin için aktif. Aksi halde sadece workspace name prefix search (`ILIKE 'q%'`).

### Mevcut endpoint'lere etki

- `apps/admin/src/app/api/providers/route.ts` (382 line): değişmez, sadece nav'a yeni "Workspaces" entry eklenir.
- `apps/web/src/lib/workspace-context.ts` (D13): impersonate session token taşıyorsa `canWrite = false` döner — write helper'lar 403 atar.

## Web (admin app)

### Yeni sayfa/route

- `apps/admin/src/app/(admin)/workspaces/page.tsx` — list + search bar + pagination
- `apps/admin/src/app/(admin)/workspaces/[id]/page.tsx` — server component, fetches detail
- `apps/admin/src/app/(admin)/workspaces/[id]/_components/` — client components
- `apps/admin/src/app/api/admin/workspaces/route.ts` — list endpoint
- `apps/admin/src/app/api/admin/workspaces/[id]/route.ts` — detail
- `apps/admin/src/app/api/admin/workspaces/[id]/impersonate-read/route.ts`
- `apps/admin/src/app/api/admin/workspaces/[id]/transfer-ownership/route.ts`
- `apps/admin/src/app/api/admin/workspaces/[id]/reset-member-roles/route.ts`
- `apps/admin/src/app/api/admin/workspaces/[id]/suspend/route.ts`

### Mevcut sayfalara etki

- `apps/admin/src/app/(admin)/layout.tsx` — sol nav'a "Workspaces" menü öğesi eklenir (between "Providers" ve "Waitlist").
- `apps/admin/src/lib/admin-auth.ts` — yeni permission code'lar tanım listesine eklenir.

### Componentler (file paths)

```
apps/admin/src/app/(admin)/workspaces/_components/
  WorkspaceSearchBar.tsx       // client; debounce 250ms; permission-gated email search hint
  WorkspaceList.tsx            // server-fetched, paginated table
  WorkspaceDetailHeader.tsx    // name, plan badge, suspended badge
  WorkspaceOwnerCard.tsx       // owner block + link to user detail
  WorkspaceMemberTable.tsx     // role + status; OVERFLOW row styled gray (D2)
  WorkspaceEntitlementsPanel.tsx // resolved entitlements from owner sub (D2)
  WorkspaceAddressEventsList.tsx // last 10 AddressChangeEvent (D6 targetType labels)
  WorkspaceSyncAttemptsList.tsx  // last 10 PartnerSyncAttempt (D7 idempotent rows)
  WorkspaceActionsMenu.tsx     // 4 action buttons, permission-gated
  ImpersonateReadDialog.tsx    // shows red banner, opens new tab to /api/web/... with X-Admin-Impersonation header
  TransferOwnershipDialog.tsx  // step-up modal; requires reason text
  SuspendWorkspaceDialog.tsx   // double-confirm + reason
```

### Butonlar / actionlar

- **"Open in user-view (read-only)"** — `ImpersonateReadDialog` → POST impersonate-read → açılan yeni tab'da web app'in tepesi kırmızı banner: "Admin read-only impersonation, expires 14:32".
- **"Transfer ownership"** — sadece owner `suspendedAt != null` ise enabled; sebep textarea zorunlu.
- **"Reset member roles"** — inline edit member table'da; "Save changes" tıklayınca step-up.
- **"Suspend workspace"** — kırmızı buton, double-confirm; suspended workspace detail'de "UNSUSPEND" döner.

## Mobile

N/A — admin web only.

## Admin permissions

| Code | What it gates | Step-up required |
|---|---|---|
| `workspace.read` | List + detail (PII masked) | No |
| `workspace.search.by_email` | Email exact-match search + unmasked email in member list | No |
| `workspace.impersonate.read` | Open read-only impersonation session | **Yes** |
| `workspace.transfer.ownership` | Reassign owner + reset member roles | **Yes** |
| `workspace.suspend` | Set/unset `suspendedAt` | **Yes** (suspend only; unsuspend no) |

Step-up: admin'in mevcut session'ı içinde son 5 dk'da bir step-up challenge geçildi mi kontrolü (`apps/admin/src/lib/admin-auth.ts`'a `requireAdminStepUp(req, { maxAgeSeconds: 300 })` helper eklenir). Yoksa 401 + UI dialog'u step-up modal'ı tetikler.

## Güvenlik

- [x] **Step-up admin auth** — 3 destructive action'da zorunlu (impersonate-read, transfer, suspend).
- [x] **PII redaction** — member email `workspace.search.by_email` yoksa `m***@gmail.com` formatında maskelenir. Address full street **hiçbir admin'e gösterilmez** (sadece "City, Country" özeti). Service `accountNumber` **asla** admin'e gösterilmez (D3 — encrypted at rest, decryption sadece kullanıcı oturumu).
- [x] **Audit log** — her destructive action `AdminAuditLog` row'u yazar:
  ```ts
  {
    adminUserId, permission, targetType: "Workspace",
    targetId: workspaceId,
    action: "impersonate_read" | "transfer_ownership" | "reset_member_roles" | "suspend" | "unsuspend",
    beforeJson: { ownerUserId, members: [...], suspendedAt },
    afterJson: { ownerUserId, members: [...], suspendedAt },
    metadataJson: { reason, ip, userAgent },
    createdAt
  }
  ```
  Impersonate-read action'unda `metadataJson.sessionToken` **hash** olarak saklanır (token plaintext değil).
- [x] **Rate limit** — impersonate-read endpoint admin başına 10/dakika, search endpoint 60/dakika.
- [x] **Permission matris** — yukarıdaki tabloyla 1:1; default rol yeni admin'lere sadece `workspace.read` verir.
- [x] **Two-step confirmation** — suspend ve transfer dialog'larında "type the workspace name to confirm" prompt'u.
- [ ] **Encryption at rest** — `Workspace.suspendedReason` plaintext (free text, PII içermesi beklenmiyor; UI'da uyarı: "do not paste user PII here").
- [x] **GDPR DSAR temas noktası** — workspace suspend, kullanıcının kendi DSAR erase request akışını engellemez; ayrı script çalışır.

## Migration / backward compat

- Prisma migration: `Workspace.suspendedAt`, `suspendedReason`, `suspendedByAdminId` opsiyonel kolonlar (nullable, default NULL) — backward compatible.
- AdminPermission seed: 5 yeni row insert. Mevcut admin rollerine **otomatik atanmaz** — manual grant (Sprint 1 hand-off task).
- `requireAdminStepUp` helper yoksa Sprint 1'in ilk iş kalemi olarak `admin-auth.ts`'a eklenir; mevcut admin login flow değişmez.

## Etkilenen mevcut özellikler

- `apps/web/src/lib/workspace-context.ts` — impersonate session token tanıma (`X-Admin-Impersonation: <jwt>`); helper response'una `isAdminImpersonation: boolean` eklenir; her write helper bunu kontrol edip 403 atar.
- `apps/admin/src/app/(admin)/providers/` — etkilenmez.
- `apps/admin/src/app/(admin)/waitlist/page.tsx` — sol nav style'ında değişiklik yok.

## Test plan

- **Unit**
  - `maskEmail("foo@bar.com") === "f**@bar.com"`
  - Permission gate: `workspace.search.by_email` yoksa endpoint email param'ı ignore eder
  - Suspended workspace'te impersonate-read 409 döner
- **Integration**
  - POST transfer-ownership → `Workspace.ownerUserId` değişir + `AdminAuditLog` yazılır + eski owner `WorkspaceMember.role = ADMIN`'e demote olur (sole-owner kuralı, D5)
  - POST suspend → owner Stripe webhook'tan etkilenmez (subscription canlı, sadece workspace kapalı)
- **E2E**
  - Admin login → workspaces list → search → detail → impersonate-read → yeni tab'da workspace member view → write deneme 403 → tab kapatma → audit log girdisi
- **Manual**
  - Suspended workspace owner mobile'dan login → "Workspace suspended, contact support" ekranı
  - Transfer ownership sonrası yeni owner subscription portal'ında billing email'i değişmeli mi? **Hayır, bu MVP'de manuel.** (open question altında)

## Açık sorular

1. Transfer ownership sonrası **Stripe Customer**'ın email/payment method'ı yeni owner'a otomatik geçmeli mi? MVP'de hayır — admin manuel Stripe Dashboard'dan değiştirir. Faz 2 otomasyon.
2. Suspended workspace'in `AddressChangeEvent` DRAFT'ları ne olacak? Şimdilik: read açık, write kilitli; expire olduğunda normal akış. Belki ayrı "frozen" durumu eklemek gerek.
3. Impersonate-read session token revoke endpoint'i? MVP'de 15 dk expire yeterli; explicit revoke Faz 2.
4. Member email mask formatı (`m***@gmail.com` mı `m***@***.com` mı) — destek ekibi feedback'i ile son hali Sprint 1 sonu belirlenecek.
