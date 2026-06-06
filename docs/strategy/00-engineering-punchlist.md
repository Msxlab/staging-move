# LocateFlow — Doğrulanmış Mühendislik Punchlist'i

> Bu liste, eski audit raporlarındaki maddelerin **güncel kaynak koda göre tek tek doğrulanmış** halidir.
> Eski raporlar karışık tarihli; içlerindeki birçok "kritik" madde daha önceki commitlerde zaten kapatılmış.
> Aşağıda "zaten çözülmüş" ile "gerçekten açık" ayrı tutulur.

Tarih: 2026-06-04 · Yöntem: güncel `apps/`, `packages/` kaynak kodunun okunması (audit md'lerine güvenilmedi).

---

## A) ZATEN ÇÖZÜLMÜŞ — tekrar uğraşma (kanıtlı)

Eski raporlardaki şu "P0/P1" maddeler güncel kodda **kapalı**. Vakit kaybetme:

| Eski iddia | Durum | Kanıt (dosya) |
|---|---|---|
| Mobil auth middleware uyumsuz (Bearer kabul edilmiyor) | ✅ ÇÖZÜLDÜ | `apps/web/src/middleware.ts` (Bearer header parse) + `apps/web/src/lib/user-auth.ts` |
| `DELETE` ile üye silme endpoint'i yok | ✅ ÇÖZÜLDÜ | `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts` (DELETE + yetki kontrolü) |
| Connector rate-limit'leri enforce edilmiyor | ✅ ÇÖZÜLDÜ | `apps/web/src/lib/connector-runtime.ts:211-239` (`perConnectorPerMinute`, `perUserPerDay` enqueue'da sayılıyor) |
| Cron endpoint'leri `CRON_SECRET` yoksa fail-open | ✅ ÇÖZÜLDÜ | `apps/web/src/lib/cron-guard.ts` + `internal-secrets.ts` (header yoksa `false`, fail-closed; 18 cron route guard'lı) |
| Admin login'de brute-force koruması yok | ✅ ÇÖZÜLDÜ | `apps/admin/src/app/api/auth/login/route.ts` (5 deneme/15dk, 30dk lockout, `RateLimitLog`) |
| Dev/NODE_ENV auth bypass | ✅ YOK | `apps/web/src/lib/user-auth.ts` — auth yolunda bypass bulunamadı |
| Sınırsız workspace açma (seat bypass) | ✅ ÇÖZÜLDÜ | `apps/web/src/app/api/workspaces/route.ts:65-76` (`MAX_OWNED_WORKSPACES = 3`) |
| Eksik mobil ekran: `providers/[id]`, `budget/new` | ✅ VAR | `apps/mobile/app/providers/[id].tsx`, `apps/mobile/app/budget/new.tsx` |

**Not:** "SQLite production'a uygun değil" gibi maddeler de geçersiz — güncel kurulum **Prisma + MySQL (Docker)**. Eski raporu kullanırken bunu unutma.

---

## B) GERÇEKTEN AÇIK — düzelt (kanıtlı)

### B1 · [P2] "Hayalet alan" `t.completed` mantık hatası
Şema `MoveTask`'ta `completed` adında bir boolean **yok** — `status: String` (`"COMPLETED"`) ve `completedAt` var.
- `apps/web/src/app/(app)/moving/[id]/page.tsx` **doğru** yapıyor: `task.status === "COMPLETED"`.
- AMA şu iki dosya olmayan `t.completed` alanını filtreliyor → set hep boş → tamamlanan task şablonları "servisler" ekranında hiç işaretlenmiyor (crash yok, **sessiz yanlış davranış**):
  - `apps/web/src/app/(app)/services/services-client.tsx:136-138`
  - `apps/mobile/app/(tabs)/services.tsx` (aynı kalıp)
- **Fix:** `t.completed` → `t.status === "COMPLETED"`. ~10 dakikalık, iki dosya. Bir test ekle.

### B2 · [KAPSAM DIŞI → temizlik] "review/rating" özelliği üründe OLMAMALI
Ürün kararı (2026-06-04): review/rating özelliği ne web'de ne mobilde olmayacak.
- Yapısal durum: **review DB modeli YOK, `/api/reviews` endpoint'i YOK** → canlı özellik değil.
- Mobilde `reviews/new` ekranının olmaması **doğru**; hiçbir yer oraya yönlendirmiyor → **crash riski yok** (eski audit'in "P1 crash" iddiası yanlıştı).
- Ama **ölü iskele kalmış, temizlenmeli** (canlı risk yok, sadece tutarlılık):
  - `apps/web/src/lib/validators.ts` → `reviewSchema` (+ `__tests__/validators.test.ts`)
  - `apps/admin/src/lib/ai-moderation.ts` → rating/review tutarlılık mantığı (satır 109, 193)
  - `apps/web/src/i18n/messages/{en,es}.json` + mobil i18n → `rating` / "Overall rating" string'leri
  - `apps/web/src/app/(app)/services/new/page.tsx`, `apps/mobile/app/custom-providers/[id].tsx` → olası rating/review input (doğrula)
- **Aksiyon:** Önce `reviewSchema` import'larını kontrol et (ör. `custom-providers` route), sonra güvenle kaldır + test çalıştır.

### B3 · [P3, flag-gated] Domain API'leri `userId` bazlı, `workspaceId` opsiyonel
`GET /api/addresses`, `GET /api/services` listelemeleri `{ userId, deletedAt: null }` ile filtreliyor; `workspaceId` opsiyonel parametre.
- `WORKSPACE_MODEL_ENABLED` flag'i **kapalı** olduğu sürece sorun değil.
- Ama Family/Pro Workspace'i GA'ya almadan önce, bir workspace üyesinin paylaşılan adres/servisleri görmesi için domain listelemelerinin `workspaceId` farkındalığı **gözden geçirilmeli**. GA-blocker, şimdi acil değil.

---

## C) OPERASYONEL / UYUMLULUK KAPILARI — kod bug'ı değil ama go-live'ı bloklar

| Madde | Neden önemli | Aksiyon |
|---|---|---|
| Stripe API `2025-04-30.preview` pinli | `preview` kanalı → ileride deprecate edilebilir | GA'ya terfi / deprecation için alarm kur; stable'a geçiş notu bırak (`stripe-api-version.ts`) |
| Stripe staging kataloğu eksik (6 üründen 1'i görünür) | Tam plan-değişim matrisi (9×2) staging'de test edilemiyor | Eksik test ürünlerini Stripe test-mode'da oluştur |
| `NEXT_PUBLIC_LEGAL_ENTITY_NAME` / `NEXT_PUBLIC_COMPANY_ADDRESS` placeholder | App Store / Play submission reddolur | Gerçek tüzel kişi adı + posta adresini prod env'e gir |
| `QA_RESETTABLE_ACCOUNT_EMAIL` DigitalOcean'da set değilse | Play test satın almaları reddolur (allowlist) | Env'i deploy ortamında doğrula |
| `@sentry/react-native` native crash capture yok | Native RN çökmeleri yakalanmayabilir | v2 backlog'a al (v1 için kabul edilebilir, dokümante et) |

---

## D) REPO HİJYENİ — ✅ YAPILDI (2026-06-04)
Kökteki **14 loose rapor dosyası** mevcut **`reports/`** klasörüne taşındı (yeni `docs/reports/` AÇILMADI — repo zaten `reports/` kullanıyor):
`advanced-system-audit-report.{html,md,pdf,txt}`, `AUDIT_REMAINING_WORK.md`, `AUDIT_REPORT.md`, `AUDIT_REPORT_MERGED.md`, `AUDIT_REPORT_MOBILE_PARITY.md`, `commit-by-commit-review-feat-connector-workspace.md`, `COMMIT_AUDIT_RECHECK_104.md`, `COMMIT_AUDIT_TASK_98.md`, `SISTEM_INCELEME_RAPORU.md`, `SYSTEM_MODULE_AUDIT_TASKLIST_TR.md`, `rol-sen-k-demli-bir-fuzzy-curry.md`.
- Kökte **bilerek bırakılanlar** (rapor değil): `README.deploy.md`, `RELOCATION_MANAGER_SPEC.md` (spec), `SYSTEM_STATUS.md` (status — istenirse taşınır).
- **Commit edilmedi** — staged/working tree'de; gözden geçirip commit edebilirsin.

---

## ÖZET
- Eski audit listesinin ~%85'i **zaten kapatılmış**. Ekibin mühendislik disiplini iyi.
- Gerçek açık iş: **1 sessiz mantık hatası (B1)** + **1 eksik mobil ekran (B2)** + **birkaç operasyonel/uyumluluk kapısı (C)**.
- Faturalamayı daha fazla cilalamadan önce B1 ve B2'yi kapat, sonra C'deki go-live kapılarını geç.
