# Address Change Wizard — Web

> **Drift fix 2026-05-23** — Çelişkili değerler [`01a-canonical-values.md`](./01a-canonical-values.md) (§C13) ile geçersizdir. **CHILD wizard'a erişemez** (canonical §C13 / D22 — MVP). Aşağıdaki "CHILD: sadece SELF" davranışı geçersiz; CHILD ScopePicker'a hiç ulaşmadan 403 alır veya sidebar entry'si gizlenir.

- **Status**: Proposed (Family/Pro launch, Sprint 2)
- **Tier**: Family + Pro
- **Related decisions**: D6, D10, D19, D22 (CHILD wizard erişimi yok)
- **Related docs**: [11](./11-address-change-event-model.md), [12](./12-address-change-target-model.md), [14](./14-bulk-queue-dashboard.md), [15](./15-workspace-auth-challenge.md), [16](./16-step-up-auth-flow.md), [35](./35-partner-sync-attempts.md)

## Amaç

Kullanıcının "Taşınıyorum, neyi güncellemem lazım" sorusunu 4 adımda batch operasyonuna çeviren ana akış. Wizard scope (kim/ne taşınıyor) + target (hangi adresler) + service (hangi servisler) + auth (sen misin) sorularını sırayla sorar ve sonunda bir `AddressChangeEvent` + `AddressChangeTarget[]` + `PartnerSyncAttempt[]` (PENDING) yaratır.

Wizard web-only (Sprint 2 — D11 paralel: mobile read-only). Multi-step formdur; her step kendi URL'sine sahiptir (deep-link + browser back desteği), state localStorage'da draft olarak tutulur.

## Kapsam

**In scope**
- 4 step wizard: Scope → Target → Service → Review+Auth
- Address detail sayfasına "Move from here" entrypoint
- Step component'leri
- Step-up auth modal entegrasyonu (→ 16)
- Empty states, loading, error handling

**Out of scope**
- Backend event/target endpoint'leri (→ 11, 12)
- Dashboard sonrası UX (→ 14)
- Mobile wizard (Faz 2)

## User stories

- **As a Family owner**: Sidebar'dan "New Move" tıklarım, kim taşınıyor (ben + eşim) seçer, hedef adresi seçerim, servisleri review eder gönder derim, parolamı sorar, dashboard'a yönlenirim.
- **As an Owner**: Address detail sayfasında "Move from here" tıklarım, wizard `fromAddressId` prefill ile açılır.
- **As a Pro user**: Yazlığı satıyorum, sadece o adres servislerini taşımak istiyorum, ADDRESS scope seçer ve hangi servisler dahil göstereceğim onay verir.

## Veri modeli

Yeni şema yok — wizard 11/12'deki modelleri tüketir.

**Client-side draft state** (localStorage, key `address-change-draft-{workspaceId}`):

```ts
type WizardDraft = {
  step: 1 | 2 | 3 | 4;
  fromAddressId?: string;
  toAddressId?: string;
  scopeType?: 'SELF' | 'MEMBER' | 'ALL_WORKSPACE' | 'CUSTOM';
  selectedMemberIds?: string[];          // MEMBER scope
  selectedAddressIds?: string[];         // CUSTOM by address
  selectedServiceIds?: string[];         // CUSTOM by service
  excludedServiceIds?: string[];         // user opted out
  label?: string;
  notes?: string;
  expiresAt: string;                     // ISO; draft 7d sonra otomatik silinir
};
```

Draft submit edilince temizlenir.

## API endpoint'leri

### Yeni

Yok — wizard 11/12'deki endpoint'leri kullanır. Yalnız bir yardımcı:

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/api/address-changes/preview` | Session | required | `{ fromAddressId?, scopeType, scopeSelection, excludedServiceIds }` | `200 { targets: [...], affectedServices: [...], partnerActionCount }` | 401, 400 |

Preview endpoint commit yapmaz; review step'inde kullanıcıya "X target, Y service, Z partner action yaratılacak" özetini gösterir. Step-up auth gerektirmez.

### Mevcut endpoint'lere etki

- POST `/api/address-changes` — wizard'ın final submit hedefi. authChallengeId zorunlu.
- GET `/api/addresses` — Step 1'de target picker için listelenir.
- GET `/api/workspaces/:id/members` — MEMBER scope'unda member picker için.
- GET `/api/services?addressId=...` — Service picker için.

## Web

### Yeni sayfa/route

- `/address-change/new` — wizard giriş. Query params: `fromAddressId?`, `scope?` (prefill).
- `/address-change/new/scope` — Step 1
- `/address-change/new/targets` — Step 2
- `/address-change/new/services` — Step 3
- `/address-change/new/review` — Step 4 + auth modal

URL'ye step koymak: deep-link paylaşılabilir + browser back natural çalışır.

### Mevcut sayfalara etki

- **`/addresses/[id]`**: Header'a yeni primary button **"Move from here"** (sadece edit yetkisi olanlara). Tıklayınca `/address-change/new/scope?fromAddressId=...`.
- **`/dashboard`**: "Start a move" CTA card (eğer hiç ACTIVE event yoksa).
- **Sidebar nav**: "Moves" item; aktif event sayısı badge.
- **`/onboarding`**: Yeni adım (opsiyonel): "Yakında taşınıyor musun? Şimdi başlat" — wizard'a yönlendir.

### Componentler

Tümü `apps/web/src/components/address-change/`:

- **`<WizardShell>`** — step indicator (1 of 4), back/next butonları, draft autosave (debounced 500ms).
- **`<ScopePicker>`** — 4 radio: Just me / Specific member / Everyone in workspace / Custom selection. Family plan'de "member" görünür, Individual'da disabled+tooltip "Family plan required". `Subscription.plan = INDIVIDUAL` ise sadece SELF + CUSTOM gözükür.
- **`<MemberPicker>`** — MEMBER scope seçilince multi-select chip UI (workspace members list).
- **`<TargetPicker>`** — Step 2. fromAddress (önceden seçilmemişse address dropdown) + toAddress (yeni adres ekleme inline form ile). Eğer scope ADDRESS-bazlı CUSTOM ise multi-address.
- **`<ServiceCheckList>`** — Step 3. Affected services list (auto-tick'li). Her satırda: serviceName, providerName, fromAddressLabel, "X partner actions". User checkbox ile toggle. Filter: by provider, by category. "Select all / none" butonu. Empty state: "No services found at this address — bu adres henüz hiç servisle ilişkilendirilmemiş."
- **`<ReviewSummary>`** — Step 4 üstte. Hangi targets, kaç service, kaç partner action özet kart.
- **`<StepUpChallenge>`** — Submit butonuna basınca açılan modal (→ 16). Component her yerden kullanılabilir; bu wizard'da `purpose=ADDRESS_CHANGE`.
- **`<WizardErrorBoundary>`** — Step yüklenemezse "Draft'ını kaydettik, tekrar dene" mesajı.

### Butonlar / actionlar

| Buton | Yer | Action |
|---|---|---|
| "Move from here" | Address detail header | → wizard Step 1 prefilled |
| "Start a Move" | Dashboard empty card | → wizard Step 1 |
| "Continue" | Her step | client validation + URL push next step + draft save |
| "Back" | Step 2-4 | URL push prev step |
| "Save draft & exit" | Header | localStorage save + redirect /address-change |
| "Submit & start" | Step 4 | Açar `<StepUpChallenge>` modal → success → POST /api/address-changes → redirect /address-change/[id] |
| "Discard draft" | Header menu | localStorage clear + redirect |

### Yüklenme/hata durumları

- Loading: skeleton card (her step için ayrı).
- API hatası (Step 3 service fetch): inline retry button + "Devam et" yine de mümkün (eski draft state).
- Step 4 preview failed: "Servis listesi yüklenemedi" + retry.
- Step 4 submit 403 (challenge expired): modal'ı reset et, yeni challenge iste.
- Step 4 submit 409 (no targets): "Hiç hedef yok, scope/selection'ı yeniden gözden geçir" + Step 2'ye geri yönlendir.
- Step 4 submit 422 (entitlement gate): banner "Family/Pro gerekli" + checkout link.

### Empty states

- No addresses in workspace → wizard Step 1'de "Önce bir adres ekle" CTA.
- No services at fromAddress → wizard Step 3'de "Bu adreste servis yok, sadece event yaratabilirsin (boş)" + warning.

## Mobile

### Yeni ekran

Wizard yok mobile'da Sprint 2'de. Mobile dashboard "Start on web" link gösterir.

### Mevcut ekranlara etki

- `AddressDetailScreen` — "Move from here" butonu **yok** (Faz 2'de eklenir).

### Componentler

- Yok bu doc'ta.

## Admin

### Yeni sayfa

- Yok wizard tarafı; admin sadece 11'deki event listesini görür.

### Yetenekler

- Yok.

## Güvenlik

- [x] **Step-up auth**: Submit (Step 4) zorunlu (D10). Önceki step'ler authenticated session yeterli.
- [x] **PII redaction**: Draft state localStorage'da plaintext (kullanıcı kendi cihazı). Server'a sadece submit'te ID'ler gider. Address/service detayları client tarafında PII zaten kullanıcıya aittir.
- [x] **Audit log**: Sadece submit sonrası 11'deki event create audit'i yazılır. Wizard draft kaydetme audit'lenmez (gürültü).
- [x] **Rate limit**: Submit 10/hour per user (event POST rate limit ile aynı).
- [x] **Permission matris**:
  - Wizard'a giriş: tüm workspace members
  - SELF + CUSTOM(kendi servisleri): tüm members
  - MEMBER scope: OWNER/ADMIN
  - ALL_WORKSPACE: OWNER/ADMIN
  - VIEW_ONLY: wizard erişim yok (route guard)
  - CHILD: **wizard erişimi YOK** (D22 / §C13). UI'da sidebar entry gizli; doğrudan URL ziyareti 403 → /dashboard redirect + toast "Taşınma talebini ailenin Owner/Admin üyesine ilet."
- [x] **Encryption at rest**: Draft localStorage; production'da `crypto.subtle.encrypt` ile workspace-scoped key kullanılabilir (Faz 2, MVP'de düz).
- [x] **GDPR DSAR**: Wizard draft localStorage user-side; "Erase my data" akışında uygulama logout edilirken localStorage clear edilir (`apps/web/src/lib/account-deletion.ts` extend).

## Migration / backward compat

- Yeni route + component'ler; mevcut özelliklerle çakışma yok.
- Feature flag: `FEATURE_ADDRESS_CHANGE_WIZARD` — off ise "Move from here" buton ve sidebar item gizli.

## Etkilenen mevcut özellikler

- Address detail sayfası header değişikliği.
- Sidebar navigation yapısı (Moves item).
- Dashboard widget pozisyonu (Active Move card).
- `apps/web/src/components/address/AddressHeader.tsx` (yeni buton).
- `apps/web/src/components/Sidebar.tsx` (yeni nav item, badge).

## Test plan

**Unit**
- ScopePicker plan gating (INDIVIDUAL'de Family options disabled)
- ServiceCheckList toggle: in/out doğru excludedServiceIds'e yazar
- Draft autosave: 500ms debounce, localStorage yazılır
- Preview endpoint mock'a göre Review özet doğru

**Integration**
- POST /api/address-changes/preview: scope = SELF → caller'ın servisleri target'ları
- POST /api/address-changes: full happy path
- POST 403 challenge expired → UI modal reset

**E2E (Playwright)**
- Owner sidebar → New Move → SELF → existing toAddress → review → submit (mock challenge) → /address-change/[id] yüklenir
- Address detail → Move from here → prefilled fromAddress → continue → submit
- CHILD kullanıcı sidebar New Move entry'sini görmez; doğrudan URL → 403/redirect (D22 / §C13)
- Draft save: 2. step'te tarayıcı kapat, geri aç → draft restore

**Manual**
- Mobile responsive (iPad portrait / phone portrait) — wizard usable mı
- Klavye sadece navigation
- Screen reader: step indicator + step başlığı doğru announce

## Açık sorular

1. Draft expire 7 gün mü 30 gün mü? **Karar önerisi**: 7 gün (bayatlık).
2. Wizard kaydedildikten sonra "Edit" yapılabilir mi? **Karar önerisi**: MVP hayır — event ACTIVE olunca immutable; user istiyorsa new event açar. Faz 2 reconsidered.
3. fromAddress null geçerli mi (kullanıcının hiç önceki adresi yoksa)? **Karar önerisi**: Evet, "Just moved in, no prior address" checkbox.
4. Step 3'te service list 100+ olursa pagination/search? **Karar önerisi**: Search input always, pagination 50+'tan sonra.
