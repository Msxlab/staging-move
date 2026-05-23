# Workspace Invitation

- **Status**: Proposed (Family/Pro launch, Sprint 2)
- **Tier**: Infrastructure
- **Related decisions**: D9 (ayrı tablo, token hashed), D2 (seat overflow → invite kilidi), D5 (rol sabit set), D11 (mobile davet kabul OK, satış değil)
- **Related docs**: 02-workspace-model.md, 03-workspace-member-roles.md, 05-workspace-switcher-ui.md, 06-entitlements-system.md, 09-existing-user-migration.md, 66-email-templates.md, 67-i18n-tr-en.md

## Amaç

Workspace OWNER/ADMIN'in yeni üye davet etmesini sağlayan token-tabanlı magic-link akışı. D9 gereği davet, `WorkspaceMember` tablosunda `status=INVITED` ile değil, ayrı `WorkspaceInvitation` tablosunda yaşar; token plaintext sadece email'de gönderilir, DB'de `sha256` saklanır (password reset paterni).

Bu doc tabloyu, akışı (gönder → email → tıkla → signup/login → accept), endpoint'leri, web ve mobile deep-link entegrasyonunu ve spam/abuse korumalarını tarifler.

## Kapsam

In scope:
- `WorkspaceInvitation` Prisma modeli + token hash + indexler
- Davet gönderme akışı (mevcut email kullanıcı + yeni signup gerektiren email)
- Magic link URL format ve token doğrulama
- Kabul: logged-in / new-user iki yolu
- API endpoint'leri: create, list, revoke, get-by-token, accept
- Web: invite modal, accept landing page, "join workspace" CTA
- Mobile: deep-link route, in-app accept
- Email template referansı (66)
- Rate limit + abuse prevention (D9 + D2 seat overflow gate)
- Süresi dolmuş, revoke edilmiş, çakışan davet handling

Out of scope:
- Email gönderim altyapısı (mevcut `packages/shared/src/email/*` kullanılır)
- Rol policy detayları → 03
- Seat overflow + grace mantığı → 06
- Onboarding ekranları (yeni signup sonrası) → mevcut onboarding flow, marginal değişiklik
- SCIM/SSO bulk invite → Pro Faz 3

## User stories

- **OWNER**: Eşimi `eslerim@gmail.com` MEMBER rolüyle davet etmek istiyorum; bir email gönderilir, link tıklayınca workspace'ime katılır.
- **ADMIN (Pro)**: Yeni kiracımı VIEW_ONLY olarak davet edip emlak takvimini görmesini sağlamak istiyorum; davet 7 gün geçerli, gelmezse iptal edebilirim.
- **Davet edilen yeni kullanıcı**: Email'deki link'i tıkladım, hesabım yok; signup + otomatik invite kabul tek akışta tamamlanır.
- **Davet edilen mevcut kullanıcı**: Email link tıkladım, login'im. Tek tık ile workspace'e katılırım, header chip'imde yeni workspace görünür.
- **OWNER**: Yanlış email girdiysem davet'i revoke etmek istiyorum; revoke sonrası token bir daha çalışmaz.
- **OWNER (Pro→Family downgrade)**: Seat overflow durumundayım; yeni davet butonu disabled + "Free up a seat to invite" hint görürüm.

## Veri modeli

```prisma
enum WorkspaceInvitationStatus {
  PENDING
  ACCEPTED
  REVOKED
  EXPIRED
}

model WorkspaceInvitation {
  id          String    @id @default(cuid()) @db.VarChar(30)
  workspaceId String    @db.VarChar(30)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  invitedEmail String        @db.VarChar(191)        // lowercased + trimmed
  role         WorkspaceRole @default(MEMBER)         // 03 — OWNER asla davet edilemez
  invitedByUserId String     @db.VarChar(30)
  invitedBy       User       @relation("InvitationInviter", fields: [invitedByUserId], references: [id], onDelete: Restrict)

  // sha256(token). Plaintext sadece email'de gönderilir, DB'de TUTULMAZ.
  tokenHash    String  @unique @db.VarChar(64)
  // Davet ekranındaki "last 4" gösterim için non-sensitive snippet.
  tokenLast4   String  @db.VarChar(8)

  status     WorkspaceInvitationStatus @default(PENDING)
  expiresAt  DateTime
  acceptedAt DateTime?
  acceptedByUserId String?  @db.VarChar(30)
  acceptedBy       User?    @relation("InvitationAcceptor", fields: [acceptedByUserId], references: [id], onDelete: SetNull)
  revokedAt        DateTime?
  revokedByUserId  String?  @db.VarChar(30)

  // i18n: davet edenin tercih ettiği dil; email rendering bunu kullanır.
  locale String? @db.VarChar(10)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Aynı email için aynı workspace'te aynı expiresAt'te tekrarlı satır oluşmasın.
  // (Aynı email tekrar davet edilebilir AMA bir önceki PENDING revoke veya expire olduktan sonra.)
  @@unique([workspaceId, invitedEmail, expiresAt])
  @@index([workspaceId, status])
  @@index([invitedEmail, status])
  @@index([expiresAt])
}
```

### Token format

- 32 bayt cryptographically secure random → `crypto.randomBytes(32)`
- base64url encode → 43 karakter
- Prefix `wsi_` (workspace invitation) → final form `wsi_<43chars>` (47 karakter toplam)
- Plaintext **sadece**:
  - Email body
  - `WorkspaceInvitation.create()` dönen object'te (controller cevabını yazarken kullanır, sonra silinir)
- DB: `tokenHash = sha256(plaintext)` (Node `crypto.createHash('sha256')`)
- `tokenLast4 = plaintext.slice(-4)` (UI'da "Token ending in `xyz9`" göstermek için, audit/destek)

### Mevcut tablolara etki

```prisma
model User {
  ...
+  sentInvitations     WorkspaceInvitation[] @relation("InvitationInviter")
+  acceptedInvitations WorkspaceInvitation[] @relation("InvitationAcceptor")
}
```

## Davet akışı

```
1. OWNER/ADMIN web /workspace/members'da "Invite" tıklar
   → InviteModal: email + role select
2. POST /api/workspaces/:id/invitations
   - Permission check (03)
   - Seat check (06 entitlements — Family max 6, Pro max 10)
   - Rate limit (5 davet / workspace / saat)
   - Yeni token üret, hash sakla
   - WorkspaceInvitation INSERT (status=PENDING, expiresAt=now+7d)
   - sendInvitationEmail(plaintextToken, ...) — 66
   - Response: { id, invitedEmail, tokenLast4, expiresAt, role }
3. Davet edilen kullanıcı email'i alır
   - Subject: "<InviterName> invited you to <WorkspaceName> on LocateFlow"
   - CTA: "Accept invitation" → https://locateflow.app/workspace/invite/wsi_XXXX
4. Tıklar → /workspace/invite/[token]
   - Token validate (GET /api/invitations/:token)
   - Eğer logged-in:
     a) email session.user.email ile eşleşirse → "Join workspace" butonu
     b) eşleşmezse → "Sign out & accept with <invitedEmail>" uyarı
   - Eğer logged-out:
     a) Hesap varsa → /auth/login?next=/workspace/invite/[token]
     b) Hesap yoksa → /auth/signup?invite=<token>&email=<invitedEmail>
        - signup formunda email read-only, prefill
        - signup tamamlanınca aynı transaction'da accept çağrılır
5. POST /api/invitations/:token/accept
   - Token hash match, status=PENDING, expiresAt > now
   - Caller user.email === invitation.invitedEmail (case-insensitive)
   - Workspace soft-deleted değil
   - Seat hâlâ uygun (yarış durumu için)
   - WorkspaceMember INSERT (role from invitation, status=ACTIVE)
   - WorkspaceInvitation UPDATE (status=ACCEPTED, acceptedAt, acceptedByUserId)
   - Audit log: WORKSPACE_MEMBER_JOINED + WORKSPACE_INVITATION_ACCEPTED
   - Response: { workspaceId, memberId, role }
6. Frontend → /workspace/:id'ye redirect, switcher chip yeni workspace'e set, success toast
```

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/api/workspaces/:id/invitations` | session, role in [OWNER, ADMIN] | yes | `{email, role}` | `{id, invitedEmail, role, expiresAt, tokenLast4}` | 401, 403, 409 (seat full / dup pending), 422 (email/role), 429 (rate limit) |
| GET | `/api/workspaces/:id/invitations` | session, role in [OWNER, ADMIN] | yes | — | `[{id, email, role, status, expiresAt, invitedByUserId, tokenLast4}]` | 401, 403, 404 |
| DELETE | `/api/workspaces/:id/invitations/:invId` | session, role in [OWNER, ADMIN] | yes | — | `204` | 401, 403, 404, 409 (already accepted) |
| GET | `/api/invitations/:token` | optional session | none | — | `{workspaceName, invitedEmail, role, inviterName, expiresAt, requiresSignup: boolean}` | 404 (token invalid/expired), 410 (revoked) |
| POST | `/api/invitations/:token/accept` | session required | none | — | `{workspaceId, memberId, role}` | 401, 403 (email mismatch), 404, 409 (seat full now), 410 (revoked/expired) |

### Mevcut endpoint'lere etki

- `/api/auth/signup` → opsiyonel `inviteToken` query/body parametresi; signup commit edildikten sonra invite accept aynı transaction'ın devamında çağrılır (signup başarısızsa invite tüketilmez).
- `/api/me` → `pendingInvitations: [{...}]` opsiyonel alan (kullanıcının kendi email'i ile gelmiş davetler — dashboard banner için).

## Web

### Yeni sayfa/route

- `/workspace/invite/[token]/page.tsx` → Landing:
  - Token validate, workspace adı + inviter + role + plan badge gösterir
  - Logged-in + email match → big "Join workspace" button
  - Logged-in + mismatch → "You're signed in as X, but this invite is for Y. [Sign out and continue]"
  - Logged-out + existing user → "Sign in to accept"
  - Logged-out + new user → "Create an account to accept" (signup form embedded veya redirect)
  - Token expired → "This invitation expired. Ask the workspace owner to send a new one."
  - Revoked → "This invitation was revoked."

### Mevcut sayfalara etki

- `/(app)/workspace/members` → "Invite member" CTA + bekleyen davetler section (status=PENDING listesi, revoke butonu).
- `/(app)/dashboard` → eğer `pendingInvitations.length > 0` ise tepe banner: "You have N pending workspace invitations" → modal liste.
- `/auth/signup` → `?invite=` query param ile geldiyse email read-only + üst banner "Accepting invitation to <WorkspaceName>".

### Componentler

- `InviteModal` (`apps/web/src/components/workspace/InviteModal.tsx`) — email + role dropdown + submit.
- `PendingInvitationsTable` (`apps/web/src/components/workspace/PendingInvitationsTable.tsx`) — workspace members sayfasındaki ek section.
- `InviteAcceptCard` (`apps/web/src/components/workspace/InviteAcceptCard.tsx`) — landing page'in merkez kartı.
- `PendingInvitationsBanner` (`apps/web/src/components/dashboard/PendingInvitationsBanner.tsx`) — dashboard tepe banner.

### Butonlar / actionlar

- "Invite member" (members page) → açar `<InviteModal />`.
- "Send invitation" (modal submit) → `POST /api/workspaces/:id/invitations`.
- "Revoke" (pending list satırı) → confirm → `DELETE /api/workspaces/:id/invitations/:invId`.
- "Join workspace" (landing) → `POST /api/invitations/:token/accept`.
- "Resend invitation" (pending list, expired/near-expire için) → revoke + create yeni davet (atomic action).

## Mobile

### Yeni ekran

- `apps/mobile/app/(public)/invite/[token].tsx` → Deep-link route (universal/App Link). Token validate + accept akışı.
  - Logged-in + match → Join → success → in-app navigation to workspace
  - Logged-out → push to /auth/login veya /auth/signup with invite param

### Deep-link config

- iOS: `applinks:locateflow.app` zaten konfigüre. Path `/workspace/invite/*` route'lanır.
- Android: `assetlinks.json` aynı path için aktif.
- Mevcut `apps/mobile/app.config.ts` `associatedDomains` ve `intentFilters`'a path eklenir.

### Mevcut ekranlara etki

- `apps/mobile/app/(app)/workspace/members.tsx` → "Invite" CTA OWNER/ADMIN için aktif (mobile davet gönderebilir — D11 mobile read-only yalnız **billing**, üye yönetimi açık).
- `apps/mobile/app/(public)/auth/signup.tsx` → invite query param ile geldiyse email prefilled + read-only.

### Componentler

- `InviteSheet` (`apps/mobile/components/workspace/InviteSheet.tsx`) — bottom sheet, email + role.
- `InviteAcceptScreen` (`apps/mobile/components/workspace/InviteAcceptScreen.tsx`).

## Admin

### Yeni sayfa

Workspace inspector (50) altında "Invitations" tab:
- `apps/admin/src/app/workspaces/[id]/invitations/page.tsx` — tüm geçmiş davetler (pending/accepted/expired/revoked), filter by status.

### Yetenekler

- Admin **token plaintext'i göremez** (yalnız `tokenLast4`).
- Admin davet **revoke edebilir** (destek senaryosu, audit zorunlu).
- Admin davet **yaratamaz** (her zaman workspace OWNER/ADMIN'i kullanır; destek talimatı verir).
- Admin nightly cron: status=PENDING + expiresAt < now → status=EXPIRED.

## Güvenlik

- [x] **Step-up auth**: Davet gönderme için **gerekmez** (D10 step-up sadece AddressChangeEvent). Davet kabul için **gerekmez** (zaten session login'in kendisi auth proof).
- [x] **PII redaction**: Email davet listesinde tam görünür sadece OWNER/ADMIN'e. MEMBER/CHILD davet listesini görmez (zaten 03 matrisinde davet yetkisi yok).
- [x] **Audit log**: `WORKSPACE_INVITATION_CREATED` (actor, target email hash, role), `WORKSPACE_INVITATION_ACCEPTED`, `WORKSPACE_INVITATION_REVOKED`, `WORKSPACE_INVITATION_EXPIRED` (cron). Plaintext email değil hash + last4.
- [x] **Rate limit**:
  - 5 davet / workspace / saat (mevcut `RateLimitLog` tablosu)
  - 10 davet / workspace / gün (email spam koruması)
  - 3 davet aynı email'e / 24 saat
  - `/api/invitations/:token/accept` 5 deneme / IP / saat (token bruteforce ek koruma; token zaten 256-bit entropi)
- [x] **Permission matris**: 03'te tanımlı. Davet **gönderme**: OWNER/ADMIN. Davet **kabul**: invited email sahibi user. **Liste**: OWNER/ADMIN. **Revoke**: OWNER/ADMIN.
- [x] **Encryption at rest**: Token sadece hash; plaintext disk'e yazılmaz. Email gönderildikten sonra in-memory plaintext dropped.
- [x] **GDPR DSAR + erase**: Kullanıcı DSAR'ı kendi gönderdiği + aldığı davet listesini içerir (email metadata). Erase: davetler keep ama `invitedByUserId/acceptedByUserId` NULL'a düşürülür (`SetNull` FK), `invitedEmail` hash'lenir.
- [x] **Spam prevention**:
  - `@@unique([workspaceId, invitedEmail, expiresAt])` — aynı email'e aynı sürede aynı workspace'ten ikinci PENDING yaratılamaz
  - PENDING varken yeni davet → 409, "Existing invitation expires <date>. Revoke first or resend."
  - Davet edilen email mevcut ACTIVE member ise 409, "Already a member"
- [x] **Token security**: 256-bit random, sha256 hash, plaintext sadece email; URL https-only; Referer-Policy: same-origin email link landing'inde.

## Migration / backward compat

- DB migration: `add_workspace_invitation_table` + enum.
- Backfill: yok (yeni feature, başlangıçta boş).
- Dual-read: N/A.
- Rollback: Feature flag `INVITATIONS_ENABLED=false` → invite modal hide, accept endpoint 503. Tablo kalır.

## Etkilenen mevcut özellikler

- Signup flow (`/api/auth/signup` + `/auth/signup` page) — invite param desteği
- Email templates (66 — yeni `workspace-invitation` template)
- `/api/me` shape (pendingInvitations)
- Dashboard banner sistemi
- Mobile deep-link routing

## Test plan

- **Unit**:
  - Token generator: 32 byte, base64url, prefix, last4 doğru
  - Hash karşılaştırma timing-safe (`crypto.timingSafeEqual`)
  - Email lowercase + trim normalization
  - Expiry calc (7 day default)
- **Integration**:
  - Create invitation → row var, email gönderildi (mock), response token'ı içerir
  - Accept logged-in + email match → member yaratıldı
  - Accept logged-in + email mismatch → 403
  - Accept expired token → 410
  - Accept revoked token → 410
  - Accept while seat overflow → 409
  - Duplicate pending invitation → 409
  - Rate limit aşımı → 429
  - Revoke after acceptance → 409
- **E2E (Playwright)**:
  - Full flow: OWNER invite → email simulator → invited user signup → workspace'te member görünür
  - Existing user akışı (login + accept)
  - Revoke akışı (OWNER UI'da delete → invited user link tıklar → "revoked" message)
- **Manual QA**:
  - Mobile deep-link cold start (uygulama kapalı iken link tıkla → /invite/[token]'a açılır)
  - Email rendering (TR + EN, RTL planlanmıyor)
  - Token URL paylaşımı: aynı token iki sekme tıklanırsa idempotent mi? (PENDING → ACCEPTED transition uniqueness'i nasıl handle ediyor?)

## Açık sorular

- **AÇIK**: Davet edilen email henüz LocateFlow user değilse ama bir başkasının PENDING password reset'i varsa, token collision yaratma riski? (yok — farklı tablo, farklı prefix)
- **AÇIK**: Davet edilen email **soft-deleted** User ise: signup tekrar mı (yeni user ID), yoksa restore mu? (öneri: signup tekrar → yeni user; soft-deleted user'a tekrar invite akışı kuralları legal review)
- **AÇIK**: Email değişiklik akışı yok şu an — davet edilen email ile signup sonrası kullanıcı email'ini değiştirirse member kaydı etkilenmez. Bu doc'ta sorun değil ama 03'te belirtilmeli.
- **AÇIK**: "Resend" gerçekten yeni token mi (öneri: evet, eskisini revoke + yeni yarat), yoksa aynı tokenın expiresAt'ini uzatmak mı? (öneri: yeni token — eskisinin email'i sızmış olabilir).
- **AÇIK**: Multi-tenant rate limit shared mi (workspace başına) yoksa global mi (inviter user başına)? Şu an workspace başına; eğer bir kötü niyetli OWNER çok workspace yaratırsa abuse mümkün — globalde user başına ikinci limit eklenmeli mi?
- **AÇIK**: i18n — davet email'i invited user'ın diline mi yoksa inviter'ın diline mi gider? Öneri: invited user mevcut user ise tercih dili, değilse inviter dili. 67'de finalize.
