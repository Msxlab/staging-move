# CLIENT-07 Mobile Offline/Error UX

## Kapsam

Offline mode, retry, stale cache, API error handling, loading/empty/error states.

## Olumlu Gozlemler

- Mobile API client testleri temel error davranislari icin zemin sagliyor.
- Offline/error UX ayri modul olarak ele alinmis; bu iyi bir kalite siniri.

## Riskler ve Sorular

- Offline iken billing/entitlement, deletion, consent, task completion gibi hassas state'ler stale kalabilir.
- Retry mekanizmasi duplicate create/update yaratmamalidir.
- Error mesajlari token/PII/secret leak etmemeli.

## Test/Task Listesi

- Network down on app launch.
- Retry after reconnect.
- Duplicate prevention.
- 401/403/409/429/500 UI handling.
- Stale entitlement safe fallback.
- PII-safe error display.

## Oncelik

P2/P3: Offline duplicate ve stale entitlement guvenligi.
