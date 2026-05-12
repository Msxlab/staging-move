import { describe, expect, it } from "vitest";
import { adminRoleRequiresMfa } from "./admin-roles";

describe("adminRoleRequiresMfa", () => {
  it("requires MFA enrolment for write-privileged admin roles", () => {
    expect(adminRoleRequiresMfa("SUPER_ADMIN")).toBe(true);
    expect(adminRoleRequiresMfa("ADMIN")).toBe(true);
  });

  it("does not block read-mostly roles at the MFA setup gate", () => {
    // MODERATOR and VIEWER can still opt into MFA voluntarily — server-side
    // step-up keeps gating every destructive action regardless of role.
    expect(adminRoleRequiresMfa("MODERATOR")).toBe(false);
    expect(adminRoleRequiresMfa("VIEWER")).toBe(false);
  });

  it("does not apply admin MFA enrollment to non-admin roles", () => {
    expect(adminRoleRequiresMfa("CUSTOMER")).toBe(false);
    expect(adminRoleRequiresMfa(null)).toBe(false);
  });
});
