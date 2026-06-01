# CLIENT-06 Mobile Notifications/Push

## Kapsam

Push token registration, notification preferences, reminders/digests, unsubscribe parity.

## Olumlu Gozlemler

- Push mobile yuzeyi threat modelde ayri aktor olarak ele alinmis.
- Notification preferences web ve mobile icin ortak kavramlara baglanabiliyor.

## Riskler ve Sorular

- Push token stale/device change/logout durumlari E2E test edilmeli.
- Deleted/grace-deleted user'a push gonderilmemeli.
- Preference off durumunda hem email hem push delivery durmali.

## Test/Task Listesi

- Push permission grant/deny.
- Token register/update/remove.
- Logout token cleanup.
- Preference off.
- Deleted user skip.
- Reminder push timezone.

## Oncelik

P2/P3: Push lifecycle ve deleted user skip.
