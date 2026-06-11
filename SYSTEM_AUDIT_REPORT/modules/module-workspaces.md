# Modül Denetimi: Workspaces

## 1. Modülün Amacı
Family/household/team data sharing, membership and role-scoped access.

## 2. Ana Dosyalar
- `packages/db/prisma/schema.prisma`: `Workspace`, `WorkspaceMember`, `WorkspaceInvitation`, `WorkspaceAuthChallenge`.
- `apps/web/src/lib/workspace-context.ts`
- `apps/web/src/lib/workspace-data-scope.ts`
- `apps/web/src/app/api/workspaces/*`

## 3. Bağlantılar
Billing seats, addresses, services, moving, connectors, invitations.

## 4. Veri Akışı
Owner creates/invites -> member accepts -> scoped context -> domain record access.

## 5. UI/UX Denetimi
Settings/workspace and related flows exist.

## 6. API/Backend Denetimi
Feature flag and role/scoped helpers present.

## 7. Database Denetimi
Workspace membership and invitation models.

## 8. Permission/Auth Denetimi
Backend role checks central.

## 9. Edge Case Denetimi
Owner transfer, member leave/remove, child/view-only restrictions.

## 10. Hata/Eksik/Yanlış Listesi
Adjacent route tests missing for some workspace routes.

## 11. Mantık Hataları
No P0 found; role matrix test coverage should be strengthened.

## 12. Öneriler
Workspace role matrix tests.

## 13. Test Senaryoları
Owner/admin/member/child/view-only CRUD permissions.

## 14. Sonuç
⚠️ Riskli
