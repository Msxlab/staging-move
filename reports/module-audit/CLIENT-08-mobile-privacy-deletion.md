# CLIENT-08 Mobile Privacy/Deletion

## Kapsam

Mobile data export/deletion entry points, local data cleanup, session invalidation, restore/grace UX.

## Olumlu Gozlemler

- Web privacy/deletion mantigi mobile tarafindan kullanilabilecek API kontratlari sunuyor.
- Account deletion session invalidation server tarafinda dusunulmus.

## Riskler ve Sorular

- Account deletion sonrasi mobile secure storage/local cache temizligi emulator E2E ile kanitli degil.
- Grace restore veya deletion scheduled state mobile UI'da yanlis action gosterebilir.
- Export/deletion step-up mobile'da web ile ayni sertlikte olmali.

## Test/Task Listesi

- Delete request from mobile.
- Grace scheduled banner/state.
- Restore token flow.
- Final purge -> app forced logout.
- Local cache clear.
- Export request/download UX.

## Oncelik

P2: Mobile deletion/local data cleanup E2E.
