# LocateFlow Full System Audit TODO

Kural: Mevcut `.md` dosyalari ve memory/dokuman klasorleri kaynak olarak okunmayacak. Denetim kod, test, schema, config, route ve script dosyalarindan ilerleyecek.

## 0. Envanter ve Hazirlik
- [x] Workspace paketlerini ve app ayrimini kod/config uzerinden cikart.
- [x] Yeni denetim klasorunu olustur.
- [x] Admin, web, mobile, shared, db, connectors ve operasyonel modulleri ilk todo kapsamına al.
- [ ] Route, page, lib, component ve native kaynaklari moduller arasi baglariyla raporla.
- [ ] Mevcut kirli git durumunu rapora not et.

## 1. Admin Denetimi
- [ ] Admin app shell, middleware, layout, login ve set-password akislari.
- [ ] Admin auth, MFA, session, step-up, password, force change ve role/permission mantigi.
- [ ] Admin security, audit, logs, internal security event ve IP rules.
- [ ] Admin backup, import, retention, verify, sql dump, archive, storage ve cron backup.
- [ ] Admin user/team/workspace yonetimi, impersonation, hard-delete ve transfer ownership.
- [ ] Admin providers, coverage, logo ingest/fetch/upload, merge, governance ve state-rules.
- [ ] Admin subscriptions, billing, Stripe admin actions, refunds, invoices, plan changes.
- [ ] Admin blog, image upload, categories, tags, preview token, publish ve cleanup.
- [ ] Admin connectors, connector fallbacks, metrics, consents ve health checks.
- [ ] Admin acquisition, affiliate, sponsored, analytics, reports ve waitlist.
- [ ] Admin email templates, email health, notifications, help center ve tickets.
- [ ] Admin UI components, table hooks, saved views, bulk selection ve navigation.

## 2. Web Denetimi
- [ ] Web middleware, app layout, public shell, service worker ve instrumentation.
- [ ] Web auth: register, login, logout, email verification, password reset/change, MFA, OAuth.
- [ ] Web mobile auth bridge: native Apple, exchange, login ve mobile token akislari.
- [ ] Web account/profile/settings/privacy/export/delete/restore akislari.
- [ ] Web workspace, members, invitations, transfer, sync, managed sync, restore ve purge.
- [ ] Web dashboard, onboarding, legal acceptance ve consent akislari.
- [ ] Web addresses, address autocomplete/details/validation, maps static ve dossiers.
- [ ] Web moving, move tasks, migration, reminders, lifecycle nudges ve weekly alerts.
- [ ] Web services, custom providers, providers, saved, compare, recommendations ve feedback.
- [ ] Web budget, expenses, actuals, billing, subscription, Stripe checkout/portal/actions.
- [ ] Web mobile IAP, App Store, Play Store ve Stripe webhook akislari.
- [ ] Web connectors, connector-dispatch, connector webhook ve partner consents OAuth.
- [ ] Web notifications, push register, tracking, analytics ve admin digest cronlari.
- [ ] Web blog/public SEO/legal/static/public routes, llms routes ve revalidation.
- [ ] Web support/tickets/help/unsubscribe/waitlist/acquisition/affiliate/vehicles/movers.
- [ ] Web UI components, app pages, state store, client/server boundary ve tests.

## 3. Mobile Denetimi
- [ ] Expo/app config, router layout, auth tabs ve root navigation guardlari.
- [ ] Mobile auth: sign-in, sign-up, forgot/reset password, OAuth, setup password, Apple auth.
- [ ] Mobile local auth/security: secure store, app lock, password policy, PKCE ve post-auth routing.
- [ ] Mobile dashboard/tabs, addresses, budget, moving, services, providers ve compare.
- [ ] Mobile workspace, invitations, settings, profile, privacy, export, delete account ve 2FA.
- [ ] Mobile subscriptions/IAP, plan comparison, offers, App Review flags ve billing gates.
- [ ] Mobile API client, query client, offline/local cleanup, analytics, Sentry ve release config.
- [ ] Mobile push notifications, reminders, widget data, iOS widget target ve Android native config.
- [ ] Mobile i18n, theme, UI component library, forms, maps/browser helpers ve tests.

## 4. Shared Packages
- [ ] `packages/shared`: api client, validators, types, constants, runtime/env config.
- [ ] `packages/shared`: auth/security helpers, encryption, audit redaction, Sentry redaction.
- [ ] `packages/shared`: billing, entitlements, workspace entitlements ve billing metrics.
- [ ] `packages/shared`: relocation checklist, move task lifecycle/effects/classifier ve migration engine.
- [ ] `packages/shared`: provider coverage/integrity/domain, recommendation engine, budget planning.
- [ ] `packages/shared`: legal, blog, i18n helpers, timezone ve mobile export boundary.
- [ ] `packages/connectors`: core registry, manifest, dispatcher, executor, retry, circuit breaker, OAuth, HTTP client.
- [ ] `packages/connectors`: USPS connector, contract tests ve connector state handling.

## 5. DB ve Operasyon
- [ ] Prisma schema modelleri, iliskiler, unique/index, soft delete ve multi-tenant scope.
- [ ] Prisma migrations, baseline/custom-auth/workspaces/provider/recommendation/insights degisiklikleri.
- [ ] Seed dosyalari, provider/state catalogs, admin seed, blog seed ve migrate scripts.
- [ ] Docker, compose, Caddy, Ofelia cron, standalone prepare scripts ve deployment scripts.
- [ ] Root verify/test/build komutlari, package version uyumu, patched dependencies ve CI yuzeyi.

## 6. Moduller Arasi Baglar
- [ ] Web-admin paylasilan auth/session/cookie/runtime config farklarini karsilastir.
- [ ] Web-mobile API sozlesmesi, mobile endpoints, IAP ve OAuth handoff tutarliligi.
- [ ] Admin-web DB model kullanimi ve multi-tenant/permission sinirlari.
- [ ] Shared-db-app bagimliliklari, import boundary ve duplicated logic.
- [ ] Cron/webhook/idempotency/rate-limit/audit-alert zincirleri.

## 7. Dogrulama
- [ ] Targeted static checks: TypeScript, Vitest ve route-level smoke bulgulari.
- [ ] Kritik bulgular icin ilgili testleri calistir.
- [ ] TODO durumlarini guncelle.
- [ ] Tam kapanis raporunu yaz.
