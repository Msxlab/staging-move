-- Require PKCE on mobile OAuth handoff rows.
--
-- Runtime already rejects PKCE-less exchange attempts and new create paths
-- require a valid code_challenge. These rows are short-lived (5 minutes), so
-- any legacy NULL/empty challenge rows can be removed before tightening the DB
-- invariant.

DELETE FROM `MobileOAuthCode`
WHERE `codeChallenge` IS NULL OR `codeChallenge` = '';

ALTER TABLE `MobileOAuthCode`
  MODIFY `codeChallenge` VARCHAR(128) NOT NULL;
