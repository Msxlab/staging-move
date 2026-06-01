# ADMIN-08 Admin Support/Tickets

## Kapsam

Admin ticket queue, assignment, reply, status, user visibility, audit, notifications.

## Olumlu Gozlemler

- Support workflow admin ve user modulleri arasinda ayri bir operasyonel yuzey.
- Ticket verisi threat modelde hassas data olarak tanimlanmis.

## Riskler ve Sorular

- Admin lower-role ticket access PII exposure yaratabilir.
- Reply content sanitizer ve email template render'i test edilmeli.
- Account deletion/export/backup kapsaminda ticket data unutulmamali.

## Test/Task Listesi

- Ticket queue permission.
- Assignment/status change audit.
- Admin reply -> user sees/gets notification.
- XSS payload in message.
- Deleted user ticket handling.
- Export/backup coverage.

## Oncelik

P2/P3: Support PII permissions ve privacy coverage.
