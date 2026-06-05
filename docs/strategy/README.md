# LocateFlow — Strateji & Layer-4 Dokümanları (index)

Bu klasör: strateji analizi + Layer-4 connector ağı planı + operasyonel runbook'lar.
Hepsi 2026-06 oturumunda üretildi.

## Strateji
- **00** — Mühendislik punchlist'i (doğrulanmış; çoğu zaten kapalı çıktı)
- **01** — Yasal-temiz gelir modeli (4 katman; lead/data satışı ToS ile çelişir)
- **02** — PM/realtor dağıtım pilotu (white-label inşa etmeden)
- **03** — Strateji raporu, kod gerçeğine göre düzeltilmiş
- **04** — Katman 4 (true API address-propagation) inşa planı
- **08** — Master roadmap

## Connector / Layer-4 tasarım
- **05** — Fallback 2.0 + dry-run (SHADOW) tasarımı
- **07** — SOC 2 + ToS/consent yol haritası (büyük partnerlerin kapısı)

## Partner / BD
- **06** — Partner outreach kit (Lob + insurtech + Arcadia)
- **10** — Gönderilmeye hazır partner e-postaları

## Operasyonel runbook'lar
- **09** — Go-live checklist
- **12** — Canlı test planı (elle doğrulama)
- **13** — SHADOW pilot runbook (connector'ı güvenle ilk kez açma)
- **14** — Consumer launch runbook (gerçek Stripe + store yayını)

---

## Durum (2026-06)
**İnşa edilen + canlıda (deploy `4c3b604`):**
- AddressChangeEvent (kanonik event) · SHADOW dry-run · Fallback 2.0 (DB-backed + güvenlik hardening) · ★ adres-değişim timeline API · stale sweeper · metrics aggregation · admin fallback CRUD (audit-logged).
- Foundation migration'ları prod'da uygulandı; connector **inert** (flag kapalı, güvenli).

**Sıradaki karar kapıları (iş-gated):**
1. Consumer launch → gerçek Stripe + store (runbook **14**)
2. Connector aktivasyonu → USPS agreement → SHADOW pilot (runbook **13**)
3. Partner outreach + SOC2 → uzun pole, bugün başlat (**06**, **10**, **07**)
