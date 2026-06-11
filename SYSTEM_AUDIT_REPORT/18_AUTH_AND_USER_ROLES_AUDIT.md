# Auth ve Kullanıcı Rolleri Denetimi

## Authentication Akışları

- Register/login/logout.
- Email verification.
- Password reset/change.
- MFA setup/confirm/disable.
- OAuth Google/Apple.
- Mobile auth login/exchange/Apple native.
- Admin login/MFA/password confirmation.

## Session Yönetimi

- User: JWT/cookie + DB `UserLoginSession`, fingerprint checks.
- Admin: Admin JWT + `AdminSession`, MFA state, fingerprint.
- Middleware edge-level JWT kontrolü; route-level DB validation.

## Rol: Guest

### Ne Yapabilir?
Public pages, public help/provider/blog endpoints, auth initiation.

### Ne Yapamaz?
App data, subscription portal, exports, admin.

### Riskler
Public API allowlist genişlerse regression.

### Öneriler
Public allowlist snapshot tests.

## Rol: User/Customer

### Ne Yapabilir?
Own/workspace scoped addresses, services, moving plans, budgets, notifications, subscription, export, support.

### Ne Yapamaz?
Başka kullanıcı/workspace data'sı, admin actions.

### UI'da Gösterilen Yetkiler
App nav ve settings.

### Backend'de Uygulanan Yetkiler
`requireDbUserId`, `requireVerifiedUser`, `resolveWorkspaceDataScope`, `assertScopedRecordAction`.

### Riskler
Route test gaps.

### Öneriler
Ownership/IDOR tests.

## Rol: Workspace Owner/Admin/Member/Child/View-only

### Ne Yapabilir?
Workspace role matrix'e göre shared data erişimi ve actionlar.

### Backend Karşılığı
`Workspace`, `WorkspaceMember`, `workspace-context.ts`, `workspace-data-scope.ts`.

### Riskler
Workspace API route'larının bir kısmında adjacent test eksikleri var.

### Öneriler
Role matrix testleri.

## Rol: Admin

### Ne Yapabilir?
Permissionlarına göre admin operasyonları.

### Backend Karşılığı
`requireAdmin`, `requirePermission`, `AdminPermission`, `AdminAuditLog`.

### Riskler
Process-local rate limit; content/analytics route test gaps.

### Öneriler
Shared rate limit, permission tests.

## Rol: Super Admin / Sensitive Admin

### Ne Yapabilir?
Security/runtime config/high-risk admin işlemleri.

### Backend Karşılığı
MFA setup gate, password confirmation helper.

### Riskler
Her destructive route için password confirm coverage doğrulanmalı.

## Auth Bulguları

| Kontrol | Durum |
|---|---|
| Register/login/logout | ✅ |
| Password reset | ✅ |
| Email verification | ✅ |
| OAuth/social login | ✅ |
| Mobile auth exchange | ✅ |
| Admin login ayrımı | ✅ |
| Role-based access | ✅/⚠️ |
| Backend authorization | ✅ |
| Sadece UI gizleme riski | Kanıtlanmadı |
| Expired session behavior | ✅ |

## Öneriler

1. Public/private route inventory testleri.
2. Workspace role matrix tests.
3. Admin destructive action password confirmation tests.
4. Mobile auth expired session/offline tests.
