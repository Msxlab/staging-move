# CHILD Role

- **Status**: Proposed (Family/Pro launch, Sprint 2)
- **Tier**: Family (CHILD rolü Pro'da da kullanılabilir, ancak primary use case Family)
- **Related decisions**: D5 (sabit 5 rol, JSON permission yok), D3 (field-level visibility), D2 (owner-resolved entitlement), D17 (PERSONAL workspace backfill), D1 (workspace tek root)
- **Related docs**: 01-architecture-decisions.md, 02-workspace-model.md, 03-workspace-member-roles.md, 04-workspace-invitation.md, 06-entitlements-system.md, 18-security-checklist.md, 20-family-plan-definition.md, 23-shared-services.md, 24-family-budget-consolidated.md, 25-family-reminders-consolidated.md, 50-admin-workspace-inspector.md, 63-entitlement-banners-empty-states.md, 67-i18n-tr-en.md

## Amaç

CHILD rolünün **tam tanımı**: ne görür, ne göremez, ne yapar, ne yapamaz; nasıl davet edilir, nasıl MEMBER'a yükseltilir, COPPA / yaş yönlendirmeleri, audit log gereksinimleri, ve hangi web/mobile/server kontrolleri zorunludur. Genel rol matrisi 03'tedir; bu dosya **deep-dive**.

## Kapsam

In scope:
- CHILD rolünün veri görünürlük matrisi (field-level + page-level)
- Permission enforcement noktaları (server route helper + UI gating)
- Davet flow'unda role prefill (CHILD)
- "Turned 18" upgrade akışı (manual OWNER action MVP'de)
- COPPA notları (under-13 desteklenmez, 13-17 simplified parent consent)
- UI badge gösterimi
- Audit log gereksinimleri (rol değişimi, çocuk hesap aktivitesi)
- Etkilenen web ve mobile ekranlar

Out of scope:
- Genel rol matrisi → 03-workspace-member-roles.md
- Shared services model (CHILD'ın assignedUserIds'te olması) → 23-shared-services.md
- Family budget'ta CHILD görüntüsü → 24-family-budget-consolidated.md
- Reminder feed'de CHILD davranışı → 25-family-reminders-consolidated.md
- Workspace invitation token mekaniği → 04-workspace-invitation.md
- Tam KVKK/COPPA legal review (Faz 2 legal counsel) → bu doc engineering-level not içerir
- Parental control sliders (Faz 2)

## User stories

- **Family OWNER (ebeveyn)**: 14 yaşındaki çocuğumu Family workspace'ime davet etmek istiyorum; davet ekranında rol seçici **default CHILD**, açıklama "para görmez, kendi adres ve servislerini görür".
- **CHILD (14 yaş)**: LocateFlow'a login olduğumda kendi adresimi (DORM), bana atanmış Spotify Premium servisini, ve bana yönelik genel hatırlatıcıları görürüm; aile bütçesi ve diğer üyelerin servisleri yok.
- **CHILD**: Workspace üye listesinde anne ve babamı görebilirim ama onların adresini veya servisini açamam (UI'da "Owner only" badge).
- **CHILD**: Settings'te kendi profilim, parolam, bildirim tercihim var; subscription / billing / member invite ekranları **yok**.
- **OWNER**: Çocuğum 18 oldu, onu MEMBER'a yükseltmek istiyorum; /workspace/members'ta CHILD satırının yanındaki "Promote to Member" butonu confirm modal'ı açar.
- **OWNER**: Çocuğumun servis ekleme yetkisini istemiyorum (sadece view) → MVP'de değil, Faz 2 (parental control).
- **Admin (LocateFlow support)**: Workspace inspector'da CHILD üye sayısını ve son aktivite tarihini görebilmek istiyorum.

## Veri modeli

CHILD rolü `WorkspaceMember.role` enum'u içinde sabit. Şema değişikliği yok (rol enum 03'te tanımlanır):

```prisma
// packages/db/prisma/schema.prisma — WorkspaceMember (03'te tanımlanır, referans)
model WorkspaceMember {
  id          String @id @default(cuid()) @db.VarChar(30)
  workspaceId String @db.VarChar(30)
  userId      String @db.VarChar(30)
  role        String @db.VarChar(20) // OWNER | ADMIN | MEMBER | CHILD | VIEW_ONLY
  status      String @db.VarChar(20) // ACTIVE | OVERFLOW | SUSPENDED
  invitedByUserId String? @db.VarChar(30)
  joinedAt    DateTime @default(now())
  ...
}
```

CHILD için ek alan **yok**. Yaş bilgisi `User.dateOfBirth` (mevcut alan veya 21'de eklenecek — TBD) üzerinden türetilir; CHILD rolü "kullanıcı yaşının ne olduğundan bağımsız" bir UI/permission flag'idir (ebeveyn manuel olarak atar). Yaş yalnızca **signup gating** içindir.

### Yeni audit event tipi

```ts
// packages/shared/src/audit-event-types.ts (mevcut)
+ "ROLE_TRANSITION_CHILD_TO_MEMBER"
+ "ROLE_TRANSITION_MEMBER_TO_CHILD"   // nadir ama kayıt altında
+ "CHILD_INVITED"
+ "CHILD_PROMOTED"
```

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/api/workspace/members/[id]/promote` | OWNER step-up | required | `{ targetRole: 'MEMBER' }` | `{ memberId, oldRole, newRole, auditEventId }` | 403 not owner, 400 invalid transition, 404 member |

### Mevcut endpoint'lere etki

Tüm mevcut domain endpoint'leri (services, addresses, budget, reminders) `requireWorkspaceContext` helper'ı (D13) içinde CHILD filtresi uygular. Spesifik etkiler:

- `GET /api/services` → CHILD ise `WHERE serviceId IN (assignedUserIds.contains(userId))`. Detay 23.
- `GET /api/services/[id]` → CHILD değilse normal; CHILD ise:
  - `assignedUserIds` üye değilse 403.
  - Üye ise: `accountNumber` field `accountNumberVisibility==='OWNER_ONLY'` ise `null` döner (D3).
- `GET /api/addresses` → CHILD ise `WHERE userId = caller.userId OR id IN (sharedAddresses for child)`. MVP basitlik: CHILD sadece kendi `userId`'sinin adreslerini görür.
- `GET /api/budget` → CHILD ise 403 + UI'da menü gizli; veya kendi servis cost toplamı için `/api/budget/personal` (yeni alt-endpoint, 24'te netleşir).
- `GET /api/workspace/members` → CHILD görür ama hassas alanlar (email, last login) redacted (sadece displayName + avatar).
- `POST /api/workspace/invitations` → CHILD 403.
- `GET /api/billing/*` → CHILD 403 (UI'da hiç linklemiyoruz).

## Web

### Yeni sayfa/route
- Yeni standalone sayfa **yok**; CHILD mevcut sayfaların kısıtlanmış görünümünü kullanır.

### Mevcut sayfalara etki

| Sayfa | CHILD görür mü? | Nasıl |
|---|---|---|
| `/dashboard` | Evet | Sadeleştirilmiş; bütçe widget'ı yerine "My services" widget'ı |
| `/workspace/members` | Evet, read-only | Üye listesi (displayName + role badge), invite UI yok |
| `/services` | Filtered | Sadece `assignedUserIds.contains(childUserId)` servisler |
| `/services/[id]` | Conditional | Yukarıdaki erişim kuralı |
| `/addresses` | Filtered | Sadece kendi `userId`'sine ait adresler |
| `/budget` | **Hayır (gizli menü)** | Side nav'da gizli; doğrudan URL 403 + redirect /dashboard |
| `/budget?view=family` | **Hayır** | 403 |
| `/reminders` | Filtered | Sadece kendisine target reminder'lar (25) |
| `/settings/subscription` | **Hayır** | 403 + redirect |
| `/settings/profile` | Evet | Kendi profili |
| `/settings/notifications` | Evet | Kendi preference'ları |
| `/billing/*` | **Hayır** | 403 |
| `/admin/*` | **Hayır** (zaten genel) | — |

### Componentler (file paths)
- `apps/web/src/components/workspace/MemberRow.tsx` — `role === 'CHILD'` ise "Child" badge (renk: sky-blue, ikon: 👶 yerine harf etiketi).
- `apps/web/src/components/workspace/RoleBadge.tsx` — yeni component, 5 rol için tutarlı görünüm.
- `apps/web/src/components/services/ServiceFieldGate.tsx` — `accountNumberVisibility==='OWNER_ONLY' && callerRole==='CHILD'` ise "Hidden by owner" placeholder.
- `apps/web/src/lib/role-guard.ts` (yeni) — `requireRoleNot(['CHILD'], context)` server-side helper.
- `apps/web/src/components/layout/Sidebar.tsx` — `if (role === 'CHILD') hide(['budget', 'billing', 'invite'])`.

### Butonlar / actionlar
- /workspace/members'ta CHILD satırının yanında OWNER için "Promote to Member" butonu → confirmation modal (yaş 18+ checkbox + step-up auth) → POST promote endpoint.
- Davet ekranında "Add child" preset → POST /api/workspace/invitations role=CHILD.

## Mobile

### Yeni ekran
- Yok.

### Mevcut ekranlara etki

| Ekran | CHILD davranışı |
|---|---|
| `app/(tabs)/index.tsx` dashboard | Sadeleştirilmiş; "Owner's overview" yerine "My stuff" |
| `app/(tabs)/services.tsx` | Filtered list |
| `app/services/[id].tsx` | Field-level gate |
| `app/budget/*` | Tab/Drawer'dan kaldırılır (role check) |
| `app/notifications/index.tsx` | Filtered (25) |
| `app/settings/index.tsx` | Subscription satırı gizli; Profile + Notifications açık |
| `app/settings/subscription.tsx` | Direct nav: redirect to settings index + toast |
| `app/workspace/members.tsx` | Read-only; invite button gizli |

### Componentler
- `apps/mobile/src/components/RoleBadge.tsx` — paralel web component.
- `apps/mobile/src/components/RoleGate.tsx` — `<RoleGate exclude={['CHILD']}>...</RoleGate>` wrapper.
- `apps/mobile/src/lib/use-workspace-role.ts` — hook, mevcut entitlement context'ten okur.

## Admin

### Yeni sayfa / Yetenekler
- `/admin/workspaces/[id]` workspace inspector'da (50) üye listesi:
  - CHILD üyeler için ayrı badge.
  - "Last activity" sütunu (child accounts için ek farkındalık).
  - Admin "force promote" yetkisi — sadece compliance gerekçesiyle (audit log zorunlu).

## Güvenlik

- [x] **Step-up auth**: CHILD üyenin **kendi** rolünden başka rol değişimine geçişi (CHILD → MEMBER) OWNER step-up ister (D10 pattern). CHILD'ın kendi parola değiştirmesi standart auth.
- [x] **PII redaction**: CHILD'ın çocuk olduğu **diğer üyelerin** UI'sında **gizlenmez** (role badge görünür) — bu özellik; aksine bazı şirket ürünlerinde "child" etiketi gizlidir. Karar: aile-içi şeffaflık yararı > stigma riski; ancak admin tarafında CHILD listesi sadece destek personeli + audit log.
- [x] **Audit log**: Her rol transition (`promote`, `demote`), CHILD davet, CHILD'ın "OWNER_ONLY" alana erişim denemesi (403 → audit), CHILD'ın subscription/billing endpoint'ine erişim denemesi log'lanır. Mevcut `AuditEvent` modeli kullanılır.
- [x] **Rate limit**: CHILD endpoint çağrıları diğer rol limitlerine **ek olarak** kullanıcı başına standart; ek throttle yok.
- [x] **Permission matris**:
  - CHILD read: kendi addresses, kendi services, assignedUserIds.contains(self) services, kendisine targeted reminders, workspace member list (redacted).
  - CHILD write: kendi profile, kendi notification prefs, kendi service notes (eğer assigned), kendi reminder snooze.
  - CHILD blocked: budget endpoints (consolidated), billing, invite, member CRUD, address change wizard, partner hub, admin.
- [x] **Encryption at rest**: `Service.accountNumber` zaten encrypted (`packages/shared/src/encryption.ts`). CHILD görse bile decrypt yetkisi visibility gate ile dururlur; backend decrypt çağrısı yapmadan önce role + visibility kontrolü.
- [x] **GDPR DSAR**: CHILD verisi (kendi addresses + services + reminders) export'a girer. Aile reisi DSAR çekmez — child'ın **kendi** hesabından çekilir. Under-13 reddedilir (signup gating).

### Server-side enforcement (asla client'a güvenme)

Her affected endpoint route handler:

```ts
// apps/web/src/app/api/services/[id]/route.ts
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const ctx = await requireWorkspaceContext(request);  // D13
  const service = await db.service.findUnique({ where: { id: params.id } });
  if (!service || service.workspaceId !== ctx.workspaceId) return notFound();

  if (ctx.memberRole === "CHILD") {
    const assignedIds = JSON.parse(service.assignedUserIds || "[]");
    if (!assignedIds.includes(ctx.userId)) return forbidden();
    // field-level redaction
    if (service.accountNumberVisibility === "OWNER_ONLY") service.accountNumber = null;
    if (service.usernameVisibility === "OWNER_ONLY") service.username = null;
  }
  return NextResponse.json(redactPii(service));
}
```

Bu pattern her CHILD-affected endpoint'te tekrarlanır; `apps/web/src/lib/child-redaction.ts` helper'ı çıkarılır.

## COPPA / yaş notları (engineering-level, legal review pending)

- **Under-13**: Hesap **yaratılamaz**. Signup form'unda doğum tarihi alanı (`/api/auth/register` extension) yaş hesaplar; <13 ise hata mesajı + COPPA gerekçesi.
- **13-17**: Hesap yaratılabilir, ancak workspace owner'ı tarafından **CHILD rolü ile davet edilirse** ebeveyn rızası teyit edilmiş sayılır (MVP simplified). Tam COPPA-compliant verifiable parental consent (kredi kartı doğrulama vs.) Faz 2.
- **18+**: Davet sırasında CHILD prefill önerilmez (UI uyarı: "Adults should use MEMBER role"); ancak OWNER manuel CHILD seçebilir (örneğin yaşlı ebeveyn için "para görmeyen" rol istiyorsa — adlandırma değişir, Faz 2 "VIEW_ONLY" rolü daha uygun olabilir).
- **Privacy policy**: 64 marketing copy ve Privacy Policy sayfası child handling cümlesi içerir (Faz 2'de yasal değiştirme).

## CHILD davet flow

1. OWNER `/workspace/members/invite` sayfasında "Add child" preset seçer.
2. Email + display name girilir; rol dropdown CHILD'a kilitlenir, açıklama: "Para ve diğer üyelerin servislerini göremez".
3. POST `/api/workspace/invitations { email, role: 'CHILD' }` (04'te tanımlı endpoint).
4. Davet email'i çocuğa veya ebeveynin yönlendirdiği email'e gider (template 66).
5. Çocuk kabul edip signup yaparsa yaş alanı zorunlu (>=13).
6. `WorkspaceMember` row'u role=CHILD oluşur.
7. Audit: `CHILD_INVITED` + `CHILD_JOINED`.

## CHILD → MEMBER promote (turned 18)

1. OWNER `/workspace/members` sayfasında CHILD satırının `⋯` menüsünden "Promote to Member" seçer.
2. Confirmation modal:
   - "Are you sure? This member will gain access to:" + list (budget, all services, address change wizard, etc.).
   - "I confirm this member is 18 or older" checkbox.
3. Step-up auth challenge (D10).
4. POST `/api/workspace/members/[id]/promote { targetRole: 'MEMBER' }`.
5. `WorkspaceMember.role` CHILD → MEMBER; audit `CHILD_PROMOTED`.
6. Email notify member + owner.

## UI badge specs

- **CHILD**: "Child" pill, background `bg-sky-100 text-sky-700`, ikon yok (stigma azalt).
- Member listesinde rol sütunu sıralama önceliği: OWNER > ADMIN > MEMBER > CHILD > VIEW_ONLY.

## Migration / backward compat

- Mevcut hiçbir kullanıcı CHILD rolüne **default** olarak atanmaz. Tüm migrate edilmiş User'lar D17 gereği kendi PERSONAL workspace'lerinde OWNER.
- 5 rol'lü enum şemada zaten olduğu için (03'te tanımlanır), backward compat sorunu yok; client-side rol bilmediği durumda fallback "MEMBER" davranışı **YANLIŞ** olur → API'lar her zaman explicit role döner ve client validasyon yapar.
- Eski mobile sürümleri CHILD rolünü tanımıyorsa: enum mismatch durumunda en kısıtlı rol davranışını **default**'a sokar (`apps/mobile/src/lib/role-guard.ts` içinde `const role = isKnownRole(api.role) ? api.role : 'VIEW_ONLY'`).

## Etkilenen mevcut özellikler

- **`apps/web/src/app/api/services/*`**: CHILD filtresi (yukarıda örnek).
- **`apps/web/src/app/api/addresses/*`**: CHILD `userId=self` filtresi.
- **`apps/web/src/app/api/budget/*`**: CHILD 403 / personal sub-endpoint.
- **`apps/web/src/app/api/reminders/*`** veya **notifications**: CHILD filter (25).
- **`apps/web/src/components/layout/Sidebar.tsx`** + mobile equivalent: rol-bazlı menü.
- **`packages/shared/src/audit-event-types.ts`**: yeni event isimleri.
- **`apps/web/src/app/api/workspace/members/*`**: redacted member list for CHILD.
- **i18n strings (67)**: CHILD badge label, promote modal copy, "Hidden by owner" placeholder.

## Test plan

### Unit
- `requireWorkspaceContext` returns `memberRole='CHILD'` correctly from DB mock.
- `child-redaction.ts` helper: `accountNumber` null when OWNER_ONLY, kept when WORKSPACE.
- Role transition validator: CHILD → MEMBER allowed, CHILD → OWNER blocked (only OWNER transfer via dedicated flow).

### Integration
- `GET /api/services` as CHILD: returns only assigned services.
- `GET /api/services/[id]` as CHILD not in assignedUserIds: 403.
- `GET /api/budget` as CHILD: 403.
- `POST /api/workspace/invitations` as CHILD: 403.
- `POST /api/workspace/members/[id]/promote` as OWNER without step-up: 401 step-up required.
- `POST /api/workspace/members/[id]/promote` as MEMBER: 403.

### E2E (Playwright)
- Sign in as CHILD test user → sidebar lacks Budget/Billing/Invite items.
- Navigate directly to `/budget` → redirected to `/dashboard` with toast.
- View shared service: account number masked.
- View own service: full data.

### Manual QA
- iOS + Android CHILD UX: settings, services tab, notifications.
- Promote flow with real step-up (password + MFA combo).
- Audit log inspection in admin: CHILD events visible.

## Açık sorular

- [ ] CHILD rolü Pro tier'da da kullanılabilir mi? — Evet (limit izin verdiği sürece), ancak persona Family. Pricing page (61) CHILD sadece Family sütununda vurgu.
- [ ] CHILD'ın kendi adres ekleme yetkisi olmalı mı (DORM tipi)? — MVP **evet** (kendi adresi olarak), edit/delete kısıtlı: sadece kendi yarattığı kayıtlar.
- [ ] CHILD'ın "Add service" yetkisi var mı? — MVP **evet**, sadece kendisi assigned olarak (paidBy null). Konu 23'te detay.
- [ ] CHILD üye sayısı total cap'e (6) sayılır mı? — Evet, 5 ek slot'un içinde.
- [ ] Faz 2 parental control: çocuğun service add/edit yetkisini OWNER toggle ile kapatma — şimdilik scope dışı.
- [ ] CHILD'ın push notification (mobil) cihaz ayarı için ebeveyn rızası gerekir mi? — Apple/Google guideline kontrolü Faz 2.
- [ ] CHILD audit log'a "child of (parent userId)" cross-link gerekli mi? — Tartışılır; mevcut WorkspaceMember.invitedByUserId zaten bağlantı kuruyor, ekstra alan gereksiz.
