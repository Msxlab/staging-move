# Help Center Audit

## Baglanti Durumu

- Admin: `/api/help-center`
- Web/mobile public help: `/api/help`
- Web ve mobile content'i text olarak render ediyor; HTML execute edilmiyor.

## Guvenlik

- Permission `settings` altinda; ayri help-center permission yok.
- Public endpoint sadece published/uygun scope icerigi donduruyor.
- Icerik text olarak basildigi icin XSS riski dusuk.

## Mantik ve Eksik

- Slug format/uniqueness hatalari server tarafinda ozel hata mesajina
  cevrilmiyor.
- Locale/i18n, versioning, draft review ve rollback yok.
- Delete hard delete.

## Oneriler

- `help_center` permission kaynagi.
- Slug/body/title zod validation ve duplicate handling.
- Versioning + publish workflow.
- Hard delete yerine archive.
