# Partner Claim — Schema + Disabled Admin Placeholder (Faz 2)

- **Status**: **Schema/iskelet only — MVP'de aktif onboarding flow YOK.** Migration uygulanır + admin sayfası "coming soon" placeholder olarak deploy edilir. Hiçbir POST endpoint yok, hiçbir partner-facing form yok.
- **Tier**: Infrastructure (partner-facing onboarding; ürün tier'larını etkilemez)
- **Related decisions**: **D16** (Partner Claim MVP'de iskelet, aktif değil — domain verification + business reg + admin onay ciddi güvenlik iş yükü, lansman blocker olmamalı), D15 (Day 1 = sıfır anlaşma — claim olmadan da partner ekleyebiliyoruz, claim "verified" rozeti için), D8 (paralel Faz 2 hazırlık spec'i)
- **Related docs**: [33](./33-partner-hub-ui.md), [34](./34-service-provider-action-registry.md), [45](./45-partner-consent-skeleton.md), [51](./51-admin-provider-actions-crud.md), [54](./54-admin-partner-claim-queue.md), [18](./18-security-checklist.md)

---

## Amaç

Faz 2'de partner'ların (örn. küçük bir SaaS firması) **kendi LocateFlow profilini claim edip kontrolünü ele alması** için altyapıyı şimdi hazırla. Claim onaylanan partner:
- Kendi action template'lerini önerebilir (admin yine onaylar)
- Logo yükleyebilir
- Request volume istatistiklerini görebilir
- (Faz 3) verified rozet alır

MVP'de bu süreç **disabled**. Admin sayfası "Provider claim queue — coming Q3" placeholder. Partner-facing onboarding form (`/partner-claim`) YOK. Schema migration uygulanır ki Faz 2'de aktivasyon 2–3 günlük iş olsun (D16 gerekçesi).

## Kapsam

**In scope (MVP)**
- `ProviderClaim` tablo migration (yeni tablo, `ServiceProvider`'a kolon eklemek yerine — separation of concerns, claim lifecycle ayrı)
- Admin `apps/admin/.../provider-claims/page.tsx` placeholder sayfası: disabled buton + "Coming Q3" badge + boş tablo
- Cross-ref [54](./54-admin-partner-claim-queue.md) ile koordinasyon (o doc admin queue UI'sının kendisi; bu doc schema ve aktif olmayan iskelet)
- Migration test

**Out of scope (MVP)**
- `/partner-claim` partner-facing form — **YOK**
- Email verification (claimantEmail confirmation) — **YOK**
- DNS TXT verification cron — **YOK**
- Business registration upload (file upload) — **YOK**
- Admin review/approve/reject endpoint'leri — **YOK** (placeholder buton disabled)
- "Verified" rozeti UI'da gösterimi (D15 gereği lansmanda hiçbir partner verified değil) — **YOK**

**Faz 2 scope (intended roadmap)**
- Partner-facing onboarding flow (5 step: email → verify → DNS → business reg → submit)
- Admin two-step approval (review then approve, ayrı tıklar, audit gerektirir)
- Email verification token + DNS TXT polling cron
- "Manage your listing" partner dashboard (logo, copy edit önerisi)
- Verified badge UI

## User stories

**MVP**: Yok — kullanıcı/partner bu feature'ı göremez. Admin sadece disabled placeholder görür.

**Faz 2 (intended)**
- As partner business owner, kendi şirketimin LocateFlow profilini claim edip **logo yükleyebileyim**, profilim "verified" olarak işaretlensin.
- As partner, claim için **email + DNS TXT + business registration** üç-faktör doğrulamadan geçmeliyim.
- As LocateFlow admin, claim queue'da **review → approve** iki ayrı tıkla onaylama yapmalıyım (tek tıkla kaza kabul olmamalı).
- As admin, partner reject edersem **reason field** zorunlu olmalı (audit + partner'a email).
- As user, "verified" rozeti gördüğümde **partner'ın gerçekten o partner olduğunu** anlayabileyim.

## Veri modeli

**Yeni tablo** (cleaner separation of concerns; `ServiceProvider` row'una kalıcı kolon eklemek yerine):

```prisma
model ProviderClaim {
  id                       String   @id @default(cuid()) @db.VarChar(30)

  providerId               String   @db.VarChar(30)
  provider                 ServiceProvider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  claimantEmail            String   @db.VarChar(191)
  // App-level validation: email domain provider.website domain ile eşleşmeli
  // örn. provider.website = "https://example.com" → claimantEmail @example.com olmalı

  claimantName             String   @db.VarChar(120)
  claimantTitle            String?  @db.VarChar(120)
  // "VP of Product", "Founder", vb. — manuel inceleme için context

  domainVerifiedAt         DateTime?
  // DNS TXT record doğrulandığında set edilir
  dnsTxtRecord             String?  @db.VarChar(120)
  // expected pattern: "locateflow-verify=<sha256-hash-of-claimId>"

  emailVerifiedAt          DateTime?
  emailVerificationToken   String?  @db.VarChar(80)
  // hashed (sha256), plaintext sadece email link'inde
  emailVerificationExpiresAt DateTime?

  businessRegistrationRef  String?  @db.VarChar(200)
  // EIN, Companies House no, MERSİS no — free-text user-entered
  // Faz 2'de file upload eklenir; MVP schema sadece reference string

  status                   String   @db.VarChar(20)
  // DRAFT | EMAIL_PENDING | DNS_PENDING | REVIEW | APPROVED | REJECTED

  adminReviewerId          String?  @db.VarChar(30)
  adminReviewer            AdminUser? @relation(fields: [adminReviewerId], references: [id], onDelete: SetNull)
  adminNotes               String?  @db.Text
  rejectionReason          String?  @db.VarChar(200)
  reviewedAt               DateTime?

  approvedAt               DateTime?
  approvedByAdminId        String?  @db.VarChar(30)
  // İkinci admin onayı (two-person rule); approvedByAdminId != adminReviewerId olabilir
  // Faz 2'de two-person rule zorlanır

  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  @@index([providerId, status])
  @@index([status, createdAt])
  @@index([claimantEmail])
}
```

`ServiceProvider` üzerine **minimal** ek:

```prisma
model ServiceProvider {
  // ... mevcut alanlar ...

+ claimedAt          DateTime?
+   // null = unclaimed (Day 1 tüm partner'lar böyle); set = approved ProviderClaim var
+ claimedByClaimId   String? @db.VarChar(30)
+   // FK olmayan reference (claim silinse bile provider'ın "ever claimed" geçmişi kalsın)
+ verifiedBadge      Boolean @default(false)
+   // D15 gereği MVP'de tüm partner'lar false; Faz 2'de approved claim varsa UI logo + verified gösterir
+   // Ayrı kolon çünkü "claimed ama suspend edilmiş" durumu Faz 2'de gerekebilir
}
```

`AdminUser` modeli mevcut (cross-ref schema satır 980+): `auditLogs AdminAuditLog[]` zaten var; back-relation eklenmesine gerek yok (opsiyonel: `providerClaimsReviewed ProviderClaim[]`).

## API endpoint'leri

### Yeni (MVP)

**YOK.** Hiçbir POST/PATCH/DELETE endpoint ship edilmez.

Sadece **disabled admin GET** (placeholder sayfasının çalışması için):

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/admin/api/provider-claims` | admin session | — | — | `{ claims: [], featureEnabled: false, comingSoonMessage: "Q3" }` | 401, 403 |

Bu endpoint **her zaman boş array** döner (henüz claim yaratan endpoint yok). `featureEnabled: false` UI'nın placeholder rendering'i için.

### Yeni (Faz 2 — intended, roadmap)

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/api/partner-claim` (public) | reCAPTCHA + rate limit | — | `{ providerId, claimantEmail, claimantName, claimantTitle }` | `201 { claimId, status:"EMAIL_PENDING" }` | 422, 429 |
| GET | `/api/partner-claim/verify-email?token=...` (public) | token | — | — | `200 redirect to claim continue page` | 400, 410 |
| POST | `/api/partner-claim/:id/dns-check` | claim-session | — | — | `200 { verified: bool }` | 401, 404 |
| POST | `/api/partner-claim/:id/submit` | claim-session | — | `{ businessRegistrationRef }` | `200 { status: "REVIEW" }` | 401, 422 |
| GET | `/admin/api/provider-claims?status=REVIEW` | admin session | — | — | `{ claims: ClaimDto[] }` | 401, 403 |
| POST | `/admin/api/provider-claims/:id/review` | admin session | — | `{ notes }` | `200` (status REVIEW kalır, ilk admin işaretledi) | 401, 403 |
| POST | `/admin/api/provider-claims/:id/approve` | admin session (different from reviewer) | — | — | `200 { status: "APPROVED" }` | 401, 403, 409 (aynı admin) |
| POST | `/admin/api/provider-claims/:id/reject` | admin session | — | `{ rejectionReason }` | `200 { status: "REJECTED" }` | 401, 403, 422 |

### Mevcut endpoint'lere etki

**MVP**: yok — schema'nın eklenmesi mevcut endpoint'leri etkilemez.

**Faz 2**:
- `/api/providers/:id` response'a `claimed: boolean`, `verifiedBadge: boolean` eklenir
- Partner Hub UI verified rozetini çıkarır

## Web

### Yeni sayfa/route

**MVP**: YOK.

**Faz 2 (intended)**
- `/partner-claim?providerId=...` — multi-step form (entry → email verify → DNS → business reg → submit)
- `/partner-claim/check/:claimId` — claim status check (DNS pending vs.)
- Partner dashboard `/partner-portal` (claim approved sonrası giriş)

### Mevcut sayfalara etki

**MVP**: yok.

**Faz 2**: Partner Hub (cross-ref [33](./33-partner-hub-ui.md)) provider card'ında "Claim this listing" link (provider unclaimed ise). Verified badge UI.

### Componentler (file paths — Faz 2)

- `apps/web/src/app/partner-claim/page.tsx`
- `apps/web/src/app/partner-claim/[step]/page.tsx`
- `apps/web/src/components/partner-claim/EmailVerifyStep.tsx`
- `apps/web/src/components/partner-claim/DnsVerifyStep.tsx`
- `apps/web/src/components/partner-claim/BusinessRegStep.tsx`
- `apps/web/src/components/partner-claim/VerifiedBadge.tsx`

### Butonlar / actionlar

**MVP**: YOK.

## Mobile

### Yeni ekran

**MVP**: YOK. **Faz 2**: Partner claim mobile-first değil — web flow yeterli. Mobile sadece verified badge'i görür (display-only).

### Mevcut ekranlara etki

**MVP**: yok.

### Componentler

**MVP**: YOK.

## Admin

### Yeni sayfa / Yetenekler

**MVP**: 
- `apps/admin/src/app/(admin)/provider-claims/page.tsx` — **placeholder sayfa**
  - Header: "Provider Claim Queue"
  - Coming Soon badge (Q3 2026)
  - Disabled "Approve" / "Reject" butonları (visually disabled, click no-op)
  - Boş tablo: "No claims pending. This feature is not yet active."
  - Info banner: "Partner self-onboarding launches in Phase 2. Until then, providers are added manually via Provider CRUD." (cross-ref [51](./51-admin-provider-actions-crud.md))
- Cross-ref [54](./54-admin-partner-claim-queue.md): tam UI tasarımı orada belgelenir; bu doc sadece schema + disabled hint.

**Faz 2 (intended)**
- Full claim queue (filter by status)
- Detail page: claim metadata, DNS check live, business reg ref Google'a link
- Two-step approval flow UI (review → separate approve click)
- Rejection reason zorunlu modal
- AdminAuditLog'a tüm eylemler

### Yetenekler

**MVP**: Sadece görüntüleme (boş tablo). Hiçbir eylem yok.

## Güvenlik

- [x] **Step-up auth?** MVP=N/A. Faz 2: admin approve eylemleri için ek MFA (admin zaten MFA ile login; approve için fresh challenge düşünülmeli).
- [x] **PII redaction?** MVP=N/A. Faz 2: `claimantEmail` admin UI'da görünür ama log'larda son 4 char + domain (`***@example.com`).
- [x] **Audit log?** MVP=N/A (eylem yok). Faz 2: `AdminAuditLog` her review/approve/reject/dns-check eylemine. Two-person rule audit'i: `approvedByAdminId !== adminReviewerId` invariant.
- [x] **Rate limit?** MVP=N/A. Faz 2: `/api/partner-claim` POST 3/saat/IP (kötü niyetli claim spam'i için), 10/gün/email (aynı email farklı provider için ek attempt).
- [x] **Permission matris?** MVP: sadece admin (existing admin auth). Faz 2: admin role'unda yeni permission `provider_claim:review` ve `provider_claim:approve` (ikisi farklı admin'lerde olmalı — two-person rule).
- [x] **Encryption at rest?** MVP=N/A. Faz 2: `claimantEmail` PII; `emailVerificationToken` hashed (plain asla saklanmaz). Business registration ref free-text; sensitive kabul edilmez.
- [x] **GDPR DSAR?** MVP=N/A (boş). Faz 2: claim verisi partner'a değil partner-employee'ye ait (claimant). Erase: claimantEmail'i `REDACTED@example.com`'a çevir, claim kaydı `status=REJECTED, rejectionReason="USER_DELETE_REQUEST"` damgala — kayıt silinmez (audit history için), anonimize.

**Domain control + email control = two factors** (D16):
- Email control: claimant @providerdomain.com adresinden gelen verification token'a click
- Domain control: DNS TXT record (provider'ın gerçek domain sahibinin yapabileceği şey)
- Optional third: business registration upload (Faz 2'de file storage)
- Admin two-person rule: review eden admin ≠ approve eden admin

**Adversarial scenarios (Faz 2 düşünülmesi gereken)**:
- Subdomain takeover (claimant verified email'i ele geçirir): DNS TXT bunu zor yapar
- Disposable email: domain check sırasında bloklist
- Provider rakibi sabotaj claim'i: admin review'da catch edilmeli; ayrıca tek admin onaylayamaz

## Migration / backward compat

- Tek migration: `add_provider_claim_table` + `add_claimed_at_to_service_provider`
- Backfill: tüm mevcut `ServiceProvider` row'ları `claimedAt=null`, `verifiedBadge=false` (D15 gereği)
- Rollback: tablo + kolonlar drop güvenli (hiç data yok)
- Prisma client regenerate

## Etkilenen mevcut özellikler

**MVP** (sıfır functional impact)
- Schema: 1 yeni tablo + 3 yeni kolon
- Admin: 1 yeni placeholder sayfa
- Mevcut Provider Actions CRUD (cross-ref [51](./51-admin-provider-actions-crud.md)) etkilenmez

**Faz 2 (intended)**
- Partner Hub UI: claimed/verified badge layer
- Provider CRUD: claimed provider'lar için "Locked — controlled by partner" UI (admin override mümkün)
- Email templates (cross-ref [66](./66-email-templates.md)): verification, approval, rejection
- Marketing pages: "Partners" sayfası verified ortaklar listesi

## Test plan

**MVP**

*Unit*
- Prisma generate hatasız
- `ProviderClaim` type consumer kodda compile

*Integration*
- Migration up + down + up cycle
- Boş table smoke: `prisma.providerClaim.findMany()` → `[]`
- Admin GET endpoint döner `{ claims: [], featureEnabled: false }`
- Mevcut `ServiceProvider` query'leri çalışıyor (`claimedAt` eklendi, null safe)

*Manual*
- Admin sayfası placeholder render ediliyor, butonlar disabled
- Disabled butona click → hiçbir şey olmuyor (analytics event opsiyonel)

**Faz 2 (planned, bu doc kapsamında YOK)**
- End-to-end claim flow: email verify, DNS poll, admin two-step approve
- Adversarial: aynı admin'in approve denemesi → 409
- DNS TXT record yanlış → DNS_PENDING'de takılır
- Email verification expired → 410, retry token

## Açık sorular

1. **Schema şimdi vs. Faz 2'de?** **Karar (D16)**: schema şimdi, aktif feature Faz 2. Bu doc bu kararı belgeliyor.
2. **`ServiceProvider`'a kolon eklemek vs. ayrı `ProviderClaim` tablo**? **Karar**: ayrı tablo (separation of concerns; claim lifecycle, retry, history ayrı). `ServiceProvider`'a sadece minimal flag (claimedAt, verifiedBadge).
3. **Two-person rule MVP schema'da zorlansın mı?** Şu an `approvedByAdminId` nullable; uniqueness constraint yok. Faz 2'de app-level enforce (approve eylemi review eylemine bağlı, farklı admin gerekir).
4. **Email verification token TTL?** Faz 2'de 24h önerilir. Schema desteklı (`emailVerificationExpiresAt`).
5. **DNS TXT record format**: `locateflow-verify=<hash>` — hash ne'nin? `sha256(claimId + secret)`? Faz 2'de detay.
6. **Business registration upload Faz 2'de file storage**: S3/R2 vs.? Mevcut LocateFlow file storage pattern'i bul (Faz 2 implementation öncesi).
7. **Verified rozeti UI'da nasıl görünür?** Mavi tik (Twitter style) güvenilirlik patternı; Faz 2 tasarım kararı. Bu doc kapsamı dışı.
8. **Claim reject edilen partner aynı provider için tekrar claim açabilir mi?** Faz 2'de cooldown (30 gün) ve eski rejection notes admin'e görünür.
