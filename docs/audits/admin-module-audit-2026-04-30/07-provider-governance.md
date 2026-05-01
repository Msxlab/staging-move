# Provider Governance Audit

## Baglanti Durumu

- Admin: `/api/provider-governance`
- Web/mobile custom provider akislari:
  - Web `/api/custom-providers`
  - Mobile custom provider ekranlari
- Kullanici tarafinda olusan private provider kayitlari governance queue'ya
  dusuyor.

## Guvenlik

- Read `providers canRead` + VIEWER. Bu endpoint user-created private provider
  ve user email/name bilgilerini de donduruyor; provider read yetkisi icin fazla
  genis.
- PATCH MODERATOR+ ile custom provider review/status ve issue aksiyonlari
  yapabiliyor.

## Mantik ve Eksik

- API `link_global`, issue review/dismiss/reopen gibi aksiyonlari destekliyor
  ama admin UI bunlarin tamamini sunmuyor.
- `coverageGap` queue tanimi var fakat item uretimi gorunmuyor.
- Audit log yaziliyor ama bazi action path'lerinde ip adresi eksik veya `unknown`.

## Oneriler

- Governance icin ayri permission kaynagi ekleyin.
- Private user provider PII'sini VIEWER icin maskeleyin.
- UI'yi API yetenekleriyle esitleyin: global provider link, issue detail,
  dismiss/reopen ve coverage gap queue.
