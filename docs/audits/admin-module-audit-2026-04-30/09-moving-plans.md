# Moving Plans Audit

## Baglanti Durumu

- Admin read-only: `/api/moving`
- Web: `/api/moving`, `/api/moving/[id]`, `/api/moving/migration`,
  `/api/move-tasks`
- Mobile: moving screens ve move-task API'leri ayni web backend'e bagli.

## Guvenlik

- Admin read `moving_plans canRead` + VIEWER.
- Liste user email/name, origin/destination street/city/state/zip ve task
  context donduruyor. VIEWER icin PII seviyesi yuksek.
- Admin tarafinda mutasyon yok, bu iyi.

## Mantik ve Eksik

- Admin where filtresinde soft-deleted moving plans icin `deletedAt: null`
  gorunmuyor; aktif liste niyeti varsa silinmis planlar karisabilir.
- Status normalize ediliyor; web tarafinda lifecycle daha siki.

## Oneriler

- VIEWER icin street/zip ve user email maskelenmeli.
- `deletedAt: null` filtresi varsayilan olmali; archived filter opsiyonel.
- Detail endpoint gerekirse ayri permission ile acilmali.
