const USER_JWT_SECRET_ERROR = "USER_JWT_SECRET must be set and at least 32 characters";

let cachedSecret: { raw: string; key: Uint8Array } | null = null;

export function validateUserJwtSecret(value = process.env.USER_JWT_SECRET): string {
  if (!value || value.length < 32) {
    throw new Error(USER_JWT_SECRET_ERROR);
  }
  return value;
}

export function getUserJwtSecretKey(): Uint8Array {
  const raw = validateUserJwtSecret();
  if (cachedSecret?.raw === raw) return cachedSecret.key;

  const key = new TextEncoder().encode(raw);
  cachedSecret = { raw, key };
  return key;
}

export function tryGetUserJwtSecretKey(): Uint8Array | null {
  try {
    return getUserJwtSecretKey();
  } catch {
    return null;
  }
}
