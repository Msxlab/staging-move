/**
 * Single source of truth for EVERY column encrypted with FIELD_ENCRYPTION_KEY.
 *
 * The key-rotation route re-encrypts exactly the (model, field) pairs listed
 * here. If a field is encrypted somewhere in the codebase but missing from this
 * list, it becomes PERMANENTLY UNDECRYPTABLE the first time the key is rotated
 * and the old key is retired (hard 500s in production — decrypt() throws).
 *
 * When you add a new encrypted column anywhere (a new `encrypt(...)` write
 * site), you MUST add it here. The drift guard in key-rotation-fields.test.ts
 * scans schema.prisma and fails CI if a conventionally-named encrypted column
 * (`*Encrypted`, `mfaSecret`, or a field commented `FIELD_ENCRYPTION_KEY`) is
 * not covered below — but un-conventionally-named fields (Service.* and
 * Address.formattedAddress) are only guarded by the explicit snapshot test, so
 * keep both in sync.
 */
export type EncryptedModel = {
  /** rawPrisma delegate name (also used as the stats/audit label). */
  model: string;
  /** Primary-key field, used for stable pagination + the update `where`. */
  idField: string;
  /** Encrypted text columns on this model to re-encrypt. */
  fields: string[];
};

export const ENCRYPTED_MODELS: EncryptedModel[] = [
  // Account credentials for a user's services (USPS, banks, utilities, ...).
  { model: "service", idField: "id", fields: ["accountNumber", "username", "phone", "email", "notes"] },
  // Human-readable address line (the structured parts stay plaintext).
  { model: "address", idField: "id", fields: ["formattedAddress"] },
  // TOTP secrets — losing these locks every MFA-enabled account out.
  { model: "user", idField: "id", fields: ["mfaSecret"] },
  { model: "adminUser", idField: "id", fields: ["mfaSecret"] },
  // Encrypted runtime config secrets (API keys, connector credentials).
  { model: "runtimeConfigEntry", idField: "id", fields: ["valueEncrypted"] },
  // Partner OAuth access/refresh tokens.
  { model: "partnerConsent", idField: "id", fields: ["tokenEncrypted", "refreshTokenEncrypted"] },
  // Connector outbox: partner confirmation numbers + the canonical payload snapshot.
  { model: "connectorDispatch", idField: "id", fields: ["confirmationEncrypted", "payloadEncrypted"] },
  // Lead-gen (R3): the consumer's name/contact/notes for a moving-quote request.
  { model: "lead", idField: "id", fields: ["payloadEncrypted"] },
];
