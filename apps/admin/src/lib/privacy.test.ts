import { describe, expect, it } from "vitest";
import {
  canSeeRawBillingIds,
  MAX_CSV_IMPORT_BYTES,
  maskEmail,
  maskProviderIdentifier,
  redactBillingIds,
  validateCsvFileMetadata,
} from "./privacy";

describe("admin privacy helpers", () => {
  it("masks email addresses for list views", () => {
    expect(maskEmail("alice@example.com")).toBe("al***@example.com");
    expect(maskEmail("a@example.com")).toBe("a***@example.com");
  });

  it("masks provider identifiers by default", () => {
    expect(maskProviderIdentifier("cus_123456AB12")).toBe("cus_****AB12");
    expect(maskProviderIdentifier("sub_987654XY99")).toBe("sub_****XY99");
  });

  it("gates raw billing identifiers to ADMIN and SUPER_ADMIN", () => {
    expect(canSeeRawBillingIds("SUPER_ADMIN")).toBe(true);
    expect(canSeeRawBillingIds("ADMIN")).toBe(true);
    expect(canSeeRawBillingIds("MODERATOR")).toBe(false);
    expect(canSeeRawBillingIds("VIEWER")).toBe(false);
    expect(canSeeRawBillingIds(null)).toBe(false);
  });

  it("masks every billing identifier for low-priv roles and passes them raw for privileged", () => {
    const sub = {
      stripeCustomerId: "cus_123456AB12",
      stripeSubscriptionId: "sub_987654XY99",
      stripePriceId: "price_abcdef1234",
      billingProductId: "prod_zyxwvu9876",
      originalTransactionId: "1000000111222333",
      latestTransactionId: null,
    };

    const masked = redactBillingIds(sub, false);
    expect(masked.stripeCustomerId).toBe("cus_****AB12");
    expect(masked.stripeSubscriptionId).toBe("sub_****XY99");
    expect(masked.latestTransactionId).toBeNull();
    // Every field in the canonical list is present in the output.
    expect(Object.keys(masked).sort()).toEqual([
      "billingProductId",
      "latestTransactionId",
      "originalTransactionId",
      "stripeCustomerId",
      "stripePriceId",
      "stripeSubscriptionId",
    ]);

    const raw = redactBillingIds(sub, true);
    expect(raw.stripeCustomerId).toBe("cus_123456AB12");
    expect(raw.latestTransactionId).toBeNull();
  });

  it("validates CSV import file metadata", () => {
    expect(validateCsvFileMetadata({ name: "providers.csv", size: 1024, type: "text/csv" })).toEqual({ ok: true });
    expect(validateCsvFileMetadata({ name: "providers.exe", size: 1024, type: "application/x-msdownload" })).toEqual({
      ok: false,
      status: 415,
      error: "CSV import requires a .csv file.",
    });
    expect(validateCsvFileMetadata({ name: "providers.csv", size: MAX_CSV_IMPORT_BYTES + 1, type: "text/csv" })).toEqual({
      ok: false,
      status: 413,
      error: "CSV import file must be 5 MB or smaller.",
    });
  });
});
