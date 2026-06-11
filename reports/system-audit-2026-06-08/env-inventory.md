# Environment Inventory

Durum: `.env.example`, kaynak `process.env.*` ve runtime-config katalogu karsilastirmasi.

## Sayilar

- Kaynak kodda bulunan `process.env.*` anahtari: 85.
- `.env.example` icindeki anahtar: 111.
- Runtime-config katalog anahtari: 103.
- Kaynakta kullanilip `.env.example` icinde olmayan anahtar: 35.
- Runtime-config katalogunda olup `.env.example` icinde olmayan anahtar: 28.

## Kaynakta Var, `.env.example` Icinde Yok

`ACCOUNT_DELETION_GRACE_DAYS`, `ACCOUNT_RESTORE_SECRET`, `ADMIN_ACTION_OTP_SECRET`, `ADMIN_APP_URL`, `ADMIN_SESSION_HANDLE_SECRET`, `AFFILIATE_POSTBACK_SECRET`, `ALLOW_ADMIN_TABLE_RESTORE`, `ALLOW_RESTORE_WITHOUT_SAFETY_BACKUP`, `AUTH_SECRET`, `COPPA_AGE_GATE_ENABLED`, `DIGITALOCEAN_APP_ID`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_ENV`, `EXPO_PUBLIC_MOBILE_ANDROID_STORE_PURCHASES_ENABLED`, `EXPO_PUBLIC_MOBILE_IOS_STORE_PURCHASES_ENABLED`, `EXPO_PUBLIC_MOBILE_OAUTH_REDIRECT_URI`, `EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED`, `EXPO_PUBLIC_SENTRY_DSN`, `GOOGLE_PLAY_TEST_PURCHASE_USER_EMAILS`, `GUIDED_PARTNERS`, `JWT_SECRET`, `MAIL_FROM`, `MYSQL_DATABASE_URL`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_RUNTIME`, `NODE_ENV`, `NOTIFICATION_PUSH_ENABLED`, `QA_RESETTABLE_ACCOUNT_EMAIL`, `RESEND_FROM`, `SECURITY_ALERT_WEBHOOK_URL`, `SECURITY_ALERTS_ENABLED`, `SQL_DUMP_READY_TIMEOUT_MS`, `TEST_AUTOMATION_ENABLED`, `VERCEL_ENV`.

Not:

- `NODE_ENV`, `VERCEL_ENV`, `NEXT_RUNTIME` gibi anahtarlar platform-provided kabul edilebilir.
- `EXPO_PUBLIC_API_URL` EAS profile'larda var, ama root `.env.example` icinde yok; mobile onboarding icin en azindan mobile bolumunde belgelenmeli.

## Runtime Config Katalogunda Var, `.env.example` Icinde Yok

`ADMIN_ALERT_EMAIL`, `ANTHROPIC_API_KEY`, `EMAIL_REPLY_TO`, `EXPECTED_PLAYSTORE_WEBHOOK_SUBJECT`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_SENTRY_DSN`, `FCC_BDC_API_BASE`, `FCC_BDC_API_KEY`, `FCC_BDC_ENABLED`, `GOOGLE_PLAY_OAUTH_CLIENT_ID`, `GOOGLE_PLAY_OAUTH_CLIENT_SECRET`, `GOOGLE_PLAY_OAUTH_REFRESH_TOKEN`, `GUIDED_PARTNERS`, `NEXT_PUBLIC_ADMIN_URL`, `NODE_ENV`, `NOTIFICATION_PUSH_ENABLED`, `OPENAI_API_KEY`, `PLACES_AUTOCOMPLETE_DAILY_LIMIT`, `QA_RESETTABLE_ACCOUNT_EMAIL`, `RECOMMENDATION_SCORING_WEIGHTS`, `RESEND_WEBHOOK_SECRET`, `STRIPE_PRICE_FAMILY_MONTHLY`, `STRIPE_PRICE_FAMILY_YEARLY`, `STRIPE_PRICE_INDIVIDUAL`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `SUPPORT_EMAIL`.

## Onerilen Siniflandirma

- Required production: DB URL, auth/JWT/admin secrets, field encryption, Stripe secret/webhook/price IDs, Resend key/from/support, cron/internal/impersonation secrets, backup storage, mobile store IDs/webhook config.
- Optional feature flag: workspace model, API connectors, FCC BDC, push notifications, security alerts, test automation, places daily limit.
- Platform-provided: `NODE_ENV`, `VERCEL_ENV`, `NEXT_RUNTIME`, deployment app IDs.
- Runtime-config editable: secret/API keys and operational feature values that katalogda editable olarak tasarlanmis.
- Deployment-only: values that must stay env-only or require redeploy.

## Aksiyon

- `.env.example` dosyasini bu siniflandirmaya gore bolumle.
- Runtime-config kataloguyla `.env.example` icin CI drift testi ekle.
- Drift testinde platform-provided allowlist ve dynamic env patterns (`AFFILIATE_POSTBACK_SECRET_*`) desteklenmeli.
