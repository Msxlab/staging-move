# Modül Denetimi: Blog/Content

## 1. Modülün Amacı
Public blog/help/FAQ content and admin content management.

## 2. Ana Dosyalar
- `apps/web/src/app/api/blog/*`
- `apps/admin/src/app/api/blog/*`
- Prisma `BlogPost`, `BlogCategory`, `BlogTag`, `BlogRevision`, `BlogView`, `HelpArticle`, `FAQ`.

## 3. Bağlantılar
Admin, public site, storage/R2, SEO/IndexNow.

## 4. Veri Akışı
Admin content CRUD -> DB/storage -> public blog/help APIs/pages.

## 5. UI/UX Denetimi
Public blog/help exists.

## 6. API/Backend Denetimi
Some blog route tests exist; several adjacent route gaps remain.

## 7. Database Denetimi
Content models with status/revision/view.

## 8. Permission/Auth Denetimi
Admin mutations require admin/permissions; public reads allowed.

## 9. Edge Case Denetimi
HTML sanitization tests exist; upload content type allowlist exists.

## 10. Hata/Eksik/Yanlış Listesi
Admin content route test gaps.

## 11. Mantık Hataları
No critical issue proven.

## 12. Öneriler
Admin content permission tests and SEO revalidate tests.

## 13. Test Senaryoları
Draft/publish/archive, upload bad type, public slug not found.

## 14. Sonuç
⚠️ Riskli
