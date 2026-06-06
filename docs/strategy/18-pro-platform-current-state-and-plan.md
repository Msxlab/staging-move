# PRO Auto-Sync & Affiliate Platform — Current State & Delivery Plan (START HERE)

> Tek otoriter "buradan başla" dokümanı. Amaç: kullanıcının doğrulanmış adresini **tek panelden** tüm partner'lara (USPS, sigorta, utility, banka, …) izinli/güvenli yayması + bunun yanında **affiliate** geliri. ("Plaid for Addresses" + SEMrush-GBP mantığı.)
>
> Bu doküman **kodun bugünkü gerçek durumuna** dayanır ve mevcut strateji/roadmap dokümanlarını **güncel kod gerçeğiyle uzlaştırır.** Tarih: 2026-06-05.

---

## 0. Bu doküman neyi değiştiriyor

Vizyonun mimarisi + yol haritası kodda **zaten detaylıca yazılı** (aşağıdaki kanonik dokümanlar). Ama o planların "yapılacak boşluklar" listesi, son ~30 commit + bu oturumdaki çalışmayla **büyük ölçüde kapandı.** Yani platform, planların varsaydığından **daha ileride.** Bu doküman o farkı düzeltir ve "gerçekte ne kaldı"yı netleştirir.

### Kanonik dokümanlar (detay için bunlara in)
| Konu | Dosya |
|---|---|
| Master strateji: Plaid-for-Addresses tezi, iki-taraflı pazar, gelir modeli | `docs/roadmap/address-verification-and-connector-network.md` (§3) |
| Katman 4 inşa planı (boşluk listesi, partner stratejisi, sert gerçekler) | `docs/strategy/04-layer4-build-plan.md` |
| Connector SDK & partner onboarding (framework→platform) | `docs/strategy/17-connector-sdk-and-onboarding.md` |
| Partner outreach / e-postalar / pitch | `docs/strategy/{06-partner-outreach-kit,10-partner-emails}.md` |
| Partner connector onboarding runbook (modlar, approval, security) | `docs/runbooks/partner-connector-onboarding.md` |
| Partner Hub UI / sync-attempts / deep-link / PDF / mailto roadmap | `docs/roadmap/family-and-pro/{33,35,36,37,38,45,46,54}-*.md` |

---

## 1. Bugünkü GERÇEK durum (doğrulanmış)

Motor production-grade ve platform katmanı **~%90+ hazır.** `04-layer4-build-plan.md`'deki "GERÇEK BOŞLUKLAR" (G1–G8) artık çoğunlukla kapalı:

| # | Boşluk (plandaki) | Bugünkü durum | Kanıt |
|---|---|---|---|
| G1 | AddressChangeEvent modeli yok | ✅ **KAPANDI** — model + FK + migration var | `schema.prisma:1827` |
| G2 | Gerçek SHADOW/dry-run yok | ✅ **KAPANDI** — SHADOW accounting, stale-SHADOW→internal FAILED | `connector-runtime.ts` (SHADOW branch) |
| G3 | Fallback registry hardcoded | ✅ **KAPANDI** — DB-destekli fallback CRUD + https-only + audit | admin `connector-fallbacks`, `fallback-actions.ts` |
| G4 | Per-connector metrics/dashboard yok | 🟡 **KISMİ** — admin connector-metrics dashboard var; kalıcı metric sink/alarmlar eksik | `connector-metrics` |
| G5 | Async confirm canlı test edilmemiş | ✅ **KAPANDI (framework)** — async connector contract testleri | `packages/connectors` async tests |
| G6 | Token refresh yarış koşulu | ✅ **KAPANDI** — `tokenVersion` ile optimistic CAS + reload-on-loss | `connector-oauth.ts` (bu oturum, F3) |
| G7 | Reconsent UI akışı yok | 🟡 **KISMİ** — backend revocation var; 1-tık reconnect UI eksik | — |
| G8 | Manuel circuit + stale-SUBMITTED sweeper | 🟡 **KISMİ** — stale-DISPATCHING sweep var; admin manuel kontrol eksik | `connector-runtime.ts` |
| — | Webhook ikinci registry (F2) | ✅ **KAPANDI** — tek app registry'den çözülüyor | `[key]/webhook/route.ts` (bu oturum) |

**Sonuç:** Platform tarafında kalan iş küçük (G4 alarmlar, G7 reconnect UI, G8 admin kontrol). **Asıl iş kod değil:** gerçek partner entegrasyonları + anlaşmalar + compliance, ve **affiliate katmanı (henüz sıfır).**

### Hâlâ kapalı/eksik olanlar
- `FEATURE_API_CONNECTORS` **varsayılan kapalı** (prod'da connector yüzeyi inert).
- Kayıtlı tek connector **USPS** (gerçek API push/verify var, ama tek başına).
- **Affiliate altyapısı kodda YOK** (`ccpa.ts` dışında referans yok) → greenfield.
- SOC2 / DPA şablonları / cyber insurance → süreç işi, kod değil.

---

## 2. Hedef mimari — 3 katman

Tek "Plaid for addresses" yok; bunu **partner-partner** kuruyorsun. Üç katman paralel ilerler, gelir ve risk profilleri farklı:

```
            ┌─────────────────────────────────────────────────────────┐
            │  Kullanıcı: 1 doğrulanmış adres değişikliği (tek panel)  │
            └───────────────┬─────────────────────────────────────────┘
                            │ AddressChangeEvent (kanonik olay)
        ┌───────────────────┼───────────────────────────────────┐
        ▼                   ▼                                     ▼
  KATMAN 1            KATMAN 2                               KATMAN 3
  AFFILIATE          GUIDED PARTNER HUB                     API AUTO-SYNC
  (yeni servis       (deep-link/mailto/PDF —                (gerçek otomatik push —
   yönlendirme)       kullanıcı son tıkı yapar)              OAuth + token + dispatch)
  Gelir: komisyon    Gelir: PRO abonelik                    Gelir: PRO + partner rev-share
  Anlaşma: yok       Anlaşma: minimal                       Anlaşma + hukuk: ZORUNLU
  Risk: düşük        Risk: düşük                            Risk: yüksek
  Durum: GREENFIELD  Durum: KOD HAZIR, kapalı               Durum: MOTOR HAZIR, partner+legal gate
```

### Katman 1 — Affiliate (gelir, hemen, anlaşmasız) · GREENFIELD
Kullanıcı yeni adreste **yeni** servise ihtiyaç duyar (internet, sigorta, home security, moving/storage). Bunları affiliate linkle yönlendir → komisyon. Mevcut provider katalog sistemine oturur.
- **Veri:** `ServiceProvider`/`UserCustomProvider`'a `affiliateUrl`, `affiliateNetwork`, `payoutModel` alanları + `AffiliateClick`/`AffiliateConversion` event modeli.
- **Akış:** öneri motoru (zaten var) → "Yeni adreste şuna ihtiyacın olabilir" → affiliate link → tıklama/dönüşüm takibi → admin gelir paneli.
- **Neden önce:** anlaşma gerektirmez (affiliate programlarına başvuru yeterli), en hızlı ROI, Katman 3 partner'larıyla **aynı partner ilişkisini** besler (motive partner = hem connector hem affiliate).

### Katman 2 — Guided Partner Hub (PRO değeri, kod hazır) · ENABLE
Partner'ın write-API'si **yoksa** (çoğu durumda) kullanıcıya deep-link / ön-doldurulmuş PDF / mailto ile yol gösterir; son tıkı kullanıcı yapar. Partner API'si çağrılmaz → düşük risk.
- **Durum:** UI + fallback registry + renderer'lar hazır; `FEATURE_API_CONNECTORS` ile kapalı.
- **İş:** önce **staging'de aç**, USPS guided akışını uçtan uca test et, sonra kontrollü prod. (G7 reconnect UI + G4 alarmları burada tamamlanır.)

### Katman 3 — API auto-sync (uzun vadeli kale) · PARTNER + LEGAL GATE
Gerçek otomatik push: kullanıcı partner'da OAuth ile yetki verir → token vault → dispatch → webhook confirm. **Motor hazır** (USPS gerçek API kanıtı). Eksik olan: imzalı anlaşması olan partnerler + compliance.
- **Her connector yaşam döngüsü:** manifest review → contract test → **SHADOW (dry-run)** → ROLLOUT% → GA → (gerekirse) RETIRED. `ConnectorConfig` bunu zaten destekliyor.
- **Entitlement:** PRO + yıllık (`userHasApiConnectorEntitlement` zaten gate'liyor).

---

## 3. Veri modeli (mevcut + eklenecek)

**Mevcut (Katman 2/3 için yeterli):**
- `PartnerConsent` (şifreli access/refresh token, scope, immutable consent snapshot, `tokenVersion` CAS) — `schema.prisma:1715`
- `ConnectorDispatch` (queue: QUEUED→DISPATCHING→SUBMITTED→CONFIRMED/NEEDS_USER/FAILED) — `1772`
- `AddressChangeEvent` (kanonik olay, dispatch fan-out kaynağı) — `1827`
- `ConnectorConfig` (enabled / rollout% / stage / circuit) — control plane
- `ConnectorFallbackAction` (guided fallback registry)

**Eklenecek (Katman 1):** `affiliate*` alanları + `AffiliateClick`/`AffiliateConversion`. **Eklenmesi iyi (G4):** `ConnectorMetric` sink (connectorKey × saat × outcome/latency) + alarm.

---

## 4. Güvenlik / Compliance / Hukuk (Katman 3'ün gerçek kapısı)

Detay: `04-layer4-build-plan.md` PART III. Özet, **pazarlık konusu olmayanlar:**
1. **Banka/utility ham kimlik bilgisi ASLA saklanmaz.** Sadece partner'ın OAuth verdiği token (şifreli, allowlist + redaction zaten var). API'si yoksa → Katman 2 (guided), Katman 3 değil.
2. **SOC 2 Type II** — büyük partner imzalamadan önce ister, 6-12 ay sürer → **şimdi başlat.**
3. **Connector başına DPA** + veri-akışı ifşası + immutable consent receipt (UI'da "şu entegrasyon şunu yaptı" anı — `legal.ts` carve-out'unu karşılar).
4. **Sorumluluk:** yanlış/sessiz başarısız değişiklikte kullanıcı seni suçlar → confirmation + net status + manuel fallback zorunlu.

---

## 5. Para modeli
- **Consumer:** PRO (yıllık) API connector'ları gate'ler (anti-churn). + Katman 1 affiliate komisyonu + Katman 3 per-confirmed-action / rev-share.
- **Moat:** *N consent'li connector × aylık doğrulanmış mover × confirm-rate* = kapsama + consent + hacim. Değer tek logoda değil; ağda.

---

## 6. Fazlı yol haritası (oturum işleri dahil)

**✅ Bu oturumda tamamlanan zemin:**
- Mobil logo render düzeltmesi (OTA canlıda) · PRO özellik denetimi (gösterilen≠gerçek tespit edildi) · **Tax & Property export** (PRO-gated, advancedExport bayrağı artık enforce — Katman "advanced export" gerçek oldu) · F2/F3 connector sağlamlaştırma.

**Faz A — Platform tamamlama (haftalar):**
- Katman 1 **Affiliate altyapısı** (veri + tıklama/dönüşüm takibi + öneri entegrasyonu + admin gelir paneli).
- G4 metric sink + alarmlar · G7 1-tık reconnect UI · G8 admin circuit kontrol.
- **Paralel:** SOC2 başlat + ToS carve-out gözden geçir + ilk DPA şablonu.

**Faz B — Guided + ilk partner (1-2 çeyrek):**
- `FEATURE_API_CONNECTORS` staging'de aç → USPS guided + (varsa) API_SYNC uçtan uca SHADOW → kontrollü prod.
- İlk gerçekçi partnerler: **Lob/Smarty** (adres altyapısı + mail-forward) + 1 **insurtech** (mover ister, lead başına öder — hem connector hem affiliate) + **Arcadia** (bir anlaşma, çok utility kaması). Her biri SHADOW→ROLLOUT%→GA, kill-switch'li.

**Faz C — Ölçek (sürekli):** daha çok connector, aggregator derinliği, bölgesel utility/banka; **B2B partner portalı** (self-serve sandbox + dispatch logları + sertifikasyon).

---

## 7. Sert gerçekler (atlama)
1. **Çoğu provider asla write-API vermez** → "assisted/guided" norm; kapsamı mover'ın checklist'ine göre kur, marquee logoya göre değil.
2. **Amazon/büyük banka ilk partner DEĞİL** — vanity tuzağı; aylarca oyalar. USPS'i kanıt, Lob+insurtech'i ilk ağ yap.
3. **Compliance, banka gelirinden ÖNCE gelir.**
4. **"Tam aç" bayrağı partnerleri yaratmaz** — sadece hazır yüzeyi açar; gerçek değer partner-partner + anlaşma ile gelir.

---

## 8. Bu hafta karar verilecekler
1. **Affiliate'i Faz A'da ilk iş yapalım mı?** (gelir, anlaşmasız, en hızlı) — önerilen evet.
2. **SOC 2'yi şimdi başlatıyor muyuz?** (Katman 3 büyük partner için kritik yol, 6-12 ay).
3. **İlk hedef partner seti:** Lob/Smarty + 1 insurtech + Arcadia ile mi gidiyoruz?
4. **Guided Partner Hub'ı staging'de açma penceresi** ne zaman?

---

## TEK CÜMLE
Motor ve platform iskeleti hazır (G1–G6 kapandı); kalan iş **affiliate katmanı (greenfield) + guided'i açıp test + 3 gerçekçi partner + SOC2/DPA** — marquee logolar değil. Para ve moat **kapsama + consent + hacim**'den gelir; USPS'i kanıt, affiliate'i yakıt yap.
