import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// vi.mock is hoisted, so the factory cannot reference module-scope
// variables. Instead we expose function getters via vi.hoisted and
// resolve them inside each factory call.
const hoisted = vi.hoisted(() => {
  const initial = {
    redirectImpl: (path: string): never => {
      throw new Error(`__REDIRECT__:${path}`);
    },
    requireAdminImpl: (async (): Promise<any> => {
      throw new Error("UNAUTHORIZED");
    }) as () => Promise<any>,
    findUniqueImpl: (async (_args: unknown): Promise<any> => null) as (args: unknown) => Promise<any>,
  };
  return initial;
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => hoisted.redirectImpl(path),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: () => hoisted.requireAdminImpl(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: (args: unknown) => hoisted.findUniqueImpl(args),
    },
  },
}));

import {
  requirePageAdmin,
  requirePagePermission,
  requirePageRole,
} from "@/lib/page-guard";

const SUPER_ADMIN_SESSION = { adminId: "admin_super", email: "s@x.com", role: "SUPER_ADMIN" };
const VIEWER_SESSION = { adminId: "admin_viewer", email: "v@x.com", role: "VIEWER" };

function setRequireAdminResult(impl: () => Promise<any>) {
  hoisted.requireAdminImpl = impl;
}
function setFindUniqueResult(impl: (args: unknown) => Promise<any>) {
  hoisted.findUniqueImpl = impl;
}

beforeEach(() => {
  hoisted.redirectImpl = (path: string) => {
    throw new Error(`__REDIRECT__:${path}`);
  };
  hoisted.requireAdminImpl = async () => {
    throw new Error("UNAUTHORIZED");
  };
  hoisted.findUniqueImpl = async () => null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requirePageRole", () => {
  it("allows SUPER_ADMIN through a SUPER_ADMIN gate", async () => {
    setRequireAdminResult(async () => SUPER_ADMIN_SESSION);
    setFindUniqueResult(async () => ({ id: "admin_super", isActive: true, role: "SUPER_ADMIN", permissions: [] }));
    const ctx = await requirePageRole("SUPER_ADMIN");
    expect(ctx.role).toBe("SUPER_ADMIN");
    expect(ctx.permissions.users.canRead).toBe(true);
  });

  it("redirects VIEWER away from a SUPER_ADMIN gate", async () => {
    setRequireAdminResult(async () => VIEWER_SESSION);
    setFindUniqueResult(async () => ({ id: "admin_viewer", isActive: true, role: "VIEWER", permissions: [] }));
    await expect(requirePageRole("SUPER_ADMIN")).rejects.toThrow(/__REDIRECT__:\/forbidden/);
  });

  it("redirects to /login when there is no session", async () => {
    setRequireAdminResult(async () => {
      throw new Error("UNAUTHORIZED");
    });
    await expect(requirePageRole("ADMIN")).rejects.toThrow(/__REDIRECT__:\/login/);
  });

  it("redirects to /login when admin row is missing", async () => {
    setRequireAdminResult(async () => SUPER_ADMIN_SESSION);
    setFindUniqueResult(async () => null);
    await expect(requirePageRole("ADMIN")).rejects.toThrow(/__REDIRECT__:\/login/);
  });

  it("redirects to /login when admin is inactive", async () => {
    setRequireAdminResult(async () => SUPER_ADMIN_SESSION);
    setFindUniqueResult(async () => ({ id: "admin_super", isActive: false, role: "SUPER_ADMIN", permissions: [] }));
    await expect(requirePageRole("ADMIN")).rejects.toThrow(/__REDIRECT__:\/login/);
  });
});

describe("requirePagePermission", () => {
  it("allows SUPER_ADMIN regardless of persisted permissions", async () => {
    setRequireAdminResult(async () => SUPER_ADMIN_SESSION);
    setFindUniqueResult(async () => ({ id: "admin_super", isActive: true, role: "SUPER_ADMIN", permissions: [] }));
    const ctx = await requirePagePermission("settings", "canUpdate");
    expect(ctx.role).toBe("SUPER_ADMIN");
  });

  it("redirects when an explicit permission row is missing for a non-SUPER_ADMIN", async () => {
    setRequireAdminResult(async () => ({ ...VIEWER_SESSION, role: "ADMIN" }));
    setFindUniqueResult(async () => ({
      id: "admin_admin",
      isActive: true,
      role: "ADMIN",
      permissions: [
        { resource: "users", canRead: true, canCreate: false, canUpdate: false, canDelete: false },
      ],
    }));
    await expect(
      requirePagePermission("settings", "canUpdate"),
    ).rejects.toThrow(/__REDIRECT__:\/forbidden/);
  });

  it("allows the action when the persisted permission row grants it", async () => {
    setRequireAdminResult(async () => ({ ...VIEWER_SESSION, role: "ADMIN" }));
    setFindUniqueResult(async () => ({
      id: "admin_admin",
      isActive: true,
      role: "ADMIN",
      permissions: [
        { resource: "settings", canRead: true, canCreate: false, canUpdate: true, canDelete: false },
      ],
    }));
    const ctx = await requirePagePermission("settings", "canUpdate");
    expect(ctx.permissions.settings.canUpdate).toBe(true);
  });
});

describe("requirePageAdmin", () => {
  it("returns the resolved context for any active admin", async () => {
    setRequireAdminResult(async () => VIEWER_SESSION);
    setFindUniqueResult(async () => ({ id: "admin_viewer", isActive: true, role: "VIEWER", permissions: [] }));
    const ctx = await requirePageAdmin();
    expect(ctx.role).toBe("VIEWER");
  });
});
