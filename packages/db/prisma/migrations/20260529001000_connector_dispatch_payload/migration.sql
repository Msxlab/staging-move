-- Self-contained outbox: carry an encrypted CanonicalAddressChange snapshot on
-- the dispatch row so the worker runs without the AddressChangeEvent model.
ALTER TABLE `ConnectorDispatch` ADD COLUMN `payloadEncrypted` TEXT NULL;
