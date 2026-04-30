# Admin Team Audit

## Baglanti Durumu

- Sidebar route: `/team`
- Admin API: `/api/team`, `/api/team/[id]`
- Auth sessions/login history ile bagli.

## Guvenlik

- Read `admin_users canRead` + ADMIN.
- Create SUPER_ADMIN + password step-up.
- Sensitive update SUPER_ADMIN + password step-up.
- Delete/archive SUPER_ADMIN + password step-up, sessions revoked.
- New admin password policy minimum 12 chars + uppercase/lowercase/number.

## Mantik ve Eksik

- Sidebar item `Admin Team` icin `nameKey: "users"` kullaniliyor. Bu yuzden UI
  ikinci kez "Users" label'i gosteriyor; ekran goruntusundeki duplicate Users
  bunun sonucu.
- `ADMIN_RESOURCES` eksik oldugu icin yeni admin permission matrisi modern
  modulleri kapsamiyor.
- PATCH role hierarchy kontrolu equal/higher admin edit'i engelliyor; guvenli
  ama bazi self profile non-sensitive edit senaryolarini da kapatabilir.
- MFA zorunlulugu sadece SUPER_ADMIN setup gate olarak uygulanmis. ADMIN gibi
  destek/billing goren roller icin zorunlu MFA yok.

## Oneriler

- Sidebar `nameKey` `adminTeam` yapilip i18n'e eklenmeli.
- Permission matrix tum admin modullerini kapsayacak sekilde genisletilip
  migration/backfill yapilmali.
- ADMIN+ icin MFA policy dusunulmeli.
- Self profile edit ayri endpoint'e alinmali.
