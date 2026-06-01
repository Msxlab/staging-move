# WEB-13 Support/Help/Tickets

## Kapsam

Help center, support ticket create/list/detail/messages, admin support baglantisi, attachments/content sanitization.

## Olumlu Gozlemler

- Public help center middleware tarafinda session gerektirmeden render edilebiliyor.
- Support tickets threat modelde hassas veri olarak dogru siniflandirilmis.
- Admin support moduluyle operasyonel takip dusunulmus.

## Riskler ve Sorular

- Ticket/message ownership ve admin/user role ayrimi DB-backed test edilmeli.
- Ticket icerigi PII ve potansiyel HTML/markdown payload tasiyabilir; sanitizer/render kontrati izlenmeli.
- Account deletion/export kapsaminda SupportTicket/TicketMessage backup/export eksikleri ADMIN-10'da not edildi.
- Email notification ile ticket reply arasinda preference ve unsubscribe etkisi kontrol edilmeli.

## Test/Task Listesi

- User ticket create/list/detail.
- Cross-user ticket IDOR engeli.
- Admin reply -> user notification.
- User reply -> admin queue.
- Deleted user ticket visibility.
- Export/deletion/backup kapsam.

## Oncelik

P2: Ticket ownership ve privacy/data ops kapsam testi.
