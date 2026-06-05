# SOC 2 + ToS / Consent Yol Haritası — Büyük partnerlerin kapısı

> Banka/büyük utility kodla değil, **güvenle** ikna olur. Bu, Katman 4'ün hukuk/compliance saatini başlatır.

---

## 0) İYİ HABER: ToS carve-out ZATEN VAR
`legal.ts:51` zaten diyor:
> *"Completing a task in LocateFlow does not update an external provider account **unless the product screen expressly says a supported integration performed that action.**"*

Yani Katman 4 (consent'li **propagation**), Katman 3 (lead **satışı**) kadar ToS çatışması yaratmıyor. Propagation, "not a commercial data resale product" satırını **ihlal etmez** — veri satmıyorsun, kullanıcının izniyle onun adına bildirim yapıyorsun. → **Büyük ToS rewrite GEREKMİYOR.** Gereken daha küçük 3 şey (aşağıda).

---

## 1) ToS / Consent — eklenecekler (küçük)
1. **Per-connector consent receipt:** kullanıcı bir connector'ı bağlarken "şu partner'a, şu alanları, şu amaçla iletiyoruz" ifşası + immutable snapshot. (PartnerConsent.consentSnapshotJson zaten var — UI'da göster.)
2. **Disclosure dili:** "Bir destekli entegrasyon bu işlemi gerçekleştirdi" ekranı (carve-out'u tetikleyen an).
3. **Revocation + veri saklama:** kullanıcı istediği an iptal; partner'a iletilen verinin amacı/saklama süresi.

> Lead **satışı** (Katman 3) yaparsan O ZAMAN ToS'ta "marketplace/resale" ifadeleri değişmeli + TCPA/CAN-SPAM. Katman 4 propagation için gerekmez.

---

## 2) SOC 2 Type II — en uzun kalem, ŞİMDİ başlat
Banka/büyük utility imzalamadan ister. ~6-12 ay.

**Adımlar:**
1. **Scope:** connector platformu + token vault + dispatch + admin. Trust criteria: Security (+ Availability, Confidentiality).
2. **Araç:** Vanta / Drata / Secureframe (kontrol otomasyonu + evidence toplama).
3. **Kontroller:** erişim yönetimi, şifreleme (at-rest token vault zaten var), change management, logging/monitoring (G4 metrics besler), incident response, vendor management.
4. **Type I → Type II:** önce nokta-zaman (Type I), sonra 3-6 ay gözlem penceresi (Type II).
5. **Pen test** (yıllık) + **cyber insurance**.

**Paralel hazır olanlar (avantajın):** field encryption, egress allowlist, redacting logger, immutable audit (per-dispatch), circuit breaker, idempotency. SOC2 evidence'ının önemli kısmı **zaten kodda.**

---

## 3) Sektörel uyum (partner tipine göre)
| Partner tipi | Ek gereksinim |
|---|---|
| Finansal (banka/insurtech) | **GLBA** safeguards; bazıları kendi vendor-security review'u |
| Utility | eyalet düzenlemeleri; bazıları kendi DPA'sı |
| Tümü | **CCPA/CPRA** + eyalet gizlilik; veri minimizasyonu |

---

## 4) Per-connector DPA şablonu (ana hatlar)
- Taraflar + roller (LocateFlow = processor/intermediary; partner = controller/processor)
- Veri kategorileri (sadece manifest `requiredFields`)
- Amaç sınırlaması (sadece adres-değişikliği işlemi)
- Saklama + silme
- Güvenlik önlemleri (encryption, allowlist, audit)
- Alt-işleyiciler, breach bildirimi, denetim hakkı
- Sonlandırma + veri imhası

---

## 5) Sıra
1. **Hemen:** SOC2 aracı seç + scope (uzun pole). ToS'a 3 küçük consent eklemesi.
2. **İlk partner'larla:** her biri için DPA imzala (Lob/insurtech/Arcadia).
3. **Type II penceresi dolarken:** banka/büyük utility görüşmelerini aç — SOC2 + hacim kaldıracıyla.

---

## TEK CÜMLE
Katman 4 propagation için **ToS neredeyse hazır** (carve-out var); asıl uzun iş **SOC 2 Type II** — ve evidence'ının çoğu zaten kodunda. Şimdi başlat, ilk partner'larla DPA imzala, büyükleri en son aç.
