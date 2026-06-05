# LocateFlow Stratejisi — Kod Gerçeğine ve Yasal Duruşa Göre Düzeltilmiş

> Orijinal raporun iskeleti iyi (B2B2C dağıtım, NJ pilot, connector seviyelendirme).
> Bu sürüm aynı içgörüleri korur ama: (a) gerçekte inşa edilmiş ürüne, (b) yayındaki yasal metinlere oturtur, (c) ters kurulmuş monetizasyon sırasını düzeltir.

---

## 1) LocateFlow GERÇEKTE ne (pazarlama değil, kod)
Consumer (B2C) bir **taşınma organizatörü + adres/servis takip** abonelik uygulaması. Web (Next.js) + mobil (Expo) + admin. AI-destekli moving checklist, state-rule motoru, Stripe + IAP abonelik, Family/Pro için Workspace (multi-tenant primitive), ve **consent tabanlı connector framework** (USPS canlı, flag-gated).

**Kodda OLMAYAN (rapor var sanıyor):** property manager/realtor portalı yok, white-label yok, lead/komisyon ekonomisi yok, "provider'a müşteri satma" yok.

## 2) Konumlandırma — düzeltildi
- ❌ "Updater klonu / move-in marketplace" deme.
- ✅ **"Consent tabanlı, privacy-first adres-değişikliği ve taşınma organizatörü."** Bu hem daha savunulabilir hem yasal metninle uyumlu. USPS connector zaten bunu yapıyor; öne çıkar.
- Yasal sabit (değiştirmeden pazarlama yapma): *"not a provider marketplace... does not automatically update external provider accounts unless the screen expressly says so."*

## 3) İnşa edilmiş vs net-yeni (kimse white-label var sanmasın)
| Yetenek | Durum |
|---|---|
| Consumer abonelik (Stripe+IAP) | ✅ Canlı |
| AI moving checklist / state rules | ✅ Canlı |
| Connector framework (USPS, gerçek API) | ✅ Var ama flag-gated |
| Workspace (aile/çok-üye) | ✅ Var (aileye yönelik) |
| Promo/attribution altyapısı | ✅ Var (`AcquisitionCampaign`) |
| Lead/referral geliri | ❌ Net-yeni + ToS değişikliği gerek |
| Partner/PM/realtor portalı, white-label | ❌ Net-yeni, aylarca iş |

## 4) En kritik düzeltme — monetizasyon SIRASI ters kurulmuş
Orijinal rapor doğru diyor: *"para Seviye 3'te (lead/referral); Seviye 5'i (gerçek API) en sona bırak."*
**Ama uygulama tam tersini yapmış:** en zor + en hukuken riskli + en az gelirli **Seviye 5'i (USPS auto-push) inşa etmiş**, Seviye 3'ten (gelir) sıfır kod var.
→ Düzeltilmiş sıra:

1. **Şimdi:** Consumer abonelik (canlı) + tek-seferlik "Move Pass" testi.
2. **Sıradaki:** Açık-etiketli affiliate outbound link (en düşük hukuk bariyeri).
3. **Distribution + avukat hazır olunca:** consent-kapılı lead, tek kategori/tek partner.
4. **En son:** aggregate/anonim insights.
5. **Talep gelince:** partner portalı / white-label.

(Detay: `01-revenue-model-legal-safe.md`.)

## 5) Dağıtım = kanal, ürün değil
Raporun en iyi fikri. Ama portal inşa etmeden, mevcut app + `AcquisitionCampaign` promo koduyla NJ'de 3-5 partnere pilot ver, talebi ölç, SONRA portal kararı. (Detay: `02-distribution-pilot-pm-realtor.md`.)

## 6) Korunan iyi fikirler (orijinalden)
- ABD %11.8 move oranı → pazar gerçek.
- B2B2C dağıtım tezi.
- "İlk 90 gün reklam yakma, partner görüş."
- NJ lokal pilot (NJAA / NJ REALTORS / NJ Movers Assoc.).
- Connector seviyelendirme modeli (zihinsel çerçeve olarak).

## 7) Atılan/ertelenen fikirler (ve neden)
- "Lead/data sat" (Model 3/5) → **şimdilik ToS'u yalanlar**; Katman 3-4'e ertelendi, avukat onayıyla.
- "White-label portal pilot sonrası hemen" → talep kanıtlanana kadar inşa yok.
- "$9.99 one-time Move Pass ana ürün" → değerli içgörü; abonelik yanında **test SKU** olarak ekle, tek hamlede pivot etme.

---

## TEK CÜMLE
Orijinal rapor "her şeyi bağlayan gelir makinesi"; düzeltilmiş hali **"önce çalışan + yasal temiz + tek kanalda kanıtlanmış, sonra genişleyen."** Hedef aynı, sıra ve hukuk farklı.
