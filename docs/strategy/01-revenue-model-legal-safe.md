# LocateFlow — Yasal-Temiz Gelir Modeli

> Strateji raporundaki "lead/referral sat, veri sat" fikri **yayında olan kendi yasal metinlerinle çelişiyor.**
> Bu döküman, ToS'u yalanlamadan geliri nasıl açacağını sırayla anlatır.

---

## 0) Önce çatışmayı gör (kelimesi kelimesine, canlı kod)

`packages/shared/src/legal.ts:51`
> "LocateFlow is **not a provider marketplace**, legal filing service, regulated brokerage, public-record certification tool, payment card processor, **or commercial data resale product**. Completing a task in LocateFlow **does not update an external provider account unless the product screen expressly says** a supported integration performed that action."

`apps/web/src/app/about/page.tsx:17-18`
> "LocateFlow is **not a provider marketplace, broker, mover**... LocateFlow **does not automatically update external provider accounts**."

**Sonuç:** Raporun Model 3 (lead satışı) ve Model 5 (veri satışı) bu cümlelerle kafa kafaya çarpışıyor. Yapılamaz değil — ama **önce hukuk + ToS + consent altyapısı**, sonra pazarlama. Sıra önemli. (Hafıza notun da diyor: *"don't write contradictory marketing."*)

---

## 1) Gelir katmanları — yasal zorluk sırasına göre

### Katman 1 — Consumer abonelik (ZATEN CANLI, temiz tut)
Stripe + IAP ile Individual/Family/Pro. Bu senin temiz tabanın.
- **Raporun haklı kritiği:** taşınma tek seferlik bir olay; aylık abonelik retention zayıflatır.
- **Aksiyon fikri:** Yıllık-Pro connector kapısı (`connector-oauth`: *"automatic connections are an annual-commitment feature, so a one-time mover can't buy a single month and churn"*) zaten zekice. Bunu öne çıkar; ayrıca tek-seferlik **"Move Pass"** SKU'sunu (Stripe one-time price) abonelik yanında test et.

### Katman 2 — Açık etiketli, kullanıcı-başlatımlı outbound link (affiliate) ← SIRADAKİ EN İYİ
En düşük hukuki bariyer. Kullanıcı, **sponsorlu olduğu açıkça yazan** bir CTA'ya kendi tıklar; sen affiliate/CPC kazanırsın.
- Bu **lead satışı DEĞİL** — kullanıcı aktif seçim yapmadan hiçbir PII partnere gitmiyor.
- Legal.ts'teki *"unless the product screen expressly says"* carve-out'una uyar.
- **ToS değişikliği:** küçük — "outbound linklerden komisyon kazanabiliriz" + net "Sponsored" etiketleme.
- **Build:** outbound-link tracking + "Sponsored" badge komponenti, flag arkasında.
- **İlk kategori:** internet kurulumu veya renters insurance (yeni adreste zorunlu ihtiyaç).

### Katman 3 — Consent-kapılı lead transferi (PII partnere gider) ← raporun Model 3
Yüksek bariyer. Gereken:
- Partner-bazlı **açık consent checkbox** + kime/niye gittiğinin disclosure'ı.
- Telefon/SMS olacaksa **TCPA written-consent** dili; email için **CAN-SPAM** uyumu.
- **ToS rewrite:** "not a provider marketplace / not a commercial data resale product" ifadelerinin yumuşatılması/kaldırılması — **avukat onayı ŞART, koddan önce.**
- **Başlangıç:** TEK kategori, TEK partner ile dar pilot. Hepsini birden açma.

### Katman 4 — Veri / insights (raporun Model 5) ← en son
- Sadece **aggregated + anonymized**, ve ancak ToS açıkça izin verdikten sonra.
- "not a commercial data resale product" satırı bugün kullanıcı-seviyesi veri satışını **yasaklıyor**. En sona bırak.

---

## 2) Her katmandan önce ne değişmeli

| Katman | ToS değişikliği | Consent UI | Avukat onayı | Build yükü |
|---|---|---|---|---|
| 1 Abonelik | yok (mevcut) | yok | — | yok |
| 2 Affiliate link | küçük (komisyon ifşası) | "Sponsored" etiketi | hafif | düşük |
| 3 Lead transfer | büyük (marketplace ifadeleri) | per-partner checkbox + TCPA/CAN-SPAM | **zorunlu, önce** | orta |
| 4 Data insights | büyük (resale ifadesi) | aggregate consent | **zorunlu, önce** | orta |

---

## 3) Net tavsiye
1. **Şimdi:** Katman 1'i temiz tut, "Move Pass" tek-seferlik fiyatını dene.
2. **Sıradaki:** Katman 2 (açık etiketli affiliate outbound) — en iyi hukuk-efor/gelir oranı. Flag arkasında, küçük ToS eklemesiyle.
3. **Distribution + avukat hazır olunca:** Katman 3'ü tek kategori/tek partnerle aç.
4. **En son:** Katman 4, sadece anonim aggregate.

> Sessizce marketplace'e dönüşme. "Expressly says" carve-out'u senin dostun: kullanıcı ne olduğunu görüp tıkladığı sürece yasal zeminin sağlam.
