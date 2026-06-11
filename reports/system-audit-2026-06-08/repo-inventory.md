# Repo Inventory

Durum: 2026-06-08 ilk full-pass envanter.

## Ilk Gozlem

- Monorepo kokunde `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` ve `turbo.json` var.
- Ana uygulamalar `apps/` altinda:
  - `apps/web`
  - `apps/admin`
  - `apps/mobile`
- Paylasilan paketler `packages/` altinda:
  - `packages/shared`
  - `packages/db`
  - `packages/connectors`
- Operasyonel yuzeyler:
  - `docker/`
  - `scripts/`
  - root `Dockerfile`
  - `docker-compose*.yml`

## Teknoloji Yigini

- Package manager: `pnpm@9.15.0`.
- Node engine: `22.x`.
- Build orchestrator: Turborepo (`turbo.json`).
- Web app: Next.js `16.2.6`, React `19.2.x`, next-intl, Tailwind, Sentry, Stripe, TanStack Query, Vitest, Playwright.
- Admin app: Next.js `16.2.6`, React `19.2.x`, next-intl, Tailwind, Tiptap, Sentry, Stripe, Vitest.
- Mobile app: Expo `~55.0.26`, React Native `0.83.6`, Expo Router, React Query, NativeWind, Expo IAP, SecureStore, Notifications, Android widget target.
- DB: Prisma `5.22.0`, MySQL-oriented env/config, soft-delete extension.
- Connectors: local framework package with core registry/executor/dispatcher/OAuth/retry/circuit-breaker plus USPS module.

## Dosya Sayilari

Kod/dokuman disi eski raporlar dislanarak ilk sayim:

- `apps/web`: 687 dosya
- `apps/admin`: 420 dosya
- `apps/mobile`: 226 dosya
- `packages/shared`: 60 dosya
- `packages/db`: 90 dosya
- `packages/connectors`: 37 dosya
- `scripts`: 30 dosya
- `docker`: 7 dosya

## Test Yuzeyi

- `apps/web`: 473 source TS/TSX, 183 test/spec dosyasi.
- `apps/admin`: 307 source TS/TSX, 99 test/spec dosyasi.
- `apps/mobile`: 140 source TS/TSX, 17 test/spec dosyasi.
- `packages/shared`: 33 source TS, 25 test dosyasi.
- `packages/db`: 25 source TS, 0 test dosyasi gorundu.
- `packages/connectors`: 20 source TS, 16 test dosyasi.

API route sibling-test sayimi:

- Web API: 142 `route.ts`; 67'sinde sibling `route.test.ts`; 75 route icin sibling test yok. Toplam `route.test.ts` dosyasi: 86.
- Admin API: 107 `route.ts`; 36'sinda sibling `route.test.ts`; 71 route icin sibling test yok. Toplam `route.test.ts` dosyasi: 52.

## Workspace Paket Baglantilari

Import sayimi kaynak dosyalardan:

- `apps/web/src`: `@locateflow/shared` 86, `@locateflow/db` 11, `@locateflow/connectors` 10.
- `apps/admin/src`: `@locateflow/shared` 27, `@locateflow/db` 6, `@locateflow/connectors` 4.
- `apps/mobile/app`: `@locateflow/shared` 11.
- `apps/mobile/src`: `@locateflow/shared` 12.
- Mobile, DB ve connectors paketlerini dogrudan import etmiyor; web API uzerinden konusuyor.

## Route / UI Sayilari

- Web route handler: 146 toplam, 142 API route handler.
- Admin route handler: 107.
- Web page/layout: 69.
- Admin page/layout: 56.
- Mobile Expo route dosyasi: 53.

Detay: `route-inventory.md`.

## Env / Runtime Config

- Kaynak `process.env.*` anahtari: 85.
- `.env.example` anahtari: 111.
- Runtime-config katalog anahtari: 103.
- Drift bulgusu: F-006.

Detay: `env-inventory.md`.

## Sonraki Kanit Toplama

- Package manifestleri okundu.
- Next.js/Expo konfigleri okundu.
- Route ve API dosyalari otomatik sayildi.
- Test kapsami dosya seviyesinde ilk tur haritalandi.
- Route handler davranislari ve client endpoint sozlesmeleri ilk-pass incelendi.
- Devam backlog'u `todo.md` ve `recommendations.md` icinde.
