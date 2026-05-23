# Partner Consent — Schema Skeleton (Faz 2)

- **Status**: **Schema/iskelet only — MVP'de aktif feature DEĞİL.** MVP'de migration uygulanır, hiçbir API/UI ship etmez. Faz 2'de OAuth partner entegrasyonları geldiğinde aktive edilir.
- **Tier**: Infrastructure (tüm planları kapsayacak Faz 2 davranışı)
- **Related decisions**: **D8** (PartnerConsent ayrı tablo, MVP'de schema-only), **D16** (paralel olarak partner claim iskeleti — bu iki Faz 2 hazırlık doc'u birbirini tamamlar), D15 (Day 1 partner = sıfır anlaşma — bu yüzden consent gerekmez, ama OAuth Faz 2'de yaratılacağı için DB hazır olsun)
- **Related docs**: [34](./34-service-provider-action-registry.md), [35](./35-partner-sync-attempts.md), [46](./46-partner-claim-skeleton.md), [50](./50-admin-workspace-inspector.md), [18](./18-security-checklist.md)

---

## Amaç

Faz 2'de gerçek partner API entegrasyonları (USPS Mover's Guide, büyük bankalar, telco'lar) geldiğinde **OAuth-style kullanıcı consent**'i tutan tabloyu **şimdi yarat**. Migration'ı MVP'ye dahil etmenin gerekçesi:
- Faz 2'ye geçişte downtime'sız refactor (tablo zaten orada, sadece API endpoint'leri eklenir)
- GDPR DSAR cevabı tek noktadan: kullanıcı consent verisini export/erase ederken Faz 1'de boş, Faz 2'de dolu — kod aynı
- Audit log şeması Faz 2'de değişmesin

**MVP'de bu tablo boş kalır.** Hiçbir API endpoint yazılmaz. Hiçbir UI gösterilmez. Schema migration uygulanır + Prisma client generate edilir + GDPR DSAR export'u tabloya `SELECT` eder (always 0 row).

## Kapsam

**In scope (MVP — schema only)**
- `PartnerConsent` tablo migration (Sprint 4'te tek migration)
- Prisma schema'ya model eklenir
- `packages/db/src/index.ts` export'larında `PartnerConsent` type'ı dışa açılır (TypeScript type completeness için)
- `/api/profile/export` (DSAR) endpoint'inde `consents: []` boş array eklenir (Faz 2'de doldurulur)
- Migration test: `prisma migrate dev` → reset → re-apply, schema integrity

**Out of scope (MVP)**
- API endpoint (`/api/partner-consents/...`) — **YOK**
- UI (`/workspace/connections` veya benzeri) — **YOK**
- OAuth client kayıt (Google/Apple/USPS console) — **YOK**
- Token encryption KMS setup — **YOK**
- Background job for token refresh — **YOK**
- Webhook receiver (partner revoke notification) — **YOK**

**Faz 2 scope (roadmap referansı, bu doc kapsamında değil ama README niteliğinde)**
- OAuth flow implementation (partner-specific)
- Consent grant UI (`/workspace/connections/grant?provider=usps&scopes=...`)
- Token storage with `encryption.ts`
- User revocation UI (`/workspace/connections` list + revoke buton)
- Admin revocation tool
- Auto-expire cron job
- Webhook endpoint for partner-side revocation

## User stories

**MVP**: Yok — kullanıcı bu feature'ı görmez.

**Faz 2 (intended)**
- As user, USPS Mover's Guide API ile adres bilgilerimi paylaşmak için **explicit consent ekranı** isterim, kapsam ve sürelerini görürüm.
- As user, consent'imi **istediğim zaman /workspace/connections sayfasından geri çekebilirim**, revoke sonrası LocateFlow partner'a tekrar veri yollamayacak.
- As user, consent verdiğim **exact terms snapshot'ını** ileride görmek isterim ("ne kabul ettim Aralık 2026'da?").
- As admin, güvenlik olayında **bir partner için tüm workspace'lerin consent'ini toplu revoke** edebileyim.
- As GDPR DSAR isteği yapan kullanıcı, consent geçmişimi export edebileyim.

## Veri modeli

**MVP migration — sadece schema:**

```prisma
model PartnerConsent {
  id                  String   @id @default(cuid()) @db.VarChar(30)

  workspaceId         String   @db.VarChar(30)
  workspace           Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  userId              String   @db.VarChar(30)
  // consent veren kişi (workspace owner olmayabilir; örn. üye kendi adına bağlar)
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  providerId          String   @db.VarChar(30)
  provider            ServiceProvider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  scopesJson          String   @db.Text
  // [{scope:"addresses:write", resource:"chase_card_1234"}, {scope:"profile:read"}]
  // Faz 2'de typed JSON; MVP'de free-form text validated app-level

  status              String   @db.VarChar(20)
  // GRANTED | REVOKED | EXPIRED

  revocationReason    String?  @db.VarChar(40)
  // USER_REQUESTED | PARTNER_REVOKED | AUTO_EXPIRED | ADMIN_REVOKED | SECURITY_INCIDENT

  grantedAt           DateTime
  revokedAt           DateTime?
  expiresAt           DateTime?
  // null = no expiry; pratikte 1 yıl default Faz 2'de

  tokenEncrypted      String?  @db.Text
  // refresh token, packages/shared/src/encryption.ts ile şifrelenmiş
  // MVP'de null kalır (consent yaratılmadığı için)

  tokenExpiresAt      DateTime?

  consentSnapshotJson String   @db.Text
  // grant anında kullanıcıya gösterilen exact terms + scope listesi + i18n locale
  // immutable; consent versiyonlaması için audit trail

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([workspaceId, providerId])
  @@index([userId, status])
  @@index([status, expiresAt])  // auto-expire cron için
}
```

**Mevcut modeller** etkisi:
- `Workspace` → `consents PartnerConsent[]` back-relation eklenir
- `User` → `partnerConsents PartnerConsent[]` back-relation
- `ServiceProvider` → `consents PartnerConsent[]` back-relation

## API endpoint'leri

### Yeni (MVP)

**YOK.** Sıfır endpoint ship edilir.

### Yeni (Faz 2 — intended, roadmap)

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/partner-consents` | session | `requireWorkspaceContext` | — | `{ consents: ConsentDto[] }` | 401, 403 |
| POST | `/api/partner-consents/oauth/initiate?providerId=...` | session | `requireWorkspaceContext` + step-up D10 | `{ scopes: [...] }` | `302` redirect to partner OAuth | 401, 403, 422 |
| GET | `/api/partner-consents/oauth/callback` | partner callback | — | OAuth code | `302` workspace connections | 400, 422 |
| DELETE | `/api/partner-consents/:id` | session | `requireWorkspaceContext` | `{ reason: "USER_REQUESTED" }` | `204` | 401, 403, 404 |
| POST | `/api/partner-consents/:id/refresh` | system / cron | — | — | `{ refreshed: true, newExpiresAt }` | 500 |
| POST | `/webhooks/partner-revoke` | HMAC signature | — | `{ providerId, externalUserRef, reason }` | `204` (cascade revoke) | 401, 422 |

### Mevcut endpoint'lere etki

**MVP**:
- `/api/profile/export` (DSAR): response'a `partnerConsents: []` boş array eklenir. Kod bir kez yazılır, Faz 2'de tablo dolunca otomatik populate.

**Faz 2**:
- `/api/partner-actions/:attemptId/launch` (cross-ref [36](./36-partner-deep-link-launcher.md)) — eğer ilgili `ServiceProvider.integrationType === 'OAUTH_API'` ise direkt API call'a yönlendirir, deep-link yerine.
- Workspace delete: cascade ile tüm consent'leri REVOKE'lar (zaten `onDelete: Cascade`).

## Web

### Yeni sayfa/route

**MVP**: YOK.

**Faz 2 (intended)**
- `/workspace/connections` — bağlı partner'ların listesi, revoke butonları
- `/workspace/connections/grant?provider=...` — OAuth onay öncesi summary ekranı
- `/workspace/connections/[consentId]` — detay + consent snapshot view

### Mevcut sayfalara etki

**MVP**: yok.

**Faz 2**: Partner Hub action card'ında `OAUTH_API` action type için "Connect with {provider}" CTA → `/workspace/connections/grant`.

### Componentler (file paths — Faz 2)

- `apps/web/src/app/(workspace)/connections/page.tsx`
- `apps/web/src/components/connections/ConsentCard.tsx`
- `apps/web/src/components/connections/RevokeConsentButton.tsx`
- `apps/web/src/components/connections/ConsentSnapshotView.tsx`
- `apps/web/src/lib/oauth/initiateFlow.ts`
- `apps/web/src/lib/oauth/handleCallback.ts`

### Butonlar / actionlar

**MVP**: YOK.

## Mobile

### Yeni ekran

**MVP**: YOK.

**Faz 2 (intended)**: `apps/mobile/app/(workspace)/connections/` ekranları. OAuth in-app browser via `expo-web-browser`.

### Mevcut ekranlara etki

**MVP**: yok.

### Componentler

**MVP**: YOK.

## Admin

### Yeni sayfa / Yetenekler

**MVP**: YOK.

**Faz 2 (intended)**
- `/admin/partner-consents` — global consent kuyruğu (audit + bulk revoke)
- Workspace Inspector (cross-ref [50](./50-admin-workspace-inspector.md))'a "Connections" tab — read-only consent list
- Bulk revoke (security incident): `POST /admin/partner-consents/bulk-revoke?providerId=...&reason=SECURITY_INCIDENT`
- AdminAuditLog'a tüm consent eylemleri

## Güvenlik

- [x] **Step-up auth?** MVP=N/A (UI yok). Faz 2=evet (consent grant öncesi D10 step-up zorunlu — saldırgan ATO senaryosunda partner'a OAuth grant veremesin).
- [x] **PII redaction?** MVP=N/A. Faz 2: consent listesi UI'da `scopesJson` özet badge ile; `tokenEncrypted` ASLA UI'ya çıkmaz, sadece backend.
- [x] **Audit log?** MVP=N/A. Faz 2: her grant/revoke/refresh `AuditLog` + ağır eylemler `AdminAuditLog`.
- [x] **Rate limit?** MVP=N/A. Faz 2: OAuth initiate 5/dk/user (CSRF state token + rate limit).
- [x] **Permission matris?** MVP=N/A. Faz 2:
  - OWNER/ADMIN: workspace consent'lerini görebilir + revoke edebilir
  - MEMBER: kendi yarattığı consent'leri görebilir + revoke
  - CHILD: consent veremez (D5 + D22 ruhu)
  - VIEW_ONLY: read-only
- [x] **Encryption at rest?** Faz 2 ZORUNLU: `tokenEncrypted` `packages/shared/src/encryption.ts` ile şifrelenir. **Key rotation plan**: Faz 2 launch öncesi KMS rotation drill belgelenmeli. Eski key ile encrypt edilmiş token'lar grace period (30 gün) içinde re-encrypt.
- [x] **GDPR DSAR?** MVP: export endpoint `partnerConsents: []` döner (boş). Erase: `User.onDelete: Cascade` ile silinir. Faz 2: aktif consent'ler erase'ten önce **partner'a revoke notice** gönderilmeli (data processor obligation).

**Revocation cascade plan (Faz 2)**:
- User revoke: status=REVOKED, revocationReason=USER_REQUESTED, tokenEncrypted=null (zero'la), partner API'ye revoke call (best-effort)
- Partner revoke (webhook): aynı, reason=PARTNER_REVOKED
- Admin revoke (security): bulk, reason=SECURITY_INCIDENT + user'a email notification
- Workspace delete: cascade, reason=USER_REQUESTED (workspace owner inisiyatifi)
- Token expire: cron, reason=AUTO_EXPIRED

## Migration / backward compat

- Tek migration: `add_partner_consent_table`
- Boş tablo, hiçbir backfill yok
- Rollback: tablo silmek güvenli (hiç row yok)
- Prisma client regenerate: tüm dev/prod build pipeline'da çalışır
- TypeScript breakage riski: `PartnerConsent` type yeni; mevcut kod kullanmıyor, breakage yok
- `/api/profile/export` JSON shape değişikliği: yeni alan `partnerConsents` eklendi → backward-compat (consumer additive change'ı tolere etmeli)

## Etkilenen mevcut özellikler

**MVP** (zero functional impact):
- Schema migration tek satır eklenir
- `/api/profile/export` response shape +1 alan
- `packages/db` type export'una +1 model

**Faz 2** (intended impact, not in MVP):
- Partner Hub action launcher → integration type branching
- Service create akışında "Connect for auto-sync" upsell
- Workspace delete flow → consent revoke side-effects
- Admin tooling: bulk operations
- Email templates (cross-ref [66](./66-email-templates.md)): "Your consent expired", "Your consent was revoked"

## Test plan

**MVP**

*Unit*
- Prisma generate hatasız geçer
- `PartnerConsent` type'ı consumer kodda compile eder
- `/api/profile/export` response'ta `partnerConsents` field var (boş array)

*Integration*
- Migration up + down + up cycle (no data loss)
- Boş table CRUD smoke: `prisma.partnerConsent.findMany()` → `[]`

*Manual*
- Migration prod-like DB'de çalışır (PostgreSQL 15+)
- Foreign key cascade testi: User delete → orphan consent yok (zero row zaten)

**Faz 2 (planned, bu doc'un kapsamında YOK)**
- OAuth flow end-to-end (her partner için)
- Token refresh job
- Revoke webhook signature validation
- DSAR export consent verisi içeriyor
- Security incident drill: bulk revoke 10k consent < 5dk

## Açık sorular

1. **Bu spec'i şimdi mi yazalım yoksa Faz 2'de mi?** **Karar (D8)**: schema şimdi (downtime'sız refactor için), aktif feature Faz 2. Bu doc bu kararı belgeliyor.
2. **`scopesJson` typed JSON mı free-form text mi?** MVP'de `@db.Text` plain JSON string. Faz 2'de Zod schema validation server-side.
3. **`consentSnapshotJson` ne kadar büyük?** Locale-aware HTML + scope listesi → 1–5KB tahmin. `@db.Text` (MySQL `LONGTEXT`) yeterli.
4. **OAuth provider clientId/clientSecret nerede saklanır?** Faz 2'de env var; secret management TBD (AWS Secrets Manager / Vault).
5. **Çoklu consent per (user, provider)?** Faz 2'de düşünülecek; muhtemelen evet (farklı scope'lar farklı consent). MVP schema buna izin veriyor (`@@unique` yok).
6. **Token refresh job cadence?** Faz 2: provider-specific (Google 1h, USPS muhtemelen daha uzun). Job queue gerekecek (BullMQ/Inngest).
7. **Partner-initiated revoke webhook format standartlaştırılmamış**, her partner farklı. Faz 2'de adapter pattern.
