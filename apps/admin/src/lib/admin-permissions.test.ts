import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE_VALUES,
  buildDefaultPermissionMatrix,
  isValidAdminRole,
} from "@/lib/admin-permissions";

describe("isValidAdminRole", () => {
  it("accepts every documented role", () => {
    for (const role of ADMIN_ROLE_VALUES) {
      expect(isValidAdminRole(role)).toBe(true);
    }
  });

  it("rejects unknown strings", () => {
    expect(isValidAdminRole("super_admin")).toBe(false);
    expect(isValidAdminRole("ROOT")).toBe(false);
    expect(isValidAdminRole("")).toBe(false);
    expect(isValidAdminRole("admin")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidAdminRole(undefined)).toBe(false);
    expect(isValidAdminRole(null)).toBe(false);
    expect(isValidAdminRole(123)).toBe(false);
    expect(isValidAdminRole({})).toBe(false);
  });
});

describe("buildDefaultPermissionMatrix", () => {
  it("grants every action to SUPER_ADMIN", () => {
    const matrix = buildDefaultPermissionMatrix("SUPER_ADMIN");
    for (const row of matrix) {
      expect(row.canRead).toBe(true);
      expect(row.canCreate).toBe(true);
      expect(row.canUpdate).toBe(true);
      expect(row.canDelete).toBe(true);
    }
  });

  it("denies admin_users management for ADMIN", () => {
    const matrix = buildDefaultPermissionMatrix("ADMIN");
    const adminUsers = matrix.find((row) => row.resource === "admin_users");
    expect(adminUsers?.canCreate).toBe(false);
    expect(adminUsers?.canDelete).toBe(false);
  });

  it("returns read-only for VIEWER", () => {
    const matrix = buildDefaultPermissionMatrix("VIEWER");
    for (const row of matrix) {
      expect(row.canRead).toBe(true);
      expect(row.canCreate).toBe(false);
      expect(row.canUpdate).toBe(false);
      expect(row.canDelete).toBe(false);
    }
  });

  it("returns read-only for an unknown role (safe default)", () => {
    const matrix = buildDefaultPermissionMatrix("UNKNOWN_FOO");
    for (const row of matrix) {
      expect(row.canRead).toBe(true);
      expect(row.canCreate).toBe(false);
    }
  });
});
