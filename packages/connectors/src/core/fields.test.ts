import { describe, it, expect } from "vitest";
import { validateFieldValues, sensitiveFieldKeys, type FieldSpec } from "./fields";

const specs: FieldSpec[] = [
  { key: "accountNumber", label: "UPS account number", type: "text", required: true, sensitive: true, maxLength: 10 },
  { key: "email", label: "Account email", type: "email", required: true },
  { key: "units", label: "Units", type: "number", required: false },
  { key: "plan", label: "Plan", type: "select", required: false, options: [{ value: "A", label: "A" }, { value: "B", label: "B" }] },
  { key: "zip", label: "ZIP", type: "text", required: false, pattern: "^\\d{5}$" },
];

describe("validateFieldValues", () => {
  it("passes when all values are valid", () => {
    const r = validateFieldValues(specs, { accountNumber: "ABC123", email: "a@b.com", units: "3", plan: "A", zip: "78701" });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual({});
  });

  it("flags every missing required field at once", () => {
    const r = validateFieldValues(specs, {});
    expect(r.ok).toBe(false);
    expect(r.errors.accountNumber).toMatch(/required/);
    expect(r.errors.email).toMatch(/required/);
    // optional fields not reported when empty
    expect(r.errors.units).toBeUndefined();
    expect(r.errors.plan).toBeUndefined();
  });

  it("validates email / number / select / pattern / maxLength", () => {
    const r = validateFieldValues(specs, {
      accountNumber: "WAYTOOLONGVALUE",
      email: "not-an-email",
      units: "abc",
      plan: "Z",
      zip: "123",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.accountNumber).toMatch(/at most 10/);
    expect(r.errors.email).toMatch(/valid email/);
    expect(r.errors.units).toMatch(/number/);
    expect(r.errors.plan).toMatch(/allowed options/);
    expect(r.errors.zip).toMatch(/expected format/);
  });

  it("ignores a malformed regex pattern instead of throwing", () => {
    const bad: FieldSpec[] = [{ key: "x", label: "X", type: "text", required: false, pattern: "([" }];
    const r = validateFieldValues(bad, { x: "anything" });
    expect(r.ok).toBe(true);
  });

  it("identifies sensitive field keys for encryption + redaction", () => {
    expect(sensitiveFieldKeys(specs)).toEqual(["accountNumber"]);
  });
});
