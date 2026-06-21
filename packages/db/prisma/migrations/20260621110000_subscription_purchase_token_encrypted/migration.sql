-- Store new Play Store purchase tokens with app-level encryption.
-- Existing plaintext values in Subscription.purchaseToken are left as legacy
-- fallback rows; the application rewrites active rows into the encrypted
-- column on the next successful store validation because FIELD_ENCRYPTION_KEY
-- is only available in the app runtime, not inside this SQL migration.

ALTER TABLE `Subscription`
  ADD COLUMN `purchaseTokenEncrypted` TEXT NULL;
