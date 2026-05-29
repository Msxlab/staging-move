-- Split the connector token vault. Previously `tokenEncrypted` held
-- `refreshToken ?? accessToken` and the dispatcher used it as the Bearer access
-- token (so a refresh token would be sent as an access token → 401).
-- Now `tokenEncrypted` is the ACCESS token and `refreshTokenEncrypted` is the
-- refresh token used to mint new access tokens.

-- AlterTable
ALTER TABLE `PartnerConsent` ADD COLUMN `refreshTokenEncrypted` TEXT NULL;
