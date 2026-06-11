# Route Inventory

Durum: 2026-06-08 full-pass route envanteri.

## Sayilar

- Web route handler: 146 toplam.
- Web API route handler: 142.
- Admin route handler: 107.
- Web page/layout: 69.
- Admin page/layout: 56.
- Mobile Expo route dosyasi: 53.

## Web API Aileleri

| Aile | Route sayisi | Sorumluluk |
| --- | ---: | --- |
| `auth` | 21 | login/register/logout, OAuth, MFA, password reset, security state, mobile bridge |
| `cron` | 20 | billing, reminders, retention, connector dispatch, blog, synthetic monitor |
| `workspaces` | 13 | workspace CRUD, members, invitations, transfer, managed sync, restore/delete |
| `blog` | 6 | posts, image, view, revalidate, IndexNow |
| `invitations` | 5 | pending/direct invite landing, accept/decline |
| `mobile` | 5 | mobile auth exchange/login/apple native, IAP products/verify |
| `partner-consents` | 5 | consent list/revoke, OAuth initiate/callback, refresh |
| `providers` | 5 | list/detail, recommendations, compare, popular |
| `webhooks` | 4 | Stripe, Resend, App Store, Play Store |
| `notifications` | 4 | feed, preferences, read state |
| `stripe` | 3 | checkout, cancel, portal |
| `subscription` | 3 | actions, change plan, switch cycle |
| `moving` | 3 | moving plans, migration |
| `connectors` | 3 | catalog, changes, connector webhook |
| `addresses` | 3 | CRUD, validation |
| Other | 31 | profile, budget, services, tickets, tracking, consent, export, account, waitlist, health/ready, etc. |

## Admin API Aileleri

| Aile | Route sayisi | Sorumluluk |
| --- | ---: | --- |
| `providers` | 11 | provider CRUD, coverage, bulk ops, logo ops, export |
| `auth` | 11 | login/logout/me, MFA, sessions, password, force change, set password |
| `blog` | 10 | posts, publish, preview token, uploads, image, categories/tags |
| `subscriptions` | 8 | list, analytics, invoices, refunds, cancel, change plan, resync, revalidate |
| `workspaces` | 7 | admin workspace/member/invitation/transfer controls |
| `users` | 7 | user list/detail/export, hard delete, subscription actions |
| `backup` | 6 | backup list/create, download, SQL dump, verify, import, retention |
| `connectors` | 5 | config, healthcheck, consents, test connection |
| `analytics` | 5 | overview, activity, spending, admin activity |
| Other | 36 | moving, acquisition, security, team, state rules, cron, waitlist, logs, settings, notifications, reports, billing, health |

## Page / UI Surface

- Web app pages include public marketing/legal/auth pages plus authenticated dashboard, addresses, services, moving, budget, providers, support, notifications, settings/workspace/connections/subscription/privacy.
- Admin pages include dashboard, users, workspaces, providers, coverage/governance, connectors, connector metrics/fallbacks, backups, billing, subscriptions, analytics, logs, blog/content, security, runtime-config, feature-flags, team, support, reports.
- Mobile Expo routes include auth, tab dashboard/addresses/moving/services/more, address/service/move detail/edit/new, provider list/detail/compare, budget, reminders, help/tickets, notifications, onboarding, settings, workspace invite, OAuth and blog.

## Test Coverage Notu

- Web API sibling route test: 67/142 var, 75 eksik.
- Admin API sibling route test: 36/107 var, 71 eksik.
- Eksik sibling test otomatik olarak testsiz demek degildir; ancak route contract, auth, billing, workspace ve cron gibi kritik yuzeylerde dogrudan route test gerekir.
