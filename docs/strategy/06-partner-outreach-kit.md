# Partner Outreach Kit — İlk 3 partner (Lob + insurtech + Arcadia)

> Amaç: bugün BD'yi başlatmak. White-label/portal İNŞA ETMEDEN. Pilot = mevcut connector framework + SHADOW modu.

---

## Neden bu 3 (ve neden Amazon/banka DEĞİL)
- Amazon/büyük banka: 3. tarafa adres-yazma API'si yok / SOC2'siz vetting yok → ilk partner için gerçekçi değil.
- Doğru ilk 3: bir **altyapı** (Lob), bir **motive/ödeyen** (insurtech), bir **aggregator** (Arcadia). Hızlı evet + bir entegrasyon → çok değer.

| # | Partner | Tip | Entegrasyon modeli | Ne kazandırır |
|---|---|---|---|---|
| 1 | **Lob** (alt: Smarty/Melissa) | Altyapı | B2B API-key | verified address + gerçek mail-forward aksiyonu |
| 2 | **Insurtech / renters-insurance** | Motive (öder) | lead/quote API (+ adres update mümkünse) | hem connector hem affiliate gelir |
| 3 | **Arcadia** | Aggregator | OAuth/utility-link | bir anlaşma → binlerce utility (önce read kaması) |

---

## Cold email şablonu (uyarlanabilir)
> **Konu:** Partnership — high-intent movers at the moment of address change
>
> Hi {{name}},
>
> LocateFlow is a consumer move/address-change platform. At the exact moment a user moves, we help them update their address across the services they use — **with explicit, per-partner consent.**
>
> We'd like to route {{movers / verified-address events / utility setups}} to {{Company}} through a clean API. We can start in a **shadow/pilot mode with zero production risk** — no data leaves without the user's explicit opt-in.
>
> What we'd need to scope a pilot: sandbox API access, the relevant endpoint(s), and a short DPA. 15 minutes this week?
>
> — {{you}}

---

## "Sizden teknik olarak ne istiyoruz" çek-listesi (her partner)
- [ ] API base URL + auth modeli (OAuth scopes / API-key)
- [ ] İlgili endpoint: adres-update VEYA lead/quote VEYA availability
- [ ] Async confirm için webhook (varsa) + imza secret'ı
- [ ] Rate limit'ler (per-user/day, per-minute)
- [ ] Sandbox credential'ları (SHADOW pilotu için)
- [ ] Veri akışı + DPA (hangi alan, hangi amaç, saklama)

→ Bunlar geldiğinde: `packages/connectors/src/{key}/` altında adapter (manifest + buildRequest + push + verify/parseWebhook) + `ConnectorConfig` satırı `stage=SHADOW`. Kod çatısı hazır.

---

## Pilot akışı (her partner)
1. **Anlaşma:** sandbox + DPA imzası.
2. **Adapter:** manifest + buildRequest + push; `agreementStatus=SANDBOX`.
3. **SHADOW:** gerçek trafikle yan-etkisiz prova (G2).
4. **ROLLOUT %5 → %50 → GA:** kill-switch + circuit açık.
5. **Metrikler:** confirm-rate, latency, fallback-rate yayınla.

## Pilot başarı metrikleri
| Metrik | Hedef |
|---|---|
| SHADOW doğru request şekli | %100 |
| Sandbox push → confirm | >%90 |
| Fallback gereken oran | ölç (assisted payı) |
| Partner'a giden consent oranı | ölç |

---

## 1-sayfalık partner brief (özet)
**LocateFlow nedir:** taşınan kullanıcıların adres/servis geçişini tek yerden yöneten consumer platform; **consent-tabanlı** connector ağı (USPS canlı).
**Partner ne kazanır:** taşınma anında yüksek-niyetli kullanıcı; temiz API; lead/komisyon (uygunsa); marka görünürlüğü.
**Risk:** sıfır — SHADOW pilot, açık consent, veri minimizasyonu (sadece declared field'lar), istediğin an çık.
**İlk adım:** sandbox + 15 dk scoping görüşmesi.
