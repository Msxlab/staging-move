# Master Yol Haritası — 3 Track (web / mobile / admin / 3rd-party + paneller)

> Bütün resmi tek yerde, yüzey yüzey. Track 1 = consumer app'i çıkar (gelir zemini). Track 2 = partner + SOC2 (uzun pole, bugün başlar). Track 3 = Katman 4 platform sertleştirme (çok-partner ağ).

---

## TRACK 1 — Consumer tabanını ÇIKAR (ne demek, tam olarak)

**Yanlış anlaşılma:** Track 1 yeni özellik değil. App **şu an App Store / Play / Stripe'a çıkış sürecinde** (son 30 commit bunun kanıtı: faturalama + store submission). Track 1 = o çıkışın **son boşluklarını kapatmak**, scope eklemeden. Neden önce bu? **Kullanıcısı olan canlı app olmadan ne gelir var ne de partnerlere gösterecek traction.**

| # | İş | Yüzey | Nerede (dosya/yer) | Nasıl | Sahip |
|---|---|---|---|---|---|
| T1.1 | AddressChangeEvent'i uygula + doğrula | db, web | `packages/db` migration, `connector-runtime.ts` | `migrate:deploy` → `generate` → `smoke-connector-dispatch.ts` koş | eng |
| T1.2 | **B1** (`t.completed` hayalet alan) | web + mobile | `services/services-client.tsx`, mobil `(tabs)/services.tsx`, `dashboard-client.tsx` | `t.completed` → `t.status==="COMPLETED"`; templateId kaynağını (metadata?) doğrula; test ekle | eng |
| T1.3 | Operasyonel/uyumluluk kapıları | web + mobile (+ ops) | env + Stripe dashboard + store console | aşağıda | you/ops/legal |
| T1.4 | Final QA + submit | web + mobile | staging | plan-matrix (36) + mobil auth akışları + submit | eng/you |

**T1.3 kapıları (store submission'ı blokluyor):**
- `NEXT_PUBLIC_LEGAL_ENTITY_NAME` + `NEXT_PUBLIC_COMPANY_ADDRESS` → gerçek değer (DigitalOcean). Yüzey: web + mobil legal sayfaları.
- Stripe **test-mode**: eksik 5 ürünü oluştur (Family M/Y, Pro M/Y, Individual M) → tam plan-matris E2E açılır.
- `QA_RESETTABLE_ACCOUNT_EMAIL` → DigitalOcean'da set (Play test satın alma).
- App Store: demo cred (out-of-band) + App Privacy formu. Play: RTDN + internal build upload.

**Panel:** Track 1 için **yeni panel yok** — mevcut yüzeyleri bitiriyorsun.
**Çıktı:** `09-go-live-checklist.md` (kim/ne/nerede).

---

## TRACK 2 — Partner + SOC2 (uzun pole, BUGÜN başlar)

| # | İş | Yüzey | Nerede | Nasıl | Sahip |
|---|---|---|---|---|---|
| T2.1 | Partner outreach | 3rd-party | e-posta + basit tracking | Lob + insurtech + Arcadia'ya gönder (`10-partner-emails.md` hazır) | you/BD |
| T2.2 | SOC 2 Type II | süreç | Vanta/Drata | scope + evidence; ~6-12 ay | you |
| T2.3 | DPA (partner başına) | hukuk | şablon (`07`) | her imzalı partner için | legal |

**3rd-party panel sorusu (senin sorun):**
- **Pilotlarda panel GEREKMEZ** — sen onların API'sine entegre olursun (Lob API-key, Arcadia OAuth, insurtech lead API). Tek yönlü.
- **İleride (3+ partner ya da partner raporlama isterse) → Partner Portal.** Tasarım:
  - **Nerede:** önce **admin içinde `PARTNER` rollü bir bölüm** (hızlı), self-serve gerekince ayrı app `apps/partner` → `partners.locateflow.com`.
  - **Ne içerir:** partner login, **sandbox API key**, kendi connector'larının dispatch log'ları (redacted), connector health/metrics, webhook setup, DPA durumu, rollout/stage (read-only).
  - **Ne zaman:** Track 3 sonrası, talep gelince. Şimdi DEĞİL.

---

## TRACK 3 — Katman 4 platform sertleştirme (1 → çok-partner)

Yüzey yüzey, doc 04/05'teki G2-G8 + kullanıcıya görünür ödül (status timeline).

| Gap | İş | db | connectors (pkg) | web | mobile | admin |
|---|---|---|---|---|---|---|
| **G2** | Dry-run / SHADOW | — | `types.ts` (`ctx.dryRun`), `executor.ts` | `connector-runtime.ts` (SHADOW→dispatch dry-run, shadow status) | — | shadow sonuçları göster |
| **G3** | Fallback 2.0 | `ConnectorFallbackAction` tablosu | — | renderer + connections UI | connections parity (fallback buton) | **fallback editor (yeni panel)** |
| **G4** | Metrics/observability | `ConnectorMetric` tablosu | (executor hook) | cron aggregator | — | **metrics dashboard (yeni panel)** |
| **G5** | Async confirm testi | — | mock async connector | webhook path E2E test | — | — |
| **G6** | Token refresh lock | (lock satırı) | — | `connector-oauth.ts` distributed lock | — | — |
| **G7** | Reconsent UI | — | — | connections: 1-tık yeniden bağla | aynısı (parity) | — |
| **G8** | Admin circuit + stale-SUBMITTED sweep | — | — | dispatch worker sweep | — | **manuel circuit trip/reset** |
| **★** | **Adres-değişim status timeline** (G1'in görünür ödülü) | (AddressChangeEvent — DONE) | — | connections: connector-bazlı durum (queued/submitted/confirmed/needs-you) | aynısı (parity) | **AddressChangeEvent inspector** |

> ★ en kritik kullanıcı-değeri: kullanıcı adresini değiştirince, hangi partner'da ne durumda olduğunu canlı görür. AddressChangeEvent (artık var) bunu besler.

---

## PANELLER — özet (nerede, ne, ne zaman)

| Panel | Yüzey | Nerede (yol) | İçerik | Faz |
|---|---|---|---|---|
| **Connections / Status** (kullanıcı) | web + mobile | `apps/web/.../settings/connections/`, `apps/mobile/app/settings/connections` (parity) | consent yönetimi, connector-bazlı adres-değişim durumu (timeline), reconsent, fallback aksiyonları | Track 3 (mevcut, genişlet) |
| **Connector Control Plane** (admin) | admin | `apps/admin/.../connectors/` (iskelet var) | config (var) + **metrics** (G4) + **fallback editor** (G3) + **manuel circuit** (G8) + **AddressChangeEvent inspector** (★) | Track 3 |
| **Partner Portal** (3rd-party) | yeni | önce admin `PARTNER` rol → sonra `apps/partner` (`partners.locateflow.com`) | sandbox key, kendi dispatch logları, health, webhook, DPA | Track 2/3 sonrası, talep gelince |

---

## ENTEGRE SIRA (üç track birlikte)

**Hafta 0-1 (şimdi):** T1.1 (migration uygula) · T2.1 (3 e-posta gönder) · T2.2 (SOC2 aracı seç) · T1.2 (B1 fix).
**Hafta 1-3:** T1.3 (operasyonel kapılar) → T1.4 (QA) → **consumer app ÇIK.**
**Paralel (eng, hafta 2-6):** T3 **G2+G3** (güvenli onboarding) + **★ status timeline** (AddressChangeEvent ödülü).
**İlk partner "evet" deyince (hafta 4-8+):** adapter → **SHADOW** → ROLLOUT% → **G4 metrics** → GA.
**Sürekli:** G5-G8, daha çok partner, gerekince Partner Portal.

> Kural: BD + SOC2 (Track 2) hiç beklemez — eng (Track 1/3) ilerlerken arka planda saymalı. Katman 4'ün darboğazı kod değil, partner + compliance.

---

## TEK CÜMLE
Önce **çık** (Track 1 = gelir + kanıt), aynı anda **partner/SOC2 saatini başlat** (Track 2 = uzun pole), sonra **platformu güvenli ölçeğe hazırla** (Track 3 = G2/G3 → SHADOW pilot → metrics). Paneller: kullanıcı connections'ı genişlet, admin control plane'i derinleştir, partner portalı en son ve sadece talep gelince.
