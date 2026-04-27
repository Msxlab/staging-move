import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shared-encryption", () => ({
  encrypt: vi.fn((value: string) => `enc:${value}`),
  decrypt: vi.fn((value: string) => value.replace(/^enc:/, "")),
  isEncrypted: vi.fn((value: string) => typeof value === "string" && value.startsWith("enc:")),
}));

import {
  decryptServiceSensitiveFields,
  encryptServiceSensitiveFields,
} from "./service-sensitive-fields";

describe("service sensitive fields", () => {
  it("encrypts service private fields and leaves already encrypted values unchanged", () => {
    const encrypted = encryptServiceSensitiveFields({
      providerName: "PSE&G",
      accountNumber: "acct-1234",
      username: "enc:existing-user",
      phone: "1-800-436-7734",
      email: "customer@example.com",
      notes: "private note",
    });

    expect(encrypted).toMatchObject({
      providerName: "PSE&G",
      accountNumber: "enc:acct-1234",
      username: "enc:existing-user",
      phone: "enc:1-800-436-7734",
      email: "enc:customer@example.com",
      notes: "enc:private note",
    });
  });

  it("decrypts only service private fields", () => {
    const decrypted = decryptServiceSensitiveFields({
      providerName: "PSE&G",
      accountNumber: "enc:acct-1234",
      phone: "enc:1-800-436-7734",
      email: "enc:customer@example.com",
    });

    expect(decrypted).toMatchObject({
      providerName: "PSE&G",
      accountNumber: "acct-1234",
      phone: "1-800-436-7734",
      email: "customer@example.com",
    });
  });
});
