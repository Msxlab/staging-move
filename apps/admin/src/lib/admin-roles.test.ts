import { describe, expect, it } from "vitest";
import { adminRoleRequiresMfa } from "./admin-roles";

describe("adminRoleRequiresMfa", () => {
  it("requires MFA for every admin-panel role", () => {
    expect(adminRoleRequiresMfa("SUPER_ADMIN")).toBe(true);
    expect(adminRoleRequiresMfa("ADMIN")).toBe(true);
    expect(adminRoleRequiresMfa("MODERATOR")).toBe(true);
    expect(adminRoleRequiresMfa("VIEWER")).toBe(true);
  });

  it("does not apply admin MFA enrollment to non-admin roles", () => {
    expect(adminRoleRequiresMfa("CUSTOMER")).toBe(false);
    expect(adminRoleRequiresMfa(null)).toBe(false);
  });
});
