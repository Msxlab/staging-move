# ADMIN-02 Admin Dashboard/Health

## Kapsam

Admin dashboard metrics, system health, operational status, security summaries, readiness visibility.

## Olumlu Gozlemler

- Health/ops kavramlari admin ve web cron/internal modulleriyle birlikte dusunulmus.
- Dashboard operasyonel riskleri gorunur kilmak icin uygun bir merkez.

## Riskler ve Sorular

- Dashboard metric'leri stale veya partial failure durumunda yanlis guven hissi verebilir.
- `/api/ready`, DB, cron freshness, webhook lag ve backup freshness ayni health modeline baglanmali.
- Admin dashboard read permission ile sensitive config/secret read ayrimi net kalmali.

## Test/Task Listesi

- Dashboard requires admin auth.
- Metric fetch partial failure UI.
- Cron last-run freshness.
- Backup freshness warning.
- Webhook/queue lag display.
- No secret leakage in metrics.

## Oncelik

P3: Health freshness ve partial failure UX.
