# Backup Key Escrow SOP

This SOP protects the `FIELD_ENCRYPTION_KEY` used to decrypt LocateFlow backup archives.

## Ownership

- Primary owner: infrastructure/operator lead.
- Secondary owner: security/admin lead.
- Executive recovery approver: founder or designated business owner.

## Custody Model

Use 2-of-3 offline custody until a managed KMS design is approved:

1. Store share A in the company password manager vault with emergency access enabled.
2. Store share B on encrypted removable media in a physical safe.
3. Store share C in a sealed recovery envelope held by the executive recovery approver.

No single person should be able to recover the production key alone.

## Rotation

1. Create a fresh 64-character hex `FIELD_ENCRYPTION_KEY`.
2. Store the new key using the custody model above before deploying it.
3. Deploy the new key to the target environment.
4. Create and verify a new encrypted backup.
5. Run a DRY_RUN restore against a disposable database.
6. Keep old key custody material until all backups encrypted with the old key have expired or been re-encrypted through an approved process.

## If The Key Is Lost

- Existing encrypted app-level backups cannot be decrypted.
- Immediately preserve managed database snapshots and point-in-time recovery windows.
- Rotate the key, create a new backup, and record the recovery gap in the incident log.

## Future Work

Move from offline split custody to a dedicated KMS/Vault-backed design in the `dr-key-escrow` branch after provider, budget, and access policy decisions are approved.
