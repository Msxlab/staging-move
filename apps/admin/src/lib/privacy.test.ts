import { describe, expect, it } from "vitest";
import {
  MAX_CSV_IMPORT_BYTES,
  maskEmail,
  maskProviderIdentifier,
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
