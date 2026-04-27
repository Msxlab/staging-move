-- Backfill template links for transactional sends created before the
-- email logging layer stored EmailLog.templateId.

UPDATE `EmailLog` log
JOIN `EmailTemplate` tpl ON tpl.`slug` = 'email-verify'
SET log.`templateId` = tpl.`id`
WHERE log.`templateId` IS NULL
  AND (
    log.`subject` = 'Verify your LocateFlow email'
    OR log.`metadata` LIKE '%email-verify%'
    OR log.`metadata` LIKE '%email-verification%'
  );

UPDATE `EmailLog` log
JOIN `EmailTemplate` tpl ON tpl.`slug` = 'password-reset'
SET log.`templateId` = tpl.`id`
WHERE log.`templateId` IS NULL
  AND (
    log.`subject` IN ('Reset your LocateFlow password', 'Set your LocateFlow password')
    OR log.`metadata` LIKE '%password-reset%'
    OR log.`metadata` LIKE '%set-password%'
  );

UPDATE `EmailLog` log
JOIN `EmailTemplate` tpl ON tpl.`slug` = 'welcome'
SET log.`templateId` = tpl.`id`
WHERE log.`templateId` IS NULL
  AND (
    log.`subject` = 'Welcome to LocateFlow'
    OR log.`metadata` LIKE '%welcome%'
  );
