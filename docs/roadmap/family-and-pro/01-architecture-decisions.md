# Architecture Decisions — Family & Pro

- **Status**: Locked. Tüm diğer doc'lar bu dosyaya referans verir.
- **Decision date**: 2026-05-23
- **Participants**: mustafa@axtrasolutions.com, Claude
- **Related**: [`00-README.md`](./00-README.md)

Bu dosya **kararların kaynağıdır**. Bir feature doc'unda bir karar tartışılıyorsa buraya bakılır; tutarsızlık varsa bu dosya kazanır. Yeni bir karar verilirse buraya da eklenir (PR ile).

---

## D1. Workspace tek root, `type` yok

**Karar**: Her kullanıcının en az bir `Workspace`'i vardır. `Workspace.type` (PERSONAL/HOUSEHOLD/PRO gibi) **yoktur**. Plan davranışı `Subscription.plan` üzerinden çıkar.

**Neden**: İki kaynak doğru drift yaratır. Plan upgrade'inde workspace row'unu update etmek zorunda kalırız, downgrade'de orphan veri olur. Subscription tek satırda yaşayınca migration ve audit basitleşir.

**UI etiket**: Plan'dan türetilir:
- `Subscription.plan = FREE_TRIAL | INDIVIDUAL` → "My Move"
- `Subscription.plan = FAMILY` → "Household"
- `Subscription.plan = PRO` → "Workspace" (Pro persona'sı için ileride "Portfolio" denenebilir)

**Etkilenen doc'lar**: 02, 05, 06, 20, 30

---

## D2. Entitlement owner'ın subscription'ından türer

**Karar**: `getEntitlements(workspaceId, callerUserId)` workspace owner'ın subscription'ına bakar, çağıran üyeninkine değil. Family/Pro workspace'i owner öder; üyeler entitlement'ı oradan alır.

**Grace period**: Owner subscription expire olursa **7 gün** boyunca workspace mevcut limit'lerle çalışır. Bu pencerede:
- Üyelere "Your workspace owner's subscription expired" banner
- Yeni invite ve yeni resource creation **kilitli**
- Mevcut resource read + complete-existing **açık**

**Downgrade'de seat overflow**: Owner Pro → Family geçiyorsa ve workspace'te 8 üye varsa:
- Mevcut 8 üye **kick edilmez**
- `WorkspaceMember.status = OVERFLOW` etiketi alır (rolü korunur)
- Yeni invite seat boşalana kadar kilitli
- UI'da "X of 6 active, 2 overflow" mesajı

**Etkilenen doc'lar**: 06, 09, 63

---

## D3. `Service.visibility=PRIVATE` yok, field-level visibility var

**Karar**: Workspace içindeki tüm servisler workspace üyeleri tarafından görülebilir. **Servis seviyesinde** gizlilik yok. Hassas alanlar **field seviyesinde**:

```
Service
+ accountNumberVisibility: WORKSPACE | OWNER_ONLY (default OWNER_ONLY)
+ usernameVisibility:      WORKSPACE | OWNER_ONLY (default OWNER_ONLY)
+ notesVisibility:         WORKSPACE | OWNER_ONLY (default WORKSPACE)
```

Mevcut `Service.accountNumber` zaten encrypted text (`packages/shared/src/encryption.ts`). Visibility flag sadece **gösterip göstermeme** kararı.

**Neden**: PRIVATE service workspace owner/admin'in göremediği kaynak yaratır → destek, audit, billing iptal akışlarında patlar.

**Etkilenen doc'lar**: 03, 23, 50

---

## D4. Plan gating verisi DB'de değil kodda

**Karar**: `ServiceProviderAction.minPlan` gibi alanlar **yok**. Bunun yerine action `tier: BASIC | EXTENDED | PREMIUM` taşır. Hangi plan hangi tier'ı görür kararı:

```ts
// packages/shared/src/entitlements.ts
function actionTierAllowedForPlan(plan: BillingPlan, tier: ActionTier): boolean { ... }
```

**Neden**: Yarın "Family'ye Premium tier aç" kararı verilirse DB row'larını tek tek update etmek yerine kod tek noktada değişir. Audit ve migration kolay.

**Etkilenen doc'lar**: 34

---

## D5. `permissionsJson` yok, sabit rol matrisi var

**Karar**: `WorkspaceMember.role` enum'u: `OWNER | ADMIN | MEMBER | CHILD | VIEW_ONLY`. JSON custom permission alanı yok. Policy matris kodda sabittir.

**Neden**: JSON permission "kim neye nasıl erişti" sorusunu cevaplamayı zorlaştırır, audit kâbusa döner. 5 rol → 5 policy → kodda 1 fonksiyon.

**Faz 3** (lansmandan sonra, talep olursa) custom rol/permission ele alınabilir; **MVP'de yok**.

**Etkilenen doc'lar**: 03, 22

---

## D6. `AddressChangeTarget.targetType` semantik sabit

**Karar**: `targetType: USER | ADDRESS | CUSTOM`. Anlamları:

- **USER**: Bu kişinin tüm servisleri yeni adrese taşınıyor (Family use case)
- **ADDRESS**: Bu fiziksel adrese bağlı tüm servisler değişiyor, kişi fark etmez (Pro use case — yazlık satıldı)
- **CUSTOM**: Kullanıcı manuel checkbox'la N servis seçti

**Etkilenen doc'lar**: 12, 13

---

## D7. `PartnerSyncAttempt` idempotent + open-count

**Karar**:

```prisma
PartnerSyncAttempt
- eventId, serviceId, providerActionId   // @@unique([eventId, serviceId, providerActionId])
- status: PENDING | OPENED | DONE | SKIPPED | FAILED
- openCount: Int @default(0)
- lastOpenedAt, lastConfirmationAt, completedAt
- confirmationNumber, notes, resultMetadataJson
```

Kullanıcı bir partner butonuna N kere basabilir; yeni row değil, **aynı row upsert** edilir, `openCount++`. Status değişimi ayrı timestamp.

**Etkilenen doc'lar**: 35, 36

---

## D8. `PartnerConsent` ayrı tablo, MVP'de schema-only

**Karar**: Faz 2 (gerçek partner API entegrasyonu) için `PartnerConsent` tablosu MVP'de migration ile yaratılır ama hiçbir API çağırmaz. Boş iskelet.

```prisma
PartnerConsent
- workspaceId, userId, providerId
- scopesJson, status (GRANTED|REVOKED|EXPIRED)
- revocationReason: USER_REQUESTED | PARTNER_REVOKED | AUTO_EXPIRED | ADMIN_REVOKED | SECURITY_INCIDENT
- grantedAt, revokedAt
- tokenEncrypted?, tokenExpiresAt?
- consentSnapshotJson
```

**Neden**: Migration'ı şimdi yapmak Faz 2'ye geçişte downtime'sız refactor sağlar. GDPR DSAR cevabı zaten tek noktadan gelir.

**Etkilenen doc'lar**: 45

---

## D9. `WorkspaceInvitation` ayrı tablo, token hashed

**Karar**: `WorkspaceMember`'da `status=INVITED` tutmuyoruz. Davet için ayrı tablo:

```prisma
WorkspaceInvitation
- workspaceId, invitedEmail, role
- tokenHash          // password reset gibi, plaintext asla saklanmaz
- invitedByUserId, expiresAt, acceptedAt, acceptedByUserId, revokedAt
- @@unique([workspaceId, invitedEmail, expiresAt])
```

Davet kabul edilince **yeni** `WorkspaceMember` row'u yaratılır; invitation row'u arşive damgalanır.

**Token**: 32-byte random, base64url. Plaintext sadece email'de gönderilir; DB'de `sha256(token)`.

**Etkilenen doc'lar**: 04

---

## D10. Step-up auth event-level, 10–15 dk pencere

**Karar**: `AddressChangeEvent` create endpoint'inde **fresh auth** zorunlu. Her partner butonunda DEĞİL — sadece event başlatılırken bir kere.

**Pencere**: 10 dakika (DB'de `WorkspaceAuthChallenge.expiresAt`).

**Kullanıcı tipine göre yöntem**:
- Password kullanıcı: password confirm
- MFA aktif kullanıcı: TOTP/SMS code
- OAuth-only kullanıcı: önce "set a password" upsell, fallback email OTP

**Neden**: ATO senaryosunda saldırgan tek tıkla 50 partner'a fraud adresi yayar. Event-level step-up bu vektörü kapatır. Per-button step-up UX katili olur.

**Etkilenen doc'lar**: 15, 16, 18

---

## D11. Mobile read-only entitlement, satış sadece web

**Karar**: Family/Pro satışı sadece web Stripe checkout üzerinden. Mobile:
- Mevcut planı **görür**
- Workspace **değiştirir**
- Davet **kabul eder**
- Partner action **tamamlar**
- Bulk queue **takip eder**
- Family/Pro satın **almaz** → "Upgrade on web" link'i

**Neden**:
- App Store + Play Store her yeni ürün için 1–3 hafta onay süreci; lansman blocker
- Google Play digital subscription için Play Billing zorunlu (harici checkout yönlendirme riski)
- iOS external purchase bölge bazlı, kuralları değişken

**Paralelde hazırlanır** (Faz 2 için): IAP product ID'leri (`com.locateflow.family.{monthly,annual}`, `com.locateflow.pro.{monthly,annual}`) Sprint 1'de App Store Connect + Play Console'a kayıt edilir, satış disabled.

**Etkilenen doc'lar**: 60, 21, 31

---

## D12. iOS active sub varken web upgrade reddedilir

**Karar**: Mevcut iOS Individual aboneliği aktifken kullanıcı web'de Family/Pro checkout başlatamaz. Backend `/api/billing/checkout` endpoint'i `Subscription.provider = APP_STORE` + status active görürse 409 döner, kullanıcıya:

> "Aboneliğiniz App Store üzerinden yönetiliyor. Family/Pro'ya geçmek için önce App Store > Subscriptions'tan mevcut aboneliği iptal edin, expire olduktan sonra burada upgrade edebilirsiniz."

**Neden**: Çift ödeme + senkron problemi. (a) ve (b) alternatifleri (no support / guided cancel UX) Faz 2'ye, MVP'de (c) backend guard yeterli.

**Etkilenen doc'lar**: 17, 60

---

## D13. requireWorkspaceContext route-level helper, Next.js middleware DEĞİL

**Karar**: `requireWorkspaceContext` Next.js `middleware.ts` (edge runtime) değil, **route handler'larda çağrılan async helper** olur. Edge runtime'da Prisma kullanılamıyor.

```ts
// apps/web/src/lib/workspace-context.ts
export async function requireWorkspaceContext(request: Request): Promise<{
  userId: string;
  workspaceId: string;
  memberRole: WorkspaceRole;
  entitlements: ResolvedEntitlements;
  canManageMembers: boolean;
  canRunBulkSync: boolean;
}>
```

Her route handler ilk satırda çağırır.

**Etkilenen doc'lar**: 07

---

## D14. `plan-limits.ts` adapter olarak korunur, atılmaz

**Karar**: `apps/web/src/lib/plan-limits.ts` mevcut helper'lar (`checkAddressLimit` vs.) için **adapter** olarak korunur. Yeni saf plan matrix `packages/shared/src/entitlements.ts`'e taşınır. plan-limits.ts içeride yeni entitlements'i çağırır.

**Neden**: Mevcut çağrı yerleri (web routes, mobile shared) breaking change almasın. Sıfır breakage refactor.

**Etkilenen doc'lar**: 06, 10

---

## D15. Partner Day 1 = sıfır anlaşma, deep-link + PDF + mailto

**Karar**: Lansman partner sync'i hiçbir partner API anlaşması içermez. 100+ servis için:
- Statik partner registry (DB'de seed, repo'da JSON kaynağı)
- "Open & Update →" deep-link + clipboard
- PDF letter generator (doctor's office gibi traditional partner için)
- mailto: template kütüphanesi (eski adres + yeni adres + hesap no prefilled)

**"Verified Sync" rozetı**: Sadece **gerçek API anlaşması** geldiğinde verilir. Day 1'de hiçbir partner bu rozeti taşımaz. Pricing copy'de "100+ services with one-click update" — "auto-sync" yok.

**Paralel BD effort**: USPS Mover's Guide API anlaşması Faz 2'ye, 3–5 büyük partner için BD effort lansman sonrası başlar.

**Etkilenen doc'lar**: 33, 34, 36, 37, 38

---

## D16. Partner Claim MVP'de iskelet, aktif değil

**Karar**: Admin tarafında "Partner Claim Queue" sayfası ve gerekli tablolar yaratılır ama UI **disabled**. "Coming soon" badge'i ile placeholder.

**Neden**: Claim akışı domain verification + business registration + admin onay = ciddi güvenlik iş yükü. Lansman blocker olmamalı. İskelet hazırsa Faz 2'de aktivasyon 2-3 günlük iş.

**Etkilenen doc'lar**: 46, 54

---

## D17. Existing user migration: PERSONAL workspace auto-create

**Karar**: Migration script her mevcut User için:
1. `Workspace` row'u yaratır (name: user.fullName + "'s space", ownerUserId: user.id)
2. `WorkspaceMember` ekler (role=OWNER, status=ACTIVE)
3. `Address`, `Service`, `MovingPlan`, `Budget` row'larını backfill eder (`workspaceId = newWorkspace.id`)

**Dual-read window**: 2 hafta boyunca API routes `WHERE userId = ? OR workspaceId = ?` filtresi kullanır. Sonra workspaceId zorunlu.

**Etkilenen doc'lar**: 09, 10

---

## D18. Address Label sadece UI hint, izolasyon yok

**Karar**: `Address.label: HOME | OFFICE | RENTAL | VACATION | WAREHOUSE | DORM | OTHER`. Bu sadece:
- UI'da etiket
- Filtreleme
- Tax export'ta gruplama anahtarı

İzolasyon (LLC, EIN, ayrı vergi profili) **yok**. Pro'nun Business kısmı bu MVP'de "address etiketi" seviyesinde kalır. Ayrı Business tier Faz 3 (talep olursa).

**Etkilenen doc'lar**: 32, 40

---

## D19. Per-event single auth challenge, multiple status transitions

**Karar**: Bir `AddressChangeEvent` için **bir** `WorkspaceAuthChallenge` consume edilir. Event yaratıldıktan sonra status transitions (DRAFT → ACTIVE → COMPLETED) ek auth istemez. Event archive/cancel için ayrı confirmation (challenge değil).

**Etkilenen doc'lar**: 15, 16

---

## D20. Pricing fixed: Free $0 / Individual $3.99 / Family $9.99 / Pro $19.99

**Karar**:

| Plan | Monthly | Annual |
|---|---|---|
| Free Trial | — | — |
| Individual | $3.99 | $39.99 |
| **Family** | **$9.99** | **$99** |
| **Pro** | **$19.99** | **$199** |

Stripe Prices Sprint 4'te yaratılır. Existing INDIVIDUAL fiyatları **değişmez** (grandfather yok, mevcut müşteriler etkilenmez).

**Etkilenen doc'lar**: 20, 21, 30, 31, 61, 62

---

---

## Review-pass kararları (2026-05-23)

`01a-canonical-values.md` aynı tarihte yazıldı. Aşağıdaki D'ler review sonucu eklendi.

---

## D21. Final plan limit matrisi (TEK kaynak)

**Karar**: Plan limitleri için tek kaynak `01a-canonical-values.md §C1`. Tüm doc'lar oraya referans verir. Drift olan doc'lar fix PR'ında düzeltilir.

**Locked değerler**: FAMILY 6üye/17adres/250svc, PRO 10üye/25adres/1000svc.

**Etkilenen doc'lar**: 03, 06, 20, 22, 23, 24, 25, 30, 31, 32, 60, 61, 62, 63, 64

---

## D22. CHILD AddressChangeEvent başlatamaz

**Karar**: CHILD rolü MVP'de `AddressChangeEvent` başlatamaz. Kendi adres/servis ekleyebilir, assigned reminder kapatabilir, kendi assigned partner attempt'leri tamamlayabilir.

**Neden**: ATO + parental supervision birleşik risk. Çocuğun aile çapında bir taşınmayı tetiklemesi kontrolsüz değişiklik yaratabilir. Phase 2'de CHILD'in Owner/Admin'e "ben taşınmak istiyorum" notification göndermesi planlanır.

**Etkilenen doc'lar**: 03, 11, 13, 22

---

## D23. Partner Hub access enum (boolean değil)

**Karar**: `partnerHubAccess: "none" | "teaser" | "full"`. Plan mapping:
- FREE_TRIAL, INDIVIDUAL, FAMILY → `none`
- PRO → `full`
- `teaser` schema'da yer alır ama MVP'de hiçbir plan kullanmaz (Phase 2 için açık)

**Neden**: Family için teaser tartışması doc'lar arasında çelişiyordu. Boolean ifade edemiyordu. MVP en sade: Family Partner Hub'a hiç erişmez, net upsell.

**Etkilenen doc'lar**: 06, 20, 30, 33, 60, 63

---

## D24. Address label set Family/Pro split

**Karar**: Family `HOME | DORM | VACATION | OTHER` kullanabilir. Pro ek olarak `OFFICE | RENTAL | WAREHOUSE`. Tax export Pro-only çünkü grouping bu Pro-only label'lara dayanır.

**Neden**: D18 (label = sadece UI hint, izolasyon yok) korunuyor. Family'nin DORM ihtiyacı meşru — üniversiteye giden çocuk için. OFFICE/RENTAL/WAREHOUSE pure business etiketleri, Pro'nun ayırıcı değeri.

**Etkilenen doc'lar**: 32, 20, 22, 30, 40

---

## D25. Admin permission `ADMIN_RESOURCES` extension (dotted YASAK)

**Karar**: Doc'lardaki `provider.actions.write`, `workspace.read` gibi dotted permission kodları kullanılmaz. Mevcut `apps/admin/src/lib/admin-permissions.ts` `ADMIN_RESOURCES` array'ine yeni resource'lar eklenir: `workspaces`, `provider_actions`, `provider_imports`, `sync_attempts`, `provider_claims`. Her resource için existing `canRead/canCreate/canUpdate/canDelete` pattern korunur.

**Neden**: Mevcut admin auth modeli + AdminPermission tablosu CRUD-based. Yeni dotted model paralel infrastructure gerektirir, gereksiz. Adapter daha düşük riskli.

**Etkilenen doc'lar**: 50, 51, 52, 53, 54

---

## D26. Checkout route mevcut `/api/stripe/checkout` genişletilir

**Karar**: Yeni `/api/billing/*` namespace AÇILMAZ. Mevcut `POST /api/stripe/checkout` body'ye `plan: "individual"|"family"|"pro"` + `interval: "monthly"|"yearly"` eklenerek genişler. `/api/stripe/portal` ve `/api/webhooks/stripe` dokunulmaz.

**Neden**: Yeni namespace creating breaking redirect maintenance + mobile shared client değişiklik gerektirir. Genişletme sıfır breaking change.

**Etkilenen doc'lar**: 21, 31, 60, 61

---

## D27. PartnerSyncAttempt confirmation/notes encrypt zorunlu

**Karar**: `PartnerSyncAttempt.confirmationNumber` ve `notes` `Service.accountNumber` ile aynı encryption pattern (`packages/shared/src/encryption.ts`). 14 ve 35 doc'larında çelişen tutum vardı; doğru olan encrypt etmek.

**Neden**: Confirmation # genelde hesap no veya partner-side reference; notes ise freeform kullanıcı girdisi (PII içerebilir). DSAR/breach risk için encrypt at rest standardı.

**Etkilenen doc'lar**: 14, 35

---

## D28. Lansman scope = Sliced MVP (6-fazlı)

**Karar**: Orijinal 8-haftalık paralel scope yerine 6-fazlı sliced delivery. Phase 6 (PDF generator, mailto editor, CSV import, full 100+ partner registry, vendor contact book, partner claim active, PartnerConsent active flow) **Faz 2'ye ertelenir**.

**Lansman partner sayısı**: 10–15 elle curated (USPS, Amazon, Netflix, Spotify, Apple, Google, AT&T, Verizon, Comcast, Geico, Allstate, Chase, BofA, Capital One, IRS).

**Neden**: Review'da yakalanan agresiflik. MVP sliced yapı her phase'de testable çıktı sağlar, regresyon riski düşer.

**Etkilenen doc'lar**: 00, 33, 34, 37, 38, 39, 45, 46, 52

---

## Karar ekleme protokolü

Yeni bir mimari karar verildiğinde:
1. Bu dosyaya `D<n>` olarak eklenir
2. `Etkilenen doc'lar` listesi yazılır
3. Etkilenen doc'lar PR ile güncellenir
4. Sayısal/string değerler `01a-canonical-values.md`'ye de yansır
5. PR review en az 1 onaylı kişi gerektirir
