# Workspace (Family/Pro) — Teşhis, Tasarım ve Yol Haritası

**Tarih:** 2026-06-06
**Kapsam:** Free / Individual / Family / Pro planlarının vaat-vs-teslimat analizi; özellikle Family/Pro **Workspace (household)** özelliğinin neden mobil/web'de görünmediği, en mantıklı yönetim modeli, rol bazlı görünüm ve admin görünürlüğü.
**Yöntem:** 5 paralel ajanla doğrudan koddan inceleme (mobile + web + admin + entitlements + veri modeli). Tüm bulgular `file:line` ile kanıtlı. Kod değiştirilmedi.

---

## 0. Özet (TL;DR)

- Family/Pro'da (Pro'da bile) workspace görünmemesinin sebebi **bir plan/entitlement bug'ı değil**, tek bir master flag'in kapalı olması: **`WORKSPACE_MODEL_ENABLED` (default OFF)**.
- Flag hiçbir env dosyasında yok ve admin runtime-config kataloğunda da yok → her `/api/workspaces*` route'u **404** dönüyor → mobil/web "coming soon" gösteriyor.
- **İyi haber:** mobil ekran, web ekranı, 23 API route'u, rol matrisi ve seat enforcement **zaten yazılmış**. Sorun kod değil; flag + okuma-scoping + görünürlük.
- **Tek başına flag açmak yetmez:** (a) mevcut Family/Pro kullanıcılarının `WorkspaceMember` satırı yok (backfill gerekir), (b) domain okumaları hâlâ `userId`-scoped, `workspaceId`-aware değil → üyeler birbirinin verisini görmez. Ekibin kendi punchlist'i bunu **GA-blocker** işaretlemiş.
- **Admin tarafında sıfır workspace farkındalığı var** — "kim ne girdi / kaç üye" için bugün veri yolu yok.

---

## 1. Kök neden: neden görünmüyor

`WORKSPACE_MODEL_ENABLED` master flag'i, tüm workspace alt sistemini kapatıyor.

```
// apps/web/src/lib/workspace-context.ts:57-61
/** Master flag. Default OFF — the whole workspace model stays inert. */
export async function isWorkspaceModelEnabled() {
  const value = (await getRuntimeConfigValue("WORKSPACE_MODEL_ENABLED")) ?? process.env.WORKSPACE_MODEL_ENABLED ?? "";
  return value === "true" || value === "1";
}
```

- **Env'de yok:** `.env.example`, `.env.production.example`, `.env.docker`, `.env.local` → 0 eşleşme. Yani prod'da `""` → `false`.
- **Runtime-config kataloğunda yok:** `packages/shared/src/runtime-config.ts` içindeki `RUNTIME_CONFIG_DEFINITIONS`'ta tanımı yok → admin Feature Flags ekranından **toggle edilemiyor** (DB'ye yazılsa bile `isRuntimeConfigDbBackedKeyAllowed(definition)` undefined definition'ı reddediyor). Sadece env/deploy ile açılabiliyor.
- **Route gate:** `apps/web/src/lib/workspace-routes.ts:12-17` → flag kapalıyken `workspaceFeatureGate()` her route'ta `404` döndürüyor.
- **Mobil davranış:** `apps/mobile/app/settings/workspace.tsx:104-110` → 404 (veya herhangi bir hata + data yok) → `featureOff=true` → satır 309-310 "Shared household workspaces … rolling out for Family & Pro — coming soon".
- **Plan sadece sonra devreye giriyor:** `apps/web/src/app/api/workspaces/route.ts:57-59` → workspace **oluşturmak** için FAMILY/PRO şart, ama bu yalnızca flag açıkken anlamlı.
- Son commit `4065bf54` bunu doğruluyor: "workspace 'not available' mesajı Pro kullanıcılara hesap hatası gibi görünüyordu; artık 'Family & Pro için yakında' diyor" — yani ekip farkında ama sadece **copy** yumuşatmış, özelliği açmamış.

### İkincil engeller (flag flip'i tek başına çözmez)
1. **Provisioning de flag-gated:** `apps/web/src/lib/workspace-provisioning.ts:28` → `ensureWorkspaceDefaults` flag kapalıyken erken `return`. Mevcut Family/Pro hesaplarının `Workspace`/`WorkspaceMember` satırı yok → flag açılsa bile `GET /api/workspaces` boş liste döner. **Backfill** (`packages/db/prisma/migrate-to-workspaces.ts`) çalışmalı.
2. **Domain okumaları workspace-aware değil:** `requireWorkspaceContext` "tested, unused" (`workspace-context.ts:10-11`); `resolveWorkspaceDataScope` flag kapalıyken `legacyDataScope`'a düşüyor. `GET /api/addresses` ve `/api/services` `{userId}` ile filtreliyor (`workspaceId` opsiyonel param). Yani okuma scoping'i `userId`'den `workspaceId`'ye geçmeden **paylaşım gerçekten çalışmaz**. (`docs/strategy/00-engineering-punchlist.md:51-54` GA-blocker.)

---

## 2. Bugün zaten yazılmış olanlar (kod hazır, uykuda)

| Katman | Durum | Kanıt |
|---|---|---|
| Mobil workspace ekranı (üye/rol/davet/transfer/leave/rename/managed-sync, seat sayacı) | ✅ Tam | `apps/mobile/app/settings/workspace.tsx:65-498` |
| Web `/settings/workspace` sayfası | ✅ Tam | `apps/web/src/app/(app)/settings/workspace/page.tsx:49,503` |
| `/api/workspaces/*` backend (23 dosya + testler) | ✅ Tam | `apps/web/src/app/api/workspaces/route.ts` + alt route'lar |
| Rol matrisi `can(role, action, ctx)` | ✅ Production kalitesinde | `packages/shared/src/permissions.ts:73,118` |
| Data-scope katmanı (10 domain route'una bağlı; budget household-aware) | ✅ Var ama inert | `apps/web/src/lib/workspace-data-scope.ts:43`; `api/budget/route.ts:151` |
| Seat enforcement (concurrency-safe invite, downgrade reconcile) | ✅ Çalışıyor | `api/invitations/[token]/accept/route.ts:43-46`; `lib/workspace-ownership.ts:117-164` |
| Veri modeli (Workspace/Member/Invitation + `workspaceId`) | ✅ Tam | `packages/db/prisma/schema.prisma:1957,1987,2025` |
| Davet deep-link landing (mobil) | ✅ Var (flag'den bağımsız, `/api/invitations`) | `apps/mobile/app/invitations/[token].tsx:50,65` |

**Roller (zaten tanımlı, iyi tasarlanmış):** OWNER / ADMIN / MEMBER / CHILD / VIEW_ONLY
- OWNER: rename/delete/billing/promote/transfer (owner-only)
- ADMIN: davet + MEMBER/CHILD/VIEW_ONLY üzerinde remove/changeRole
- MEMBER: kendi kayıtlarını ekle/düzenle, household veri + bütçe gör
- CHILD: sadece kendisi, **finansal görünüm yok** ("no financial visibility" vaadi)
- VIEW_ONLY: salt okunur
(`permissions.ts:15,112-118`)

---

## 3. Plan-bazlı vaat vs teslimat

| Plan | Vaat (billing.ts) | Bugün teslim |
|---|---|---|
| **FREE_TRIAL** | 2 adres / 10 servis, temel checklist | ✅ birebir (limit 2/10, seat 1) |
| **INDIVIDUAL** | 10/100, hatırlatmalar, custom provider, smart checklist, CSV/PDF export | ✅ tam (limit 10/100, seat 1) |
| **FAMILY** | 6 üye, 17/250, **paylaşılan adres/servis, household budget, ortak hatırlatma, child hesap**, export | ⚠️ Sadece **solo limitler** (17/250, seat 6) canlı. Tüm çok-üyeli household vaatleri yazılı ama **flag-OFF** |
| **PRO** | 10 üye, 25/1000, Family + Partner Hub + tax/property export | ⚠️ Solo limitler + capability'ler (partnerHub/advancedExport/apiConnectors) canlı; **household vaatleri flag-OFF** |

Kaynaklar: `packages/shared/src/billing.ts:89-130`, `packages/shared/src/workspace-entitlements.ts:27-49`, `apps/web/src/lib/plan-limits.ts:18-38`, `packages/shared/src/entitlement.ts`.

> **Sonuç:** Family/Pro alan kullanıcı bugün **ödediği çok-üyeli household'u alamıyor** — yüksek solo limitleri alıyor. Bu, daha önceki "documents/snap a bill" copy sorunları gibi gerçek bir **vaat/iade/güven riski**.

**Not (kafa karışıklığı kaynağı):** `plan-limits.ts:115-121` — accessType `FREE_ACCESS`/`FREE_TRIAL` olan bir hesap, subscription.plan FAMILY/PRO olsa bile FREE_TRIAL limitlerine çekiliyor (kasıtlı). Admin bir planı `FREE_ACCESS` olarak verirse, "Pro hesabım free gibi davranıyor" algısı doğar — bu, flag'den ayrı ikinci bir tuzak.

---

## 4. Admin görünürlüğü: bugün sıfır

- **Workspaces menüsü yok** (`apps/admin/src/lib/admin-nav.ts:59-106`), workspace listesi yok, üye sayısı yok, rol yok.
- User-detail API'si **hiçbir workspace ilişkisi yüklemiyor** (`apps/admin/src/app/api/users/[id]/route.ts:291-430`) → bir Pro hesabı admin'de bir Individual'dan **plan etiketi dışında ayırt edilemiyor**.
- Admin FAMILY/PRO planı **verebiliyor** (`SUBSCRIPTION_PLAN_VALUES`, `user-detail-client.tsx:73-76`) ama sonucu (üyeler, koltuk kullanımı) göremiyor.
- **"Kim ne girdi" için veri yolu yok:** kayıtlarda sadece `userId` var (`userId`'den ayrı `createdBy` yok); **workspace activity/audit log yok** (`AuditLog`'da `workspaceId` kolonu yok). Yani "kim neyi ne zaman ekledi/değiştirdi/sildi" bugün çıkarılamaz. (`schema.prisma:432-441,486-492,603-609,996-1012`)
- Admin analitiğinde plan/workspace boyutu yok (`api/analytics/route.ts:93-167`).

---

## 5. Önerilen tasarım

### 5.1 Yönetim modeli (zaten doğru — `can()` matrisi)
Bir workspace = bir household. Owner (planı ödeyen) + davet edilen üyeler; yukarıdaki 5 rol. Her kayıt bir üye tarafından oluşturulur (`userId`), workspace'te yaşar (`workspaceId`). "Kim ekledi" = `userId → member` join'i (yöneticilere gösterilir). Child hesaplar finansalı görmez; view-only salt okunur.

### 5.2 Görünüm (UX)
- **Mobil:** Dashboard'a **"Household" kartı** (üye avatarları, "X/Y koltuk", "Yönet" → mevcut workspace ekranı), **entitlement.plan = FAMILY/PRO**'ya gated. 6. bottom-tab eklemek yerine bu daha temiz; Ayarlar satırı ikincil kalır. Individual/Free'de ölü satır yerine **upsell**.
  - Mobil zaten plan'ı biliyor: `apps/mobile/app/(tabs)/index.tsx:70-73` `res.data.entitlement.plan`.
- **Web:** Dashboard household kartı + sidebar workspace switcher (`docs/roadmap/family-and-pro/05` henüz yapılmamış).
- **Her iki tarafta:** rol bazlı affordance'lar local helper yerine paylaşılan `can()`'dan sürülmeli (web sayfası şu an local `isManagerRole` kullanıyor — drift riski).

### 5.3 Admin
- Yeni **"Workspaces"** bölümü: liste (owner, plan, üye sayısı, koltuk kullanımı) + detay (rol/durum/katılım/son-aktivite roster + bekleyen davetler + "kim ekledi" attribution).
- `memberCount` zaten hesaplanıyor (`api/workspaces/route.ts:40`); seat limiti `seatLimitForPlan(plan)` (`workspace-entitlements.ts`).
- Plan/workspace analitiği: `subscription.groupBy({ by: ['plan'] })` + ortalama household boyutu.

---

## 6. Yol haritası (efor tahminli)

- **Faz 0 — Toggle'lanabilir + dürüst yap (S):**
  - `WORKSPACE_MODEL_ENABLED`'i `RUNTIME_CONFIG_DEFINITIONS`'a ekle (admin toggle) + env örneklerine ekle.
  - Mobil `featureOff` tespiti: 404'ü geçici/network hatasından ayır (flaky bağlantı "coming soon" göstermesin).
  - Seat-count semantiğini hizala (display tüm üyeleri sayıyor; enforcement ACTIVE/non-SUSPENDED sayıyor).
  - *Özelliği açmaz; altyapıyı hazırlar.*
- **Faz 1 — Gerçekten aç (M/L):**
  - Backfill çalıştır (mevcut Family/Pro'ya `Workspace` + OWNER `WorkspaceMember`).
  - `/api/addresses`, `/api/services`, `/api/budget` okumalarını workspace-aware yap (dual-read; `requireWorkspaceContext` devreye).
  - Flag'i aç → **üyeler gerçekten paylaşır.**
- **Faz 2 — Yüzeye çıkar (M):** dashboard household kartı (mobil+web), entitlement-gated; sidebar switcher (web); rol bazlı görünüm `can()`'dan; `workspace.*` i18n anahtarları (şu an inline default).
- **Faz 3 — Admin görünürlüğü (M/L):** Workspaces admin bölümü + per-record attribution + analitik; `Service.sensitiveVisibility` kolonu (field-level OWNER_ONLY/WORKSPACE matrisini gerçek yapmak için) + opsiyonel `WorkspaceActivity` audit log.

---

## 7. Açık riskler / kararlar
1. **Flag flip'i ≠ özellik açık.** Backfill + workspace-aware okuma yapılmadan üyeler veri paylaşamaz; bu yüzden "sadece env'e true yaz" yapma.
2. **Seat sayımı tutarsızlığı** kullanıcıya yanlış "x/limit" gösterebilir (OVERFLOW üye şişiriyor).
3. **Field-level görünürlük kolonu yok** (`Service.sensitiveVisibility`) → child finansal gizleme paylaşılan serviste şimdilik sadece matris-seviyesinde.
4. **Attribution geçmişi yok** (`createdBy`/`updatedBy`/activity log yok) → admin "kim ne zaman değiştirdi" için yeni model gerekir.

---

## 8. Ana dosya referansları
- Flag/gate: `apps/web/src/lib/workspace-context.ts`, `apps/web/src/lib/workspace-routes.ts`, `apps/web/src/lib/workspace-provisioning.ts`
- API: `apps/web/src/app/api/workspaces/route.ts` (+ alt route'lar), `api/invitations/[token]/accept/route.ts`
- Roller/entitlement: `packages/shared/src/permissions.ts`, `packages/shared/src/workspace-entitlements.ts`, `packages/shared/src/entitlement.ts`, `apps/web/src/lib/plan-limits.ts`, `packages/shared/src/billing.ts`
- Data-scope/ownership: `apps/web/src/lib/workspace-data-scope.ts`, `apps/web/src/lib/workspace-ownership.ts`
- Mobil: `apps/mobile/app/settings/workspace.tsx`, `apps/mobile/app/(tabs)/more.tsx:104`, `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/(tabs)/index.tsx`
- Web UI: `apps/web/src/app/(app)/settings/workspace/page.tsx`, `apps/web/src/app/(app)/dashboard/page.tsx`, `apps/web/src/components/layout/sidebar.tsx`
- Admin: `apps/admin/src/lib/admin-nav.ts`, `apps/admin/src/app/api/users/[id]/route.ts`, `apps/admin/src/app/api/analytics/route.ts`
- Şema: `packages/db/prisma/schema.prisma` (Workspace 1957, WorkspaceMember 1987, WorkspaceInvitation 2025; Address/Service/MovingPlan/Budget `workspaceId` 432/486/559/603)
- Runtime config: `packages/shared/src/runtime-config.ts`, `apps/web/src/lib/runtime-config.ts`
- Punchlist: `docs/strategy/00-engineering-punchlist.md:51-54`
