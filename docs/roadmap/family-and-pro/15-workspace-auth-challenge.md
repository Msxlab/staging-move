# Workspace Auth Challenge Model

- **Status**: Proposed (Family/Pro launch, Sprint 2)
- **Tier**: Infrastructure
- **Related decisions**: D10, D19
- **Related docs**: [11](./11-address-change-event-model.md), [16](./16-step-up-auth-flow.md), [18](./18-security-checklist.md)

## Amaç

Step-up authentication için kısa-ömürlü, tek-kullanımlık challenge token tablosu. Kullanıcı hassas bir işlem başlatmak istediğinde (yeni `AddressChangeEvent`, üye silme, workspace silme, billing değişikliği) önce bir challenge yaratılır, kullanıcı password/TOTP/email OTP ile doğrular, doğrulanmış challenge id ilgili mutation endpoint'ine geçer. Endpoint id'yi consume eder ve aksiyon idempotent olarak tek bir challenge'a bağlanır.

Amacı ATO senaryosunda saldırganın session hijack'i ile tek tıkla hasar yapmasını engellemek. Per-event single challenge (D19) — UX katili olmasın diye event içindeki sonraki action'lar ek auth istemez.

## Kapsam

**In scope**
- `WorkspaceAuthChallenge` Prisma modeli
- Tek-kullanım, expire, attempt limit semantik
- Replay prevention
- Audit log entry kuralları

**Out of scope**
- Challenge create/verify endpoint'leri (→ 16)
- UI components (→ 16)
- Per-purpose flow detayı (→ 16)

## User stories

- **As a security engineer**: Bir challenge ya consume edilir ya expire eder; yeniden kullanılamaz. Hash log'da plaintext yok.
- **As an Owner**: 10 dakika içinde event yaratmazsam yeniden challenge istemem gerekir.
- **As an auditor**: Hangi challenge hangi action için consume edildi rapor çıkarabilirim.

## Veri modeli

```prisma
enum AuthChallengePurpose {
  ADDRESS_CHANGE        // POST /api/address-changes
  MEMBER_REMOVE         // DELETE /api/workspaces/:id/members/:userId
  WORKSPACE_DELETE      // DELETE /api/workspaces/:id
  BILLING_CHANGE        // POST /api/billing/checkout, cancel sub, plan change
  // Faz 2: SERVICE_BULK_DELETE, EXPORT_PII
}

enum AuthChallengeMethod {
  PASSWORD
  TOTP            // user.mfaEnabled
  EMAIL_OTP       // OAuth-only fallback
  MFA_SMS         // future; not used MVP unless user has SMS MFA
}

model WorkspaceAuthChallenge {
  id          String  @id @default(cuid()) @db.VarChar(30)
  userId      String  @db.VarChar(30)
  user        User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  workspaceId String  @db.VarChar(30)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  purpose         AuthChallengePurpose
  challengeMethod AuthChallengeMethod

  // For EMAIL_OTP only: hashed 6-digit code (bcrypt or sha256+pepper)
  // For PASSWORD/TOTP: NULL (verification compares against user.passwordHash / user.mfaSecret)
  challengeHash   String? @db.VarChar(255)

  attemptsUsed Int @default(0)
  maxAttempts  Int @default(5)

  expiresAt    DateTime  // default 10 min from creation
  consumedAt   DateTime?
  consumedForActionId String? @db.VarChar(30)  // event.id, workspace.id, etc. — set on consume

  createdAt DateTime @default(now())
  ipAddress String? @db.VarChar(45)
  userAgent String? @db.VarChar(500)

  @@index([userId, purpose, consumedAt])
  @@index([userId, createdAt])           // rate limit query
  @@index([expiresAt])                   // cleanup cron
}
```

**FK kararları**:
- `userId` cascade — user silinirse challenge silinir (mantıklı, kimseye yarar)
- `workspaceId` cascade — workspace silinirse silinir
- `consumedForActionId` **FK yok** — purpose'a göre farklı table'a işaret eder; ham string. Cross-check service layer'da.

**Migration**: `20260601_workspace_auth_challenge.sql` — enum'lar + tablo. Mevcut user/workspace verisi etkilenmez.

## Tek-kullanım enforcement

Verify endpoint (→ 16):
1. `SELECT FOR UPDATE` ile challenge row'u kilitle
2. `consumedAt IS NULL` ve `expiresAt > now()` kontrol; değilse 410 Gone
3. `attemptsUsed >= maxAttempts` ise 429 + challenge invalidate (`consumedAt = now(), consumedForActionId = '__invalidated__'`)
4. Method'a göre code/password compare
5. Başarısız: `attemptsUsed += 1`; başarılı: `consumedAt = now()`, döndür ok
6. Consume endpoint (action POST'unun içinde): `consumedForActionId` zaten set ise (yarış koşulu) 409; değilse set + commit

Bu sayede aynı challenge iki ayrı `AddressChangeEvent`'e bağlanamaz. Yarış sebebi event creation içinde tek transaction'da challenge consume + event insert atomic yapılır.

## Replay prevention

- Challenge id sadece HTTPS body'sinde, header'da değil (cache log'lara düşmesin).
- Action POST'unda `consumedForActionId IS NULL` kontrol; race için transaction.
- Audit log challenge consume timestamp + ip + ua + actionId.
- Session token expire / logout sonrası challenge kullanılabilir mi? **Hayır** — verify endpoint authenticated session zorunlu (consumeForActionId set'inde de session zorunlu).

## Audit log

`AuditLog` tablosuna 3 event:

| Action | When | Changes JSON |
|---|---|---|
| `auth_challenge_create` | challenge yaratılır | `{ purpose, method, expiresAt }` |
| `auth_challenge_verify_success` | doğru kod girildi | `{ challengeId, attemptsUsed }` |
| `auth_challenge_verify_fail` | yanlış kod | `{ challengeId, attemptsUsed, reason: 'INVALID' \| 'EXPIRED' \| 'MAX_ATTEMPTS' }` |
| `auth_challenge_consume` | mutation endpoint'inde bağlandı | `{ challengeId, actionId, actionType }` |

EntityType: `WorkspaceAuthChallenge`. EntityId: challenge.id. IP/UA challenge row'undan kopyalanır.

## API endpoint'leri

Bu doc model + audit only. Endpoint'ler 16'da.

## Web / Mobile / Admin

UI ve flow 16'da. Admin tarafında:

### Admin — Yeni sayfa

- `/admin/auth-challenges` — filter by userId, purpose, status (consumed/expired/active/invalidated). Read-only. Destek: "Bu kullanıcı 5 başarısız challenge çevirdi mi?" sorusunu cevaplar.

### Yetenekler

- Read-only. Manual invalidate buton (force consumedAt = now, consumedForActionId = '__admin_invalidate__'). AdminAuditLog'a yazar.

## Güvenlik

- [x] **Step-up auth**: Bu **tablonun kendisi** step-up auth mekanizması. Yaratma endpoint'i normal session ile çağrılır.
- [x] **PII redaction**: `challengeHash` plaintext OTP içermez (bcrypt veya sha256). IP/UA standart redaction kuralları (log'larda IP son oktet maskelenir? — proje genelinde karar; mevcut audit pattern'i ile uyumlu).
- [x] **Audit log**: Yukarıda 4 action.
- [x] **Rate limit**:
  - Challenge create: 10/saat per user per purpose
  - Verify attempts: row başına maxAttempts = 5
  - Verify endpoint global: 30/dakika per IP (brute force karşı)
- [x] **Permission matris**: Bir user kendi challenge'ı dışında hiçbirine erişemez. Admin tablo erişimi audit'li.
- [x] **Encryption at rest**: `challengeHash` zaten hash. mfaSecret comparison için decrypt mevcut MFA helper'ı (`apps/web/src/lib/auth.ts` veya benzer) kullanır.
- [x] **GDPR DSAR**: User erase'de cascade ile silinir. Eski action'lara `consumedForActionId` ham id kaldığı için soft reference (FK yok), action silinmiş olabilir; bu OK.

### Cleanup cron

- Daily cron: `DELETE FROM WorkspaceAuthChallenge WHERE expiresAt < NOW() - INTERVAL '30 days'` — eski expired rows temizlik. Consumed rows da 30 gün sonra silinebilir (audit log zaten var).
- Cron file: `apps/web/src/app/api/cron/cleanup-auth-challenges/route.ts`. Cron-guard ile korunmuş.

## Migration / backward compat

- Yeni tablo, mevcut data etkilenmez.
- Feature flag yok — challenge mekanizması açık olmalı (yoksa step-up çalışmaz).

## Etkilenen mevcut özellikler

- `User` modeline `authChallenges WorkspaceAuthChallenge[]` relation.
- `Workspace` modeline `authChallenges WorkspaceAuthChallenge[]` relation.
- `apps/web/src/lib/audit.ts` — yeni action constants.

## Test plan

**Unit**
- Expire kontrol: expiresAt < now → verify 410
- Max attempts: 5. yanlış → invalidate
- Hash compare: bcrypt true match
- Consume idempotency: ikinci consume aynı id → 409
- Cleanup cron query: 30+ gün eski deleted

**Integration**
- Create challenge → verify with correct OTP → consume in event POST → second consume attempt fails
- Create challenge → verify wrong 5 times → invalidate; 6. attempt 410
- Create challenge → 11 dakika bekle → verify 410 expired
- Concurrent verify race: 2 paralel verify request → 1 success 1 conflict (SELECT FOR UPDATE assertion)

**E2E**
- Address change wizard submit: challenge create + verify modal + consume → event yaratılır
- Wrong password 5x → modal "Too many attempts" + yeni challenge gerekli
- Challenge expire mid-flow → "Session expired, try again" + new challenge

**Manual**
- Admin destek case: "kullanıcı challenge'ı invalidate et" — admin panel buton

## Açık sorular

1. EMAIL_OTP code uzunluğu 6 mı 8 mi? **Karar önerisi**: 6 (UX standardı).
2. Email OTP rate limit per hour: 3 challenge mi 5 mi? **Karar önerisi**: 3 (D10'a uyumlu, → 16'da detay).
3. Cleanup süresi 30 gün mü 90 gün mü? **Karar önerisi**: 30 gün; audit log zaten history tutar.
4. IP fingerprint hash field eklensin mi (privacy)? **Karar önerisi**: MVP'de raw IP (audit standardı), Faz 2'de privacy review.
5. MFA_SMS MVP'de aktif mi? **Karar önerisi**: Hayır — SMS MFA kullanıcı User modelinde yoksa method'a izin verme.
