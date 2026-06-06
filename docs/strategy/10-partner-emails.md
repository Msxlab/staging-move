# Partner Outreach — Gönderilmeye Hazır E-postalar

> İlk 3 partner. Her birinin değer önerisi farklı, o yüzden 3 ayrı şablon. `{{...}}`'leri doldur, gönder.
> Ortak kurallar: kısa, "SHADOW pilot / sıfır risk", "açık consent / veri minimizasyonu", net tek istek (15 dk).

---

## 1) Lob (altyapı: adres doğrulama + mail-forwarding) — model: B2B API-key

**To:** partnerships@lob.com / BD contact
**Subject:** Pilot — verified-address + mail-forwarding for movers

Hi {{name}},

I'm {{you}}, founder of LocateFlow — a consumer app that helps people manage everything when they move (address change, utilities, mail, services) from one place.

At the moment a user moves, we want to (1) verify their new address and (2) trigger mail forwarding through Lob's API, with the user's explicit consent. We already run a connector framework (USPS live) and can integrate Lob as a new connector in days.

Ask: sandbox API access + the address-verification and mail endpoints we'd use, and a short DPA. We start in a shadow/pilot mode with zero production side effects. 15 minutes this week?

Thanks,
{{you}} · {{phone}} · locateflow.com

---

## 2) Insurtech / renters-insurance (motive: müşteri ister, öder) — model: lead/quote API (+ affiliate)

**To:** {{partnerships@insurer}}
**Subject:** High-intent renters at the moment they move

Hi {{name}},

LocateFlow is a consumer move-management app. Our users are renters/buyers actively moving — exactly when they need renters/home insurance.

We'd like to surface {{Company}} as the insurance option in our move flow and route consented, high-intent leads (or quote requests) to you. We disclose clearly and only pass data the user opts into. Commission/lead terms on your side; clean API on ours.

Ask: your partner/lead (or quote) API + a sandbox, and lead/payout terms. We can pilot with a small % of traffic first. 15 minutes this week?

Best,
{{you}} · locateflow.com

---

## 3) Arcadia (aggregator: utility connectivity) — model: OAuth / utility-link

**To:** partnerships@arcadia.com
**Subject:** Utility setup for movers — Arc integration pilot

Hi {{name}},

I'm {{you}} from LocateFlow — a consumer app for managing a move end to end. When a user moves, one of the hardest steps is figuring out and setting up the right utilities at the new address.

We'd like to use Arc to (1) identify the utilities serving a new address and (2) help users connect/transfer, with their consent. We have a connector framework ready (USPS live), so adding Arc is a matter of days.

Ask: API access (Arc) + the endpoints for utility lookup/connection at an address, sandbox creds, and a short DPA. Happy to start read-only. 15 minutes this week?

Thanks,
{{you}} · locateflow.com

---

## Gönderim sonrası tracking (basit — kod gerekmez)
| Partner | Kontak | Durum | Sandbox? | DPA? | Sonraki adım |
|---|---|---|---|---|---|
| Lob | | gönderildi | | | |
| {{insurtech}} | | | | | |
| Arcadia | | | | | |

## Görüşmeye giderken hazır ol (her partner)
- `06-partner-outreach-kit.md`'deki "sizden teknik ne istiyoruz" çek-listesi.
- SHADOW pilot anlat: gerçek trafik şekli, sıfır yan-etki, açık consent, istediğin an çık.
- Veri minimizasyonu: sadece manifest `requiredFields` partnere gider.
