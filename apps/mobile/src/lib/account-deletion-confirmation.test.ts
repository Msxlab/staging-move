import { describe, expect, it } from "vitest";
import { isDeleteConfirmationValid } from "./account-deletion-confirmation";

describe("isDeleteConfirmationValid", () => {
  it("accepts localized confirmation phrases case-insensitively", () => {
    expect(isDeleteConfirmationValid("delete", ["DELETE"])).toBe(true);
    expect(isDeleteConfirmationValid(" eliminar ", ["ELIMINAR", "DELETE"])).toBe(true);
  });

  it("rejects empty or unrelated text", () => {
    expect(isDeleteConfirmationValid("", ["DELETE"])).toBe(false);
    expect(isDeleteConfirmationValid("remove", ["DELETE"])).toBe(false);
  });
});
