# LocateFlow — PM / Realtor Dağıtım Pilotu (white-label İNŞA ETMEDEN)

> Raporun en iyi fikri: "taşınana zaten dokunan işletmeler = dağıtım kanalı."
> Ama portal/white-label **inşa etme**. Mevcut app + zaten kodda olan promo altyapısı yeterli.

---

## 0) Zaten elinde olan altyapı (yeni build YOK)
Şemada bunlar var, pilotu bunlarla çalıştır:
- `AcquisitionCampaign` + `AcquisitionRedemption` → partner-bazlı promo kodu, trial uzatma, attribution.
- `WaitlistSignup` (target ayrımıyla) → talep toplama.
- Promo kod redemption → **hangi partnerin kaç kişi getirdiğini ücretsiz ölçer.**

→ Yani her partnere bir **AcquisitionCampaign promo kodu** açarsın; o partnerin getirdiği herkes attribution'la işaretlenir. **Sıfır yeni mühendislik.**

---

## 1) Kime (NJ lokal, sen oradasın)
- 10 property manager (Bergen County: Wayne / Paramus / Clifton / Hackensack / Fort Lee)
- 5 realtor / brokerage
- 5 NJ licensed mover
- (opsiyonel) 3 local insurance / internet bayisi

## 2) Pitch (asla "app'imi indir" deme)
> "Sizin move-in/move-out resident'larınız utility, adres değişikliği, internet, posta yönlendirme, checklist ile uğraşıyor. Biz bunu tek dashboard'a koyuyoruz. Size **branded bir davet kodu** veriyoruz — her resident'a verin, leasing ofisinizin tekrar eden sorularını azaltsın. Sözleşme yok, 30 gün pilot."

## 3) Mekanik (build YOK)
1. Partner başına `AcquisitionCampaign` oluştur (kod: `AVALON30`, `REALTOR-JSMITH` …).
2. Partner kodu resident'lara dağıtır (QR, email, leasing portalı).
3. Resident kod ile Individual/Pro trial açar → redemption partnere bağlanır.
4. Sen dashboard'dan (admin) partner başına metrikleri görürsün.

## 4) İzlenecek metrikler (event'ler zaten var)
| Metrik | Kaynak |
|---|---|
| Partner başına redemption | `AcquisitionRedemption` |
| Onboarding completion | mevcut analytics |
| ≥3 task tamamlayan | `MoveTask` |
| Connector consent oranı | `PartnerConsent` |
| Provider link tıklaması (Katman 2 açılınca) | outbound tracking |

## 5) 30 / 60 / 90 gün
- **30:** 50 partner listesi + contact; 3 landing (`/property-managers`, `/realtors`, `/service-providers`); 1 dk demo; 20 görüşme. **API/portal konuşma yok.**
- **60:** 3 aktif partner; her birine promo kodu; resident'ların hangi task'ta takıldığını ölç; en çok tıklanan kategori.
- **90:** Katman 2 affiliate'i tek kategoride aç; "X resident / Y task / Z lead" case study; sonra küçük reklam.

---

## 6) KARAR KAPISI — portal'ı ne zaman inşa et?
**Partner dashboard / white-label'ı SADECE şu olduğunda yap:**
- ≥1 partner **aktif olarak** kod dağıtıyor, VE
- O partner senden **raporlama/branding istiyor.**

Talep gelmeden portal build etme. ("Build before demand" = en pahalı hata.) Mevcut Workspace modeli aile için; partner-tenant'a çevirmek aylarca iş — önce talebi kanıtla.
