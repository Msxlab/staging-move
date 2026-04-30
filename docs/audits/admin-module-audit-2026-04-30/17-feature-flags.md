# Feature Flags Audit

## Baglanti Durumu

- Admin: `/api/feature-flags`
- Web library: `apps/web/src/lib/feature-flags.ts`
- Aktif kullanim aramasinda web/mobile icinde `isFeatureEnabled` veya flag
  kontrolu kullanan urun kodu bulunmadi.
- Mobile feature flag istemcisi yok.

## Guvenlik

- Permission `settings` altinda; ayri `feature_flags` yok.
- Create/update/delete icin ADMIN yeterli; password step-up yok.
- Target type/value schema validasyonu zayif.

## Mantik ve Eksik

- Modul pratikte etkisiz: flag yaratiliyor ama urun davranisini degistiren
  entegrasyon noktasi yok.
- Web cache TTL 60 saniye; admin update cache invalidation cross-app degil.
- Delete hard delete; rollout audit/rollback yok.

## Oneriler

- `feature_flags` permission kaynagi ve step-up policy.
- Target schema: `ALL`, `PERCENTAGE`, `USER_LIST`, `PLAN` icin zod validation.
- Web/mobile SDK entegrasyonu ve cache invalidation.
- Rollout history ve emergency kill-switch standardi.
