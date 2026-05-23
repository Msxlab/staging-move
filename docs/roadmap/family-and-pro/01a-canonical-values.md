# Canonical Values — Family & Pro

- **Status**: LOCKED 2026-05-23. Diğer 47 doc bu dosyaya referans verir.
- **Decision date**: 2026-05-23 (review pass sonrası)
- **Related**: [`01-architecture-decisions.md`](./01-architecture-decisions.md) (kavramsal kararlar), bu dosya (sayısal/string değerler)

> **Kural**: Bir sayı/string/route/cookie/header/field adı bir doc'ta görünüyorsa burada da görünmeli. Çelişki varsa **bu dosya kazanır**. Doc'lar burayı referans verir: `→ canonical §C1`.

---

## §C1 — Plan limit matrisi (TEK kaynak)

| Plan | Üye | Adres | Servis | Address labels | Partner Hub | Bulk queue | Tax export | Vendor book | Move history | Address verify |
|---|---|---|---|---|---|---|---|---|---|---|
| FREE_TRIAL | 1 | 2 | 10 | HOME only | none | — | — | — | last 0 | — |
| INDIVIDUAL | 1 | 10 | 100 | HOME only | none | — | — | — | last 1 | — |
| **FAMILY** | **6** | **17** | **250** | **all open (incl. DORM)** | **none** | — | — | — | last 5 | paid add-on |
| **PRO** | **10** | **25** | **1000** | **all open** | **full** | ✅ | ✅ | ✅ | unlimited | bundled |

**Family 17 adres anatomi**: 5 paylaşımlı ev/yazlık + üye başı 2 (6 üye × 2 = 12) ≈ 17 toplam pratik kapasite. Sert limit = 17 satır.

**Pro 25 adres**: 1 home + 1 office + 3 rental + 1 vacation + 1 warehouse + 18 buffer.

**Action tier mapping** (D4'e bağlı):

| Plan | BASIC | EXTENDED | PREMIUM |
|---|---|---|---|
| FREE_TRIAL | ✅ | — | — |
| INDIVIDUAL | ✅ | — | — |
| FAMILY | ✅ | ✅ | — |
| PRO | ✅ | ✅ | ✅ |

---

## §C2 — Pricing (D20'den taşındı, tek kaynak)

| Plan | Monthly | Annual | Stripe Price Config Key (web) | App Store Product ID | Google Play SKU |
|---|---|---|---|---|---|
| INDIVIDUAL | $3.99 | $39.99 | `STRIPE_PRICE_INDIVIDUAL_MONTHLY` / `_YEARLY` | `com.locateflow.individual.annual` | `individual_annual` |
| FAMILY | $9.99 | $99 | `STRIPE_PRICE_FAMILY_MONTHLY` / `_YEARLY` | `com.locateflow.family.monthly` / `.annual` | `family_monthly` / `family_annual` |
| PRO | $19.99 | $199 | `STRIPE_PRICE_PRO_MONTHLY` / `_YEARLY` | `com.locateflow.pro.monthly` / `.annual` | `pro_monthly` / `pro_annual` |

**IAP not**: Family/Pro IAP product'ları paralelde hazırlanır ama lansmanda **disabled** (D11). Mobile feature flag: `MOBILE_FAMILY_PRO_PURCHASE_ENABLED = false`.

---

## §C3 — Route adları (mevcut repo doğrulandı)

**Web — mevcut, korunur**:
- `POST /api/stripe/checkout` — mevcut, body'ye `plan: "individual"|"family"|"pro"` ve `interval: "monthly"|"yearly"` eklenir. Yeni route AÇMA.
- `POST /api/stripe/portal` — mevcut, dokunulmaz
- `POST /api/webhooks/stripe` — mevcut, plan switch handler genişler

**Web — yeni Family/Pro**:
- `GET /api/profile` — mevcut, response'a `currentWorkspaceId`, `workspaces[]`, `entitlements` eklenir
- `GET|POST /api/workspaces` — yeni
- `GET|PATCH|DELETE /api/workspaces/:id` — yeni
- `GET|POST /api/workspaces/:id/members` — yeni
- `DELETE /api/workspaces/:id/members/:userId` — yeni
- `POST|GET /api/workspaces/:id/invitations` — yeni
- `GET /api/invitations/:token` (public; auth optional) — yeni
- `POST /api/invitations/:token/accept` — yeni
- `POST /api/auth/challenge` — step-up auth challenge create
- `POST /api/auth/challenge/:id/verify` — consume
- `POST|GET /api/address-changes` — yeni
- `GET|PATCH /api/address-changes/:id` — yeni
- `PATCH /api/sync-attempts/:id` — yeni
- `POST /api/sync-attempts/:id/resolve-url` — deep-link launcher single endpoint
- `GET /api/partner-hub/actions` — Partner Hub data (Pro only)
- `GET /api/budget/family` — Family consolidated
- `GET /api/exports/tax` — Pro tax export
- `GET /api/move-history` — plan-gated limit

**Admin — yeni resource'lar** (§C8'e bağlı):
- `GET|POST /apps/admin/src/app/api/workspaces/*`
- `GET|POST|PATCH /apps/admin/src/app/api/providers/[id]/actions/*`
- `POST /apps/admin/src/app/api/providers/import`
- `GET /apps/admin/src/app/api/sync-attempts`

**Yasak**: yeni `/api/billing/*` route'u yok. Mevcut `/api/stripe/*` namespace genişler.

---

## §C4 — Cookie & header adları

| Amaç | Web | Mobile | Server header |
|---|---|---|---|
| Aktif workspace ID | Cookie `lf_workspace_id` (HttpOnly: false; client okur) | AsyncStorage `lf.workspace.id` | `X-Workspace-Id` |
| Aktif workspace audit | UserEvent `workspace.switched` | aynı | — |

**Tek karar**: cookie adı `lf_workspace_id` (header adıyla simetri için). 05-workspace-switcher-ui.md'de `lf_active_workspace` yanlış — bu dosya canonical.

**HttpOnly: false** sebebi — client tarafı API çağrılarına header eklemek için okumak zorunda. XSS riskini Next.js'in default sanitize + CSP ile yönetiyoruz (zaten production'da var).

---

## §C5 — Subscription şema alan adları (mevcut repo, dokunulmaz)

Yanlış olan doc'lar bunlarla değiştirilecek:

| Doc'da yanlış geçen | Mevcut gerçek alan |
|---|---|
| `currentPeriodStart`, `currentPeriodEnd` | `stripeCurrentPeriodEnd`, `currentPeriodEndsAt` |
| `trialEnd` | `trialEndsAt` |
| `cancelAt` | `canceledAt` |
| `freeAccessEnd` | `freeAccessEndsAt` |
| `plan: PlanEnum` | `plan: String @db.VarChar(30)` — enum DEĞİL, string |
| `provider: VarChar(20)` | `provider: String @db.VarChar(30)` |

**Subscription değişiklik gerektirmiyor**: `plan` string olduğundan FAMILY/PRO eklenmesi DB migration istemez (D17 hatırlatması). Sadece allowed values güncellenir.

**Status değeri**: `CANCELED` (tek L) — repo standardı. `CANCELLED` (çift L) doc'larda yanlış geçiyorsa düzeltilecek.

---

## §C6 — Yeni schema field'lar (Family/Pro için eklenecek)

Sadece yeni eklenecek alanlar burada listelenir, tipler doğrulanır:

**Address**:
```
+ workspaceId   String? @db.VarChar(30)              // nullable migration → backfill → required
+ label         String  @default("OTHER") @db.VarChar(20)
  // values: HOME | OFFICE | RENTAL | VACATION | WAREHOUSE | DORM | OTHER
```
`ownership` mevcut alan (line 420) korunur, `label` yeni.

**Service**:
```
+ workspaceId           String? @db.VarChar(30)
+ ownedByUserId         String? @db.VarChar(30)
+ paidByUserId          String? @db.VarChar(30)
+ accountNumberVisibility String @default("OWNER_ONLY") @db.VarChar(20)
+ usernameVisibility      String @default("OWNER_ONLY") @db.VarChar(20)
+ notesVisibility         String @default("WORKSPACE") @db.VarChar(20)
```

**`assignedUserIds` YOK** — junction tablo kullanılır (§C7 review düzeltmesi).

**MovingPlan, Budget, Reminder**:
```
+ workspaceId String? @db.VarChar(30)
```

**Migration sırası (zorunlu)**:
1. Nullable ekle
2. Backfill (her user'ın PERSONAL workspace'inden)
3. NOT NULL convert
4. FK eklenmesi (opsiyonel; index zaten yeterli olabilir, MySQL FK pahalı)

`workspaceId VARCHAR(30) NOT NULL DEFAULT ''` anti-pattern **yasak**. Doc'larda görünüyorsa düzeltilecek.

---

## §C7 — Yeni tablolar (canonical schema)

Aşağıdaki tablolar Sprint 1'de yaratılır:

```prisma
model Workspace {
  id            String @id @default(cuid()) @db.VarChar(30)
  name          String @db.VarChar(120)
  ownerUserId   String @db.VarChar(30)
  owner         User   @relation(fields: [ownerUserId], references: [id], onDelete: Restrict)
  members       WorkspaceMember[]
  deletedAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([ownerUserId])
}

model WorkspaceMember {
  id           String @id @default(cuid()) @db.VarChar(30)
  workspaceId  String @db.VarChar(30)
  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  userId       String @db.VarChar(30)
  user         User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  role         String @db.VarChar(20)  // OWNER | ADMIN | MEMBER | CHILD | VIEW_ONLY
  status       String @default("ACTIVE") @db.VarChar(20)  // ACTIVE | OVERFLOW | REMOVED
  joinedAt     DateTime @default(now())
  @@unique([workspaceId, userId])
  @@index([userId])
}

model WorkspaceInvitation {
  id              String @id @default(cuid()) @db.VarChar(30)
  workspaceId     String @db.VarChar(30)
  invitedEmail    String @db.VarChar(191)
  role            String @db.VarChar(20)
  tokenHash       String @unique @db.VarChar(64)   // sha256
  tokenLast4      String @db.VarChar(8)
  invitedByUserId String @db.VarChar(30)
  expiresAt       DateTime
  acceptedAt      DateTime?
  acceptedByUserId String? @db.VarChar(30)
  revokedAt       DateTime?
  createdAt       DateTime @default(now())
  @@index([workspaceId, invitedEmail])
  @@index([tokenHash])
}
// Pending invite dedupe: app-level transaction kontrolü, DB-level unique constraint değil.
// (workspaceId+invitedEmail+expiresAt unique olamaz — farklı expiry ile çoklu pending invite atılabilir.)

model WorkspaceAuthChallenge {
  id                String @id @default(cuid()) @db.VarChar(30)
  userId            String @db.VarChar(30)
  workspaceId       String? @db.VarChar(30)
  purpose           String @db.VarChar(40)  // ADDRESS_CHANGE | MEMBER_REMOVE | WORKSPACE_DELETE | BILLING_CHANGE | EXPORT | ROLE_OWNER_CHANGE | VENDOR_BULK_DELETE
  method            String @db.VarChar(20)  // PASSWORD | EMAIL_OTP | TOTP
  challengeHash     String? @db.VarChar(64)
  attemptsUsed      Int @default(0)
  maxAttempts       Int @default(5)
  expiresAt         DateTime
  consumedAt        DateTime?
  consumedForActionId String? @db.VarChar(40)
  ipAddress         String? @db.VarChar(45)
  userAgent         String? @db.VarChar(255)
  createdAt         DateTime @default(now())
  @@index([userId, purpose, consumedAt])
  @@index([expiresAt])
}

model ServiceAssignee {           // §C7 review düzeltmesi — junction, JSON değil
  id        String @id @default(cuid()) @db.VarChar(30)
  serviceId String @db.VarChar(30)
  userId    String @db.VarChar(30)
  assignedBy String? @db.VarChar(30)
  createdAt DateTime @default(now())
  @@unique([serviceId, userId])
  @@index([userId])
}

model AddressChangeEvent {
  id              String @id @default(cuid()) @db.VarChar(30)
  workspaceId     String @db.VarChar(30)
  createdByUserId String @db.VarChar(30)
  fromAddressId   String? @db.VarChar(30)
  toAddressId     String? @db.VarChar(30)
  fromAddressSnapshotJson String? @db.Text   // address silinse de event korunur
  toAddressSnapshotJson   String? @db.Text
  scopeType       String @db.VarChar(20)  // SELF | MEMBER | ALL_WORKSPACE | CUSTOM
  status          String @default("DRAFT") @db.VarChar(20)
  label           String? @db.VarChar(120)
  notes           String? @db.Text
  activatedAt     DateTime?
  completedAt     DateTime?
  archivedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([workspaceId, status])
}

model AddressChangeTarget {
  id           String @id @default(cuid()) @db.VarChar(30)
  eventId      String @db.VarChar(30)
  targetType   String @db.VarChar(20)  // USER | ADDRESS | CUSTOM
  targetUserId String? @db.VarChar(30)
  addressId    String? @db.VarChar(30)
  label        String? @db.VarChar(120)
  status       String @default("PENDING") @db.VarChar(20)
  completedAt  DateTime?
  sortOrder    Int @default(0)
  @@index([eventId])
}

model ServiceProviderAction {
  id          String @id @default(cuid()) @db.VarChar(30)
  providerId  String @db.VarChar(30)
  actionType  String @db.VarChar(30)  // ADDRESS_UPDATE | MAIL_FORWARDING | CANCEL | TRANSFER | VERIFY_ADDRESS | CONTACT_SUPPORT | UPDATE_PAYMENT
  channel     String @db.VarChar(20)  // DEEP_LINK | MAILTO | PDF | PHONE | API
  actionTier  String @default("BASIC") @db.VarChar(20)  // BASIC | EXTENDED | PREMIUM
  urlTemplate     String? @db.Text
  mailtoTemplate  String? @db.Text
  pdfTemplateKey  String? @db.VarChar(80)
  requiredFieldsJson String @default("[]") @db.Text
  supportsHousehold       Boolean @default(false)
  supportsBusinessAddress Boolean @default(false)
  verificationTier String @default("UNVERIFIED") @db.VarChar(30)
  averageMinutes  Int?
  instructionsMd  String? @db.Text
  popularity      Int @default(0)
  isActive        Boolean @default(true)
  deletedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([providerId, actionType, channel])
  @@index([providerId, isActive])
  @@index([actionType, isActive])
}

model PartnerSyncAttempt {
  id               String @id @default(cuid()) @db.VarChar(30)
  eventId          String @db.VarChar(30)
  serviceId        String? @db.VarChar(30)  // NULL: workspace-level (USPS gibi)
  providerActionId String @db.VarChar(30)
  status           String @default("PENDING") @db.VarChar(20)
  openCount        Int @default(0)
  lastOpenedAt        DateTime?
  lastConfirmationAt  DateTime?
  completedAt         DateTime?
  confirmationNumber  String? @db.Text   // encrypted; §C9
  notes               String? @db.Text   // encrypted; §C9
  resultMetadataJson  String? @db.Text
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  // Idempotency: serviceId NULL olabildiği için partial unique gerek. MySQL'de partial index yok,
  // upsert app-level @@unique([eventId, providerActionId]) where serviceId IS NULL mantığıyla yapılır.
  @@unique([eventId, serviceId, providerActionId])
  @@index([eventId, status])
}

// PartnerConsent ve ProviderClaim — D8/D16 Faz 2 iskeletleri. Schema 45/46'da.
```

---

## §C8 — Admin permission modeli (mevcut sisteme adapte)

Doc'larda geçen `provider.actions.write`, `workspace.read` gibi **dotted permission kodları YASAK**. Mevcut `ADMIN_RESOURCES` + CRUD flag modeli kullanılır.

**Yeni resource'lar `ADMIN_RESOURCES` array'ine eklenir**:
```ts
export const ADMIN_RESOURCES = [
  "users", "subscriptions", "reviews", "providers", "state_rules",
  "badges", "documents", "moving_plans", "tickets", "audit_logs",
  "admin_users", "settings", "blog", "acquisition_campaigns",
  // YENİ:
  "workspaces",          // Workspace inspector (50)
  "provider_actions",    // Provider Actions CRUD (51)
  "provider_imports",    // CSV import (52)
  "sync_attempts",       // Quality dashboard (53)
  "provider_claims",     // Partner claim queue (54) — Faz 2'de aktif
] as const;
```

Her resource için existing pattern: `canRead`, `canCreate`, `canUpdate`, `canDelete` flag'leri AdminPermission row'unda. Step-up gerektiren admin action'lar için ayrı `requireStepUp` boolean alanı eklenebilir (Faz 2'ye atılabilir, MVP'de iki-tıklı confirm yeterli).

---

## §C9 — Encryption + PII sınıflandırması

**Mevcut encryption infrastructure**: `packages/shared/src/encryption.ts` — AES-GCM, env'deki `ENCRYPTION_KEY` ile.

**Encrypt zorunlu alanlar**:
- `Service.accountNumber` (mevcut)
- `Service.username` (mevcut)
- `PartnerSyncAttempt.confirmationNumber` (yeni — hesap no içerebilir)
- `PartnerSyncAttempt.notes` (yeni — kullanıcı freeform)
- `UserCustomProvider.contactEmail/Phone/Name` (vendor book)
- `UserCustomProvider.customMailtoBody/PdfNotes` (vendor book, PII içerir)
- `PartnerConsent.tokenEncrypted` (Faz 2 OAuth refresh token)
- `WorkspaceAuthChallenge.challengeHash` (zaten hash — encrypt yok)

**Plaintext OK**:
- Email (zaten User tablosunda plaintext, hash gerekli değil)
- Adres alanları (street, city, state, zip) — birincil ürün verisi, filter/index için gerekli
- Workspace name, member display name

---

## §C10 — Step-up auth gerektiren action'lar (canonical)

D10/D19 + review düzeltmesi:

| Action | Step-up gerekli mi | Purpose enum |
|---|---|---|
| AddressChangeEvent create | ✅ | `ADDRESS_CHANGE` |
| Workspace delete | ✅ | `WORKSPACE_DELETE` |
| Workspace ownership transfer | ✅ | `ROLE_OWNER_CHANGE` |
| Member remove (ADMIN/OWNER target) | ✅ | `MEMBER_REMOVE` |
| Member remove (MEMBER/CHILD/VIEW_ONLY) | — (admin confirm yeterli) | — |
| Role promote to OWNER | ✅ | `ROLE_OWNER_CHANGE` |
| Role demote OWNER | ✅ | `ROLE_OWNER_CHANGE` |
| Role change (other) | — | — |
| Billing downgrade/cancel | ✅ | `BILLING_CHANGE` |
| Billing upgrade | — (Stripe Checkout zaten auth gerekli) | — |
| Tax/Property export | ✅ | `EXPORT` |
| Vendor book bulk delete | ✅ | `VENDOR_BULK_DELETE` |
| Invite send | — (rate-limited) | — |
| Partner sync attempt open | — (event zaten step-up'lı) | — |

**Challenge süresi**: 10 dakika. Single-use (`consumedAt` + `consumedForActionId`).

---

## §C11 — Partner Hub access modeli

D'ye eklenen yeni karar: boolean değil enum.

```ts
type PartnerHubAccess = "none" | "teaser" | "full";

const partnerHubByPlan = {
  FREE_TRIAL: "none",
  INDIVIDUAL: "none",
  FAMILY:     "none",   // MVP karar: teaser değil
  PRO:        "full",
};
```

UI:
- `none`: Partner Hub menü item'i gizli; servis detayda "Update on partner →" butonu yok
- `teaser`: (MVP'de kimse kullanmaz; Phase 2 için açık)
- `full`: tam erişim

---

## §C12 — Address label kararı (Family/Pro her ikisi açık)

D18 düzeltmesi: Family de tüm label'ları kullanabilir.

| Label | Free | Individual | Family | Pro |
|---|---|---|---|---|
| HOME | ✅ | ✅ | ✅ | ✅ |
| DORM | — | — | ✅ | ✅ |
| VACATION | — | — | ✅ | ✅ |
| OTHER | ✅ | ✅ | ✅ | ✅ |
| OFFICE | — | — | — | ✅ |
| RENTAL | — | — | — | ✅ |
| WAREHOUSE | — | — | — | ✅ |

**Pro'nun ayırıcı değeri**: business label'ları (`OFFICE`, `RENTAL`, `WAREHOUSE`) + tax export'ta bu label'larla gruplama.

---

## §C13 — CHILD permission matrisi (canonical)

D22 düzeltmesi: CHILD AddressChangeEvent başlatamaz.

| Action | CHILD yapabilir mi |
|---|---|
| Kendi adresini ekle/düzenle | ✅ |
| Kendi servisini ekle/düzenle | ✅ |
| Workspace içindeki paylaşımlı servisi gör | ✅ (account number hariç, §C9) |
| Diğer üyelerin private services | — |
| Reminder snooze (assigned) | ✅ |
| Reminder mark done (assigned) | ✅ |
| **AddressChangeEvent başlat** | **❌** (MVP) |
| AddressChangeTarget üzerinde partner action launch (kendi assigned) | ✅ |
| Member invite | — |
| Workspace settings | — |
| Billing | — |
| Budget toplam görme | — (sadece kendi servisleri) |

CHILD'in kendi taşınma talebi: Family Owner/Admin'e in-app notification gönderir, Owner/Admin event'i başlatır.

---

## §C14 — Lansman scope (Sliced MVP)

D karar: 6-fazlı sliced approach.

**MVP shipping (8 hafta hedef)**:
- ✅ Phase 0: Decision lock (bu doc + D21+ eklenmesi)
- ✅ Phase 1: Workspace + Member + Invitation foundation
- ✅ Phase 2: Family core (switcher, invite, shared services junction, reminders)
- ✅ Phase 3: AddressChangeEvent + Target + step-up + bulk queue
- ✅ Phase 4: Stripe Family/Pro + pricing page 4 sütun + mobile read-only guard
- ✅ Phase 5: Pro Partner Hub MVP — **10–15 elle curated partner**, ServiceProviderAction registry, SyncAttempt, deep-link launcher
- ✅ Phase 5b: Tax export + address labels + bulk queue (Pro)
- ⏸ Phase 6 (Faz 2 ertelendi): PDF generator, mailto template editor (admin), CSV import, full 100+ partner registry, vendor contact book, partner claim, PartnerConsent active flow

**Partner sayısı**: Lansmanda **10–15 elle yazılmış** (USPS, Amazon, Netflix, Spotify, Apple, Google, AT&T, Verizon, Comcast, Geico, Allstate, Chase, BofA, Capital One, IRS). PDF generator + mailto admin UI Faz 2.

---

## §C15 — Drift düzeltme listesi (doc'lara yamalanacak)

Aşağıdaki doc'lar bu canonical ile çelişiyor, drift fix PR'ında düzeltilecek:

| Doc | Çelişki | Canonical'a göre düzeltme |
|---|---|---|
| 03-workspace-member-roles | Step-up matrisi 16 ile farklı | §C10 kullan |
| 05-workspace-switcher-ui | cookie `lf_active_workspace` | `lf_workspace_id` (§C4) |
| 06-entitlements | Individual EXTENDED tier verir | BASIC only (§C1) |
| 11/12 | Address snapshot yok | `fromAddressSnapshotJson` ekle (§C7) |
| 14/35 | confirmation number encryption | encrypt zorunlu (§C9) |
| 20 | Family limit 17/250/6 vs 25/250/6 | 6/17/250 (§C1) |
| 21/31 | route `/api/billing/checkout` | `/api/stripe/checkout` (§C3) |
| 22 | CHILD SELF event başlatabilir | başlatamaz (§C13) |
| 23 | `assignedUserIds: Text JSON` | `ServiceAssignee` junction (§C7) |
| 30 | Pro limit 50üye/100adres | 10/25/1000 (§C1) |
| 31 | "10→6 inince 2 overflow" | 4 overflow (§C1) |
| 32 | Pro-only label set | Family/Pro split (§C12) |
| 33 | partnerHub boolean | enum 3 değer (§C11) |
| 50/51/52/53/54 | dotted permission kodları | ADMIN_RESOURCES extension (§C8) |
| 60 | mobile auto-render risk | `salesChannel` filter eklenmeli (62 ile birlikte) |
| 61 | hardcoded Individual | data-driven refactor şart (zaten not edilmiş) |
| 62 | `@db.VarChar(20)` plan field | mevcut `@db.VarChar(30)` (§C5) |
| 64 | "one-tap utility updates" copy | guided update language (§Copy guardrails) |

Drift fix tek PR — sadece referansları/değerleri canonical'a sabitler. Yeniden yazım yok.

---

## §C16 — Copy guardrails (otomasyon vaadi yasak)

D15 review düzeltmesi. Aşağıdaki ifadeler yasak:

| Yasak | Onaylı |
|---|---|
| "one-click address sync" | "one-click open & guided update" |
| "auto-sync your address everywhere" | "we prepare, you confirm at each provider" |
| "one-tap utility update" | "open utility portal with address pre-copied" |
| "we update Netflix for you" | "we open Netflix's address page with everything filled" |
| "Verified Sync" badge (anlaşmasız) | "Open in Netflix →" plain button |

Marketing copy + Partner Hub UI bu sınırı kabul eder. **Verified Sync** rozeti sadece imzalı partner anlaşması olduğunda görünür.
