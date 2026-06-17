-- LocateFlow DigitalOcean -> Dokploy migration count checks.
-- Run against the source MySQL database before dump and against the restored
-- Dokploy MySQL database after restore. This prints counts only, not row data.

SELECT '_prisma_migrations' AS table_name, COUNT(*) AS row_count FROM `_prisma_migrations`
UNION ALL SELECT 'RuntimeConfigEntry', COUNT(*) FROM `RuntimeConfigEntry`
UNION ALL SELECT 'User', COUNT(*) FROM `User`
UNION ALL SELECT 'AdminUser', COUNT(*) FROM `AdminUser`
UNION ALL SELECT 'Subscription', COUNT(*) FROM `Subscription`
UNION ALL SELECT 'Address', COUNT(*) FROM `Address`
UNION ALL SELECT 'ServiceProvider', COUNT(*) FROM `ServiceProvider`
UNION ALL SELECT 'SavedProvider', COUNT(*) FROM `SavedProvider`
UNION ALL SELECT 'UserCustomProvider', COUNT(*) FROM `UserCustomProvider`
UNION ALL SELECT 'MoveTask', COUNT(*) FROM `MoveTask`
UNION ALL SELECT 'EmailLog', COUNT(*) FROM `EmailLog`
UNION ALL SELECT 'ConnectorDispatch', COUNT(*) FROM `ConnectorDispatch`
UNION ALL SELECT 'AddressChangeEvent', COUNT(*) FROM `AddressChangeEvent`
ORDER BY table_name;

SELECT
  'RuntimeConfigEntry_active' AS metric,
  COUNT(*) AS count
FROM `RuntimeConfigEntry`
WHERE `isActive` = TRUE;

