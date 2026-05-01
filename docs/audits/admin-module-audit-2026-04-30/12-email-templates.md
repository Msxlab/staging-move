# Email Templates Audit

## Baglanti Durumu

- Admin: `/api/email-templates`
- Web email service DB template'lerini kismen kullaniyor; bazi transactional
  email'ler hala inline.
- Mobile ayni web backend email akislari uzerinden etkileniyor.

## Guvenlik

- Permission `settings` altinda; email template icin ayri permission yok.
- Template body raw HTML. Preview iframe sandbox ile izole, admin panel XSS riski
  dusuk; ama gonderilen email icerigi icin policy/sanitization yok.
- Security/transactional template degisikligi icin password step-up yok.

## Mantik ve Eksik

- `variables` alani UI tarafinda comma-separated string gibi gonderiliyor;
  API `JSON.stringify(variables)` yaptigi icin array yerine JSON string sekli
  kalabilir. Data shape hatasi riski var.
- Required template silme korumasi var ama version/rollback yok.
- Template test-send/preview kalite kontrolu sinirli.

## Oneriler

- `email_templates` permission ekleyin.
- Variable schema'yi array olarak validate edin.
- Transactional/security template update/delete icin step-up ve version history.
- Inline email'leri DB template kullanimina tasirken fallback politikasini
  dokumante edin.
