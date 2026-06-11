# Modül Denetimi: Support

## 1. Modülün Amacı
Help center, support tickets and ticket messages.

## 2. Ana Dosyalar
- `apps/web/src/app/api/tickets/*`
- `apps/mobile/app/help/*`
- `apps/admin/src/app/api/tickets/*`
- Prisma `SupportTicket`, `TicketMessage`, `HelpArticle`, `FAQ`.

## 3. Bağlantılar
User, admin, email/notifications, help center content.

## 4. Veri Akışı
User ticket -> DB -> admin support -> responses/messages.

## 5. UI/UX Denetimi
Mobile help/tickets screens exist.

## 6. API/Backend Denetimi
Ticket route tests present in web/admin for some routes; admin tickets route gap noted.

## 7. Database Denetimi
SupportTicket and TicketMessage models.

## 8. Permission/Auth Denetimi
User own tickets; admin requires permission.

## 9. Edge Case Denetimi
Closed ticket reply, attachment not assessed, admin assignment.

## 10. Hata/Eksik/Yanlış Listesi
Admin route test gaps.

## 11. Mantık Hataları
No critical issue proven.

## 12. Öneriler
Support route permission and status transition tests.

## 13. Test Senaryoları
Create ticket, list own, admin reply, close/reopen.

## 14. Sonuç
⚠️ Riskli
