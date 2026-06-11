# LocateFlow Full System Audit TODO

Kural: Mevcut `.md` dosyalari ve memory/dokuman klasorleri kaynak olarak okunmayacak. Denetim kod, test, schema, config, route ve script dosyalarindan ilerleyecek.

## 0. Envanter ve Hazirlik
- [x] Workspace paketlerini ve app ayrimini kod/config uzerinden cikart.
- [x] Yeni denetim klasorunu olustur.
- [x] Admin, web, mobile, shared, db, connectors ve operasyonel modulleri ilk todo kapsamına al.
- [x] Route, page, lib, component ve native kaynaklari moduller arasi baglariyla raporla.
- [x] Mevcut kirli git durumunu rapora not et.

## 1. Admin Denetimi
- [x] Admin app shell, middleware, layout, login ve set-password akislari.
- [x] Admin auth, MFA, session, step-up, password, force change ve role/permission mantigi.
- [x] Admin security, audit, logs, internal security event ve IP rules.
- [x] Admin backup, import, retention, verify, sql dump, archive, storage ve cron backup.
- [x] Admin user/team/workspace yonetimi, impersonation, hard-delete ve transfer ownership.
- [x] Admin providers, coverage, logo ingest/fetch/upload, merge, governance ve state-rules.
- [x] Admin subscriptions, billing, Stripe admin actions, refunds, invoices, plan changes.
- [x] Admin blog, image upload, categories, tags, preview token, publish ve cleanup.
- [x] Admin connectors, connector fallbacks, metrics, consents ve health checks.
- [x] Admin acquisition, affiliate, sponsored, analytics, reports ve waitlist.
- [x] Admin email templates, email health, notifications, help center ve tickets.
- [x] Admin UI components, table hooks, saved views, bulk selection ve navigation.

## 2. Web Denetimi
- [x] Web middleware, app layout, public shell, service worker ve instrumentation.
- [x] Web auth: register, login, logout, email verification, password reset/change, MFA, OAuth.
- [x] Web mobile auth bridge: native Apple, exchange, login ve mobile token akislari.
- [x] Web account/profile/settings/privacy/export/delete/restore akislari.
- [x] Web workspace, members, invitations, transfer, sync, managed sync, restore ve purge.
- [x] Web dashboard, onboarding, legal acceptance ve consent akislari.
- [x] Web addresses, address autocomplete/details/validation, maps static ve dossiers.
- [x] Web moving, move tasks, migration, reminders, lifecycle nudges ve weekly alerts.
- [x] Web services, custom providers, providers, saved, compare, recommendations ve feedback.
- [x] Web budget, expenses, actuals, billing, subscription, Stripe checkout/portal/actions.
- [x] Web mobile IAP, App Store, Play Store ve Stripe webhook akislari.
- [x] Web connectors, connector-dispatch, connector webhook ve partner consents OAuth.
- [x] Web notifications, push register, tracking, analytics ve admin digest cronlari.
- [x] Web blog/public SEO/legal/static/public routes, llms routes ve revalidation.
- [x] Web support/tickets/help/unsubscribe/waitlist/acquisition/affiliate/vehicles/movers.
- [x] Web UI components, app pages, state store, client/server boundary ve tests.

## 3. Mobile Denetimi
- [x] Expo/app config, router layout, auth tabs ve root navigation guardlari.
- [x] Mobile auth: sign-in, sign-up, forgot/reset password, OAuth, setup password, Apple auth.
- [x] Mobile local auth/security: secure store, app lock, password policy, PKCE ve post-auth routing.
- [x] Mobile dashboard/tabs, addresses, budget, moving, services, providers ve compare.
- [x] Mobile workspace, invitations, settings, profile, privacy, export, delete account ve 2FA.
- [x] Mobile subscriptions/IAP, plan comparison, offers, App Review flags ve billing gates.
- [x] Mobile API client, query client, offline/local cleanup, analytics, Sentry ve release config.
- [x] Mobile push notifications, reminders, widget data, iOS widget target ve Android native config.
- [x] Mobile i18n, theme, UI component library, forms, maps/browser helpers ve tests.

## 4. Shared Packages
- [x] `packages/shared`: api client, validators, types, constants, runtime/env config.
- [x] `packages/shared`: auth/security helpers, encryption, audit redaction, Sentry redaction.
- [x] `packages/shared`: billing, entitlements, workspace entitlements ve billing metrics.
- [x] `packages/shared`: relocation checklist, move task lifecycle/effects/classifier ve migration engine.
- [x] `packages/shared`: provider coverage/integrity/domain, recommendation engine, budget planning.
- [x] `packages/shared`: legal, blog, i18n helpers, timezone ve mobile export boundary.
- [x] `packages/connectors`: core registry, manifest, dispatcher, executor, retry, circuit breaker, OAuth, HTTP client.
- [x] `packages/connectors`: USPS connector, contract tests ve connector state handling.

## 5. DB ve Operasyon
- [x] Prisma schema modelleri, iliskiler, unique/index, soft delete ve multi-tenant scope.
- [x] Prisma migrations, baseline/custom-auth/workspaces/provider/recommendation/insights degisiklikleri.
- [x] Seed dosyalari, provider/state catalogs, admin seed, blog seed ve migrate scripts.
- [x] Docker, compose, Caddy, Ofelia cron, standalone prepare scripts ve deployment scripts.
- [x] Root verify/test/build komutlari, package version uyumu, patched dependencies ve CI yuzeyi.

## 6. Moduller Arasi Baglar
- [x] Web-admin paylasilan auth/session/cookie/runtime config farklarini karsilastir.
- [x] Web-mobile API sozlesmesi, mobile endpoints, IAP ve OAuth handoff tutarliligi.
- [x] Admin-web DB model kullanimi ve multi-tenant/permission sinirlari.
- [x] Shared-db-app bagimliliklari, import boundary ve duplicated logic.
- [x] Cron/webhook/idempotency/rate-limit/audit-alert zincirleri.

## 7. Dogrulama
- [x] Targeted static checks: TypeScript, Vitest ve route-level smoke bulgulari.
- [x] Kritik bulgular icin ilgili testleri calistir.
- [x] TODO durumlarini guncelle.
- [x] Tam kapanis raporunu yaz.

## 8. Duzeltme Takibi
- [x] W-01/M-01: Web `set_password` action'i kaldirildi; web ve mobile `setup-password` ekranlari `request_set_password` email-link akisi kullanacak sekilde guncellendi.
- [x] W-01/M-01: Web post-auth/onboarding password setup zorlamasi kaldirildi; OAuth-only kullanici link beklerken uygulamada kilitlenmez.
- [x] W-01/M-01: Hedef testler ve web/mobile TypeScript kontrolu calistirildi.
- [x] A-04: Admin billing override validator final effective tarih degerleri uzerinden strict hale getirildi.
- [x] A-04: Trial/free access/manual premium null-date regresyon testleri eklendi; admin TypeScript ve full admin test paketi calistirildi.
- [ ] Siradaki yuksek oncelik: A-05 - Admin hard-delete DB silme sonrasi Stripe cancel failure'ini yutabiliyor.
