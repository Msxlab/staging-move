# State Rules Audit

## Baglanti Durumu

- Admin: `/api/state-rules`, `/api/state-rules/[id]`
- Web/mobile: `/api/state-rules?state=XX`
- Mobile moving/services ekranlari state rules endpoint'ini kullaniyor.

## Guvenlik

- Read `state_rules canRead`; write/delete ADMIN.
- Delete icin password step-up yok. Bu icerik compliance/legal nitelikte oldugu
  icin riskli.

## Mantik ve Eksik

- Server tarafinda state code/name validasyonu zayif. UI select koruyor ama
  direkt API invalid state code yazabilir.
- Web/mobile endpoint'i admin modelindeki tum alanlari dondurmuyor:
  `utilityInfo`, `insuranceRules`, `commonProviders` gibi alanlar eksik.
- Version/locking yok; iki admin ayni rule'u ezebilir.

## Oneriler

- Zod schema ile US state enum, uzunluk ve required content validasyonu.
- Delete/update icin password step-up ve changelog/versioning.
- Web/mobile response modelini admin alanlariyla bilincli esitleyin veya hangi
  alanlarin public oldugunu dokumante edin.
