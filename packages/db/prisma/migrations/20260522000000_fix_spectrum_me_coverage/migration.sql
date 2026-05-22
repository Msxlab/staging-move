-- The "Spectrum Maine" catalog row was accidentally widened to several states,
-- including CA, which made it appear in unrelated destination recommendations.
UPDATE `ServiceProvider`
SET `states` = '["ME"]',
    `zipCodes` = '[]'
WHERE `slug` = 'spectrum-me';

DELETE `coverage`
FROM `ServiceProviderCoverage` AS `coverage`
INNER JOIN `ServiceProvider` AS `provider`
  ON `provider`.`id` = `coverage`.`providerId`
WHERE `provider`.`slug` = 'spectrum-me';

INSERT INTO `ServiceProviderCoverage` (`id`, `providerId`, `state`, `zipPrefix`, `zipExact`, `createdAt`)
SELECT CONCAT('cov_', LEFT(REPLACE(UUID(), '-', ''), 26)), `provider`.`id`, 'ME', NULL, NULL, NOW()
FROM `ServiceProvider` AS `provider`
WHERE `provider`.`slug` = 'spectrum-me';
