# Admin Partner Claim Queue

> **Drift fix 2026-05-23** — Çelişkili değerler [`01a-canonical-values.md`](./01a-canonical-values.md) (§C8, §C14) ile geçersizdir. Dotted permission kodu `provider.claim.review` YASAK (D25 / §C8); bunun yerine `ADMIN_RESOURCES`'a `provider_claims` resource'u eklenir, `provider_claims.canRead/canUpdate` flag'leri kullanılır. **MVP'de hiçbir admin role'a grant edilmez** (D16/D28 — Faz 2 aktivasyonu).

- **Status**: Schema-only, MVP shows placeholder (Family/Pro launch, Sprint 4 — iskelet); Faz 2 activation Q3 2026 (D28)
- **Tier**: Admin
- **Related decisions**: D16 (Partner Claim MVP'de iskelet, UI disabled; tablolar yaratılır), D8 (PartnerConsent ayrı schema-only iskelet — bu doc'la paralel pattern), D25 (ADMIN_RESOURCES extension), D28 (Faz 2)
- **Related docs**: [`46-partner-claim-skeleton.md`](./46-partner-claim-skeleton.md), [`45-partner-consent-skeleton.md`](./45-partner-consent-skeleton.md), [`51-admin-provider-actions-crud.md`](./51-admin-provider-actions-crud.md)

## Amaç

D16: lansmandan sonra partner şirketleri kendi profillerini "iddia" edip (claim) doğrudan kendi action'larını yönetmek isteyecek (örn. AT&T çalışanı "biz Comcast'le karıştırılmışız, bizim move URL'i artık şu"). Bu akış Faz 2 aktif olacak; **MVP'de iskelet** kurulur: tablo, migration, route, disabled UI. Aktivasyonu Faz 2'de 2–3 günlük iş haline indirir.

Bu doc'un işi: Sprint 4'te admin sol nav'da görünen ama "Coming soon" placeholder gösteren `/partner-claims` sayfasının skeleton'unu, Faz 2'de açılacak gerçek queue UX'inin spec'ini bir arada vermek.

## Kapsam

**In scope (MVP — Sprint 4)**
- `ProviderClaim` tablosu Prisma migration (boş kalır)
- `/partner-claims` route + page (always empty in MVP, "Coming soon" placeholder)
- Sol nav entry (disabled style: gray text + "Q3 2026" rozeti)
- `provider.claim.review` permission code (seed, hiç kimseye grant edilmez MVP'de)
- Empty state copy + Faz 2 roadmap link

**Out of scope MVP, in scope Faz 2**
- Public `/partner-claim` form (apps/web tarafı; bu doc kapsamı dışında, doc 46'da spec)
- Claim queue list + filter + detail page (Faz 2 — spec yine bu doc'ta tarif edilir, implement edilmez)
- Approve / Reject / Request-info actions (Faz 2)
- Email notifications (Faz 2)
- DNS TXT verification worker (Faz 2)
- Partner role / scoped admin permissions (Faz 2 — ayrı doc gerekecek)

## User stories

**MVP**:
- As an **Admin**: sol nav'da "Partner Claims" görüyorum, gray + "Q3 2026" rozeti; tıkladığımda sayfa "Partner claim queue — opening Q3 2026" placeholder + roadmap doc'una link gösteriyor; disabled button "Review claims (0)".

**Faz 2** (spec, MVP'de implement yok):
- As an **Admin** (with `provider.claim.review`): claim queue açılır, REVIEW durumundaki claim'leri görür, detayı tıklayıp DNS TXT verified ✅, email confirmed ✅, business registration link gör, "Approve" → step-up auth + double-click confirm (5 sn aralı) → claim APPROVED, claimant'a "partner contact" hakkı verilir, email gönderilir.
- As an **Admin**: bir claim'i reject ederim → sebep textarea zorunlu → email "Your claim was rejected because..." gönderilir, status REJECTED.
- As an **Admin**: "Request more info" → claimant'a custom soru email'i, status WAITING_INFO.

## Veri modeli

### MVP — migration yaratılır, kullanılmaz

```prisma
model ProviderClaim {
  id                String   @id @default(cuid())
  providerId        String
  provider          ServiceProvider @relation(fields: [providerId], references: [id])
  claimantEmail     String
  claimantFullName  String
  claimantTitle     String?           // "Director of Operations"
  businessName      String
  businessRegistrationNumber String?  // EIN / DUNS / TR vergi no
  businessAddress   String?           // free text in MVP; structured later
  websiteDomain     String            // used for DNS TXT challenge
  proofOfEmploymentUrl String?        // S3 link (Faz 2 upload flow)
  dnsTxtChallenge   String            // generated server-side, claimant publishes
  dnsTxtVerifiedAt  DateTime?
  emailConfirmedAt  DateTime?
  status            ClaimStatus @default(REVIEW)
  rejectionReason   String?           @db.Text
  approvedAt        DateTime?
  approvedByAdminId String?
  rejectedAt        DateTime?
  rejectedByAdminId String?
  notesMd           String?           @db.Text   // admin internal notes
  metadataJson      Json?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@index([status, createdAt])
  @@index([providerId])
}

enum ClaimStatus {
  REVIEW
  WAITING_INFO
  APPROVED
  REJECTED
  WITHDRAWN
}
```

New `AdminPermission` seed: `provider.claim.review` (seeded, **MVP'de hiçbir role'a grant edilmez** — explicit Faz 2 task).

`AdminAuditLog` field değişikliği yok; mevcut shape yeterli.

## API endpoint'leri

### Yeni (MVP — sadece skeleton, hep boş döner)

| Method | Path | Auth | Permission | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/admin/partner-claims` | Admin | `provider.claim.review` | query: `status`, `page` | `{ items: ProviderClaim[], total: 0, phaseEnabled: false }` | 403 |

MVP'de hem hiçbir admin'in `provider.claim.review` permission'ı olmadığı için endpoint çağrıldığında 403 döner, hem `phaseEnabled: false` flag UI'ya placeholder göstermesini söyler.

### Yeni (Faz 2 — spec, MVP'de değil)

| Method | Path | Auth | Permission | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/admin/partner-claims/[id]` | Admin | `provider.claim.review` | — | `{ claim, verificationStatus, providerCurrentActions }` | 403, 404 |
| POST | `/api/admin/partner-claims/[id]/approve` | Admin + step-up | `provider.claim.review` | `{ confirmedAt }` (must be 5s after first confirm token) | `{ claim, partnerContactId }` | 400 (confirm timing), 403, 404, 409 (already decided) |
| POST | `/api/admin/partner-claims/[id]/reject` | Admin + step-up | `provider.claim.review` | `{ reason }` | `{ claim }` | 400, 403, 404, 409 |
| POST | `/api/admin/partner-claims/[id]/request-info` | Admin | `provider.claim.review` | `{ message }` | `{ claim }` | 403, 404 |
| POST | `/api/admin/partner-claims/[id]/recheck-dns` | Admin | `provider.claim.review` | — | `{ verified, txtRecord }` | 403, 404 |

Approve double-confirm flow:
1. POST `/approve` (no confirmedAt) → `{ confirmToken, mustWaitUntil: ISO }` (mustWaitUntil = now + 5s)
2. UI disables "Confirm" button 5 sn
3. POST `/approve` with `{ confirmToken, confirmedAt }` — server checks `confirmedAt >= mustWaitUntil`

### Mevcut endpoint'lere etki

- Mevcut provider routes etkilenmez.
- `apps/admin/src/lib/admin-auth.ts` — `provider.claim.review` permission code seed (MVP).

## Web (admin app)

### Yeni sayfa/route

**MVP**
- `apps/admin/src/app/(admin)/partner-claims/page.tsx` — placeholder server component
- `apps/admin/src/app/api/admin/partner-claims/route.ts` — empty list endpoint
- Prisma migration: `ProviderClaim` table + `ClaimStatus` enum

**Faz 2 (spec)**
- `apps/admin/src/app/(admin)/partner-claims/[id]/page.tsx`
- `apps/admin/src/app/api/admin/partner-claims/[id]/route.ts`
- `apps/admin/src/app/api/admin/partner-claims/[id]/approve/route.ts`
- `apps/admin/src/app/api/admin/partner-claims/[id]/reject/route.ts`
- `apps/admin/src/app/api/admin/partner-claims/[id]/request-info/route.ts`
- `apps/admin/src/app/api/admin/partner-claims/[id]/recheck-dns/route.ts`
- Background worker: DNS TXT polling job (`packages/jobs/src/dns-verification-worker.ts`)
- Email templates: claim-approved, claim-rejected, claim-info-requested (cross-ref doc 66)

### Mevcut sayfalara etki

**MVP**
- `apps/admin/src/app/(admin)/layout.tsx` — sol nav'a "Partner Claims" item; style:
  ```tsx
  <NavItem
    href="/partner-claims"
    label="Partner Claims"
    badge={<span className="text-xs text-gray-400">Q3 2026</span>}
    className="opacity-60"
  />
  ```
- `apps/admin/src/lib/admin-auth.ts` — permission seed.

### Componentler

**MVP** — sadece placeholder:

```
apps/admin/src/app/(admin)/partner-claims/_components/
  ComingSoonPlaceholder.tsx       // empty-state card; "Partner claim queue — opening Q3 2026"
                                  // + link to docs/roadmap/family-and-pro/46-partner-claim-skeleton.md
                                  // + disabled button: "Review claims (0)"
```

**Faz 2** (spec, kuruluş zamanı geldiğinde):

```
apps/admin/src/app/(admin)/partner-claims/_components/
  ClaimQueueFilters.tsx           // status tabs: REVIEW | WAITING_INFO | APPROVED | REJECTED
  ClaimQueueTable.tsx
  ClaimDetailHeader.tsx
  VerificationStatusPanel.tsx     // email ✓ / DNS TXT ✓ / business reg ✓
  DnsTxtInstructionsCard.tsx      // shows the TXT record to publish
  RecheckDnsButton.tsx
  ApproveDialog.tsx               // step-up + double-click confirm 5s gate
  RejectDialog.tsx                // reason textarea, char counter, min 50 chars
  RequestInfoDialog.tsx
  ClaimHistoryTimeline.tsx        // all status transitions from AuditLog
```

### Butonlar / actionlar

**MVP**: tek disabled button "Review claims (0)" (no action).

**Faz 2**: "Approve" / "Reject" / "Request info" / "Recheck DNS" / "Add internal note".

## Mobile

N/A — admin web only. Partner self-onboarding (claimant tarafı) public web (apps/web) — doc 46 kapsamı.

## Admin permissions

| Code | What it gates | Step-up | MVP grant |
|---|---|---|---|
| `provider.claim.review` | Read queue + detail + all decision actions | **Yes** (approve + reject only) | None — explicit Faz 2 grant |

Step-up: approve / reject endpoint'leri `requireAdminStepUp(req, { maxAgeSeconds: 300 })` zorunlu; request-info ve recheck-dns gerekli değil (düşük blast radius).

## Güvenlik

- [x] **Step-up admin auth** — Approve + Reject zorunlu (Faz 2). Approve ek olarak **5 saniyelik double-click gate** (yanlışlıkla onay riskine karşı, D16 referansı).
- [x] **PII redaction** —
  - MVP: tablo boş, görünür PII yok.
  - Faz 2: `claimantEmail`, `claimantFullName` admin için görünür (gerekli — kararı verebilmek için); admin AuditLog'da maskelenmez (audit doğruluğu için tam değer).
  - `proofOfEmploymentUrl` belge bağlantısı — sadece admin session içinde presigned URL (10 dk valid).
- [x] **Audit log** — her status transition için entry:
  ```ts
  {
    adminUserId, permission: "provider.claim.review",
    targetType: "ProviderClaim", targetId: claim.id,
    action: "approve" | "reject" | "request_info" | "recheck_dns" | "internal_note",
    beforeJson: { status, dnsTxtVerifiedAt, emailConfirmedAt },
    afterJson: { status, dnsTxtVerifiedAt, emailConfirmedAt, rejectionReason },
    metadataJson: { providerId, claimantEmailMasked }
  }
  ```
- [x] **Rate limit** — Faz 2: approve endpoint admin başına 10/dakika (decision quality için throttle). DNS recheck 30/dakika.
- [x] **Permission matris** — `provider.claim.review` olmayan admin sayfa 403 → MVP placeholder UI bunu handle eder ("You don't have permission" göstermez, "Coming soon" gösterir; çünkü permission seeded but ungranted).
- [x] **Two-step confirmation** — Approve: type provider name + 5 sn wait + click confirm.
- [x] **DNS TXT verification** (Faz 2) — domain ownership proof; manuel admin onayı + sistem otomatik doğrulama birlikte.
- [x] **Email confirmation** (Faz 2) — claimant başvuru sonrası email confirm linkine tıklamadan kuyruğa düşmez.
- [ ] **Encryption at rest** — `metadataJson` sensitive olabilir (business reg no); MVP'de plaintext, Faz 2'de pgcrypto / app-level encryption (D8 PartnerConsent ile paralel pattern).

## Migration / backward compat

**MVP migration**:
1. `ProviderClaim` table + `ClaimStatus` enum CREATE.
2. `AdminPermission { code: "provider.claim.review" }` seed insert; **grant yok**.
3. Sol nav entry + placeholder page deploy.
4. Empty list endpoint (`phaseEnabled: false` her zaman).

**Faz 2 activation (zaman geldiğinde, blocker yok)**:
1. `apps/web/src/app/partner-claim/page.tsx` public form (doc 46) deploy.
2. Email template'leri (doc 66).
3. DNS TXT background worker.
4. Real list + detail page kodu (skeleton'un üstüne build).
5. Permission grant (Eng manager → designated admins).
6. Sol nav'dan "Q3 2026" rozetini kaldır + opacity normalize.

**Backward compat**: ProviderClaim tablosu hiç dolmadığı için MVP'de migration zero-risk; Faz 2'de tablo schema'sı zaten oturmuş, refactor minimal.

## Etkilenen mevcut özellikler

**MVP**
- Sol nav'a 1 entry eklenir; başka hiçbir mevcut özellik etkilenmez.
- Prisma client regenerate (tip `ProviderClaim` görünür ama kullanılmaz; lint warning suppress).

**Faz 2**
- Doc 51 (Provider Actions CRUD) — approved claim sahibi "partner contact" rolü ile **kendi provider'ının** action'larını edit eder (scoped permission; tasarım Faz 2 doc'ta).
- Doc 46 — public claim form bu admin queue'ya beslenir.
- Doc 66 — 3 yeni email template.

## Test plan

**MVP**
- **Unit**: `ProviderClaim` Prisma tip'i compile eder; enum değerleri doğru.
- **Integration**: GET `/api/admin/partner-claims` admin permission'sız → 403; permission'lı (test setup) → `{ items: [], total: 0, phaseEnabled: false }`.
- **E2E**: Admin login → sol nav "Partner Claims (Q3 2026)" görünür → tıklama → placeholder sayfa render → roadmap doc link tıklanır.
- **Visual regression**: Placeholder sayfa screenshot fixed; nav gray styling onaylanır.

**Faz 2** (spec)
- Approve flow: step-up yokken 401, 5 sn beklemeden ikinci POST → 400, başarılı approve → ProviderClaim.status=APPROVED + AuditLog + email gönderildi
- DNS recheck: TXT yokken false; doğru TXT publish edilince true; cache 60 sn
- Rate limit: 11. approve isteği 429
- Double-click gate: confirmToken mismatch → 400

## Açık sorular

1. "Partner contact" rolü tam olarak ne yapabilir? (Faz 2 — ayrı doc gerekecek: ProviderPartner permission scope tablosu). MVP'de sadece skeleton; karar deferred.
2. DNS TXT challenge format: `locateflow-claim-verify=<hash>` mı yoksa nested subdomain mı? Karar Faz 2 başında; placeholder doc'ta her ikisi de geçerli.
3. Email confirmation token reuse: claim withdraw sonra yeniden başvuru aynı domain ile? Yeni token, yeni TXT.
4. Business registration verification (EIN/DUNS) otomatik mı manuel mi? MVP yok, Faz 2'de büyük ihtimal **manuel** (admin gözle doğrular) — otomatik API entegrasyonu Faz 3.
5. Withdraw flow (claimant pişman oldu, kuyrukta) — kim yapar? Public claim sayfasından kendi token'ı ile. MVP placeholder, Faz 2 tasarım.
6. Multiple claims same provider — race condition? İlk APPROVED kazanır, sonrakileri otomatik REJECTED + "already claimed" reason. Karar Faz 2.
