# Security Audit

## Baglanti Durumu

- Admin:
  - `/api/security`
  - `/api/security/dashboard`
  - `/api/security/key-rotation`
  - `/api/auth/sessions`
  - `/api/auth/login-history`
- Middleware IP rules, CSP, CSRF, body limit ve session fingerprint kontrolleri
  uyguluyor.

## Guvenlik

- Pozitifler: `httpOnly` admin cookie, strict same-site, DB-backed session hash,
  CSP nonce, origin/referer CSRF, IP blocklist, fingerprint mismatch handling,
  SUPER_ADMIN MFA setup gate, key rotation icin password step-up.
- Security endpoint'leri cogunlukla `settings` veya raw role check kullaniyor;
  `security` permission resource'u yok.
- `/api/security` GDPR requestleri, IP rules ve rate limit loglarini ADMIN
  seviyesinde donduruyor; PII/ops veri minimizasyonu zayif.

## Mantik ve Eksik

- IP rule add/toggle/delete icin password step-up yok. Yanlis blacklist admin
  lockout yaratabilir.
- IP address/type validasyonu zayif; CIDR/IP format kontrolu yok.
- GDPR status/resultUrl update icin step-up yok ve resultUrl format allowlist
  yok.
- `delete_ip_rule` mevcut kayit yoksa Prisma error ile 500'e dusebilir.
- Step-up grace `adminId` bazli in-memory; session/action/IP bagli degil.

## Oneriler

- `security` permission resource'u ekleyin.
- IP/GDPR mutasyonlari icin password step-up + format validation.
- Step-up cache'i `sessionId + action scope` ile baglayin.
- Security response'larinda IP/user-agent/gdpr detail masking uygulayin.
