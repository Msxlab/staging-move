import { decrypt, encrypt, isEncrypted } from "@/lib/shared-encryption";

const SERVICE_SENSITIVE_FIELDS = [
  "accountNumber",
  "username",
  "phone",
  "email",
  "notes",
] as const;

type ServiceSensitiveField = (typeof SERVICE_SENSITIVE_FIELDS)[number];
type ServiceSensitiveValue = string | null | undefined;

function encryptValue(value: ServiceSensitiveValue): ServiceSensitiveValue {
  if (!value || isEncrypted(value)) return value;
  return encrypt(value);
}

function decryptValue(value: ServiceSensitiveValue): ServiceSensitiveValue {
  if (!value) return value;
  return decrypt(value);
}

export function encryptServiceSensitiveFields<T extends Record<string, any>>(data: T): T {
  const next: Record<string, any> = { ...data };
  for (const field of SERVICE_SENSITIVE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(next, field)) {
      next[field] = encryptValue(next[field as ServiceSensitiveField]);
    }
  }
  return next as T;
}

export function decryptServiceSensitiveFields<T extends Record<string, any>>(data: T): T {
  const next: Record<string, any> = { ...data };
  for (const field of SERVICE_SENSITIVE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(next, field)) {
      next[field] = decryptValue(next[field as ServiceSensitiveField]);
    }
  }
  return next as T;
}
