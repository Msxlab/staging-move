# 00 - Kod Envanteri

Bu dosya sadece kod/config/schema/script taramasindan olusturuldu. Mevcut `.md` raporlar, memory klasorleri ve onceki audit dokumanlari kaynak olarak okunmadi.

## Workspace
- Root package: `locateflow`
- Workspaces: `apps/*`, `packages/*`
- Ana uygulamalar: `apps/web`, `apps/admin`, `apps/mobile`
- Paylasilan paketler: `packages/shared`, `packages/db`, `packages/connectors`
- Operasyon yuzeyi: root scripts, Docker/compose/Caddy/Ofelia, Prisma migrations/seeds

## Dosya Yogunlugu
- `apps/web/src`: 739 dosya
- `apps/admin/src`: 435 dosya
- `apps/mobile/src`: 128 dosya
- `apps/mobile/app`: 53 dosya
- `packages/db/prisma`: 86 dosya
- `packages/shared/src`: 61 dosya
- `packages/connectors/src`: 34 dosya
- `packages/db/src`: 5 dosya

## Test/Verify Komutlari
- Root verify: `pnpm verify:typecheck`, `pnpm verify:tests`, `pnpm verify:ci`
- Web: `pnpm --filter @locateflow/web test`, `pnpm --filter @locateflow/web exec tsc --noEmit`
- Admin: `pnpm --filter @locateflow/admin test`, `pnpm --filter @locateflow/admin exec tsc --noEmit`
- Mobile: `pnpm --filter @locateflow/mobile test`, `pnpm --filter @locateflow/mobile exec tsc --noEmit`
- DB: `pnpm --filter @locateflow/db exec tsc --noEmit`, Prisma migrate/generate/seed scripts
- Connectors: root scripts refer to `@locateflow/connectors` typecheck/test

## Ilk Kapsam Notlari
- Git status denetim basinda kirliydi; cok sayida auth, backup, webhook, runtime-config ve IP rule dosyasinda degisiklik vardi. Bunlar kullanici/onceki calisma degisikligi kabul edilerek geri alinmayacak.
- `apps/web` Next.js 16, React 19, Stripe, Sentry, Upstash rate limit, Resend, connector ve mobile bridge yuzeylerini iceriyor.
- `apps/admin` Next.js 16, admin auth/permissions, backup, provider governance, billing/subscription, blog ve security operational yuzeylerini iceriyor.
- `apps/mobile` Expo 55/React Native 0.83, Expo Router, Secure Store, IAP, push, OAuth, local app lock ve widget yuzeylerini iceriyor.
- `packages/shared` is kurallari ve app'ler arasi sozlesme katmani; `packages/db` Prisma schema/migration/seed katmani; `packages/connectors` harici connector core runtime katmani.
