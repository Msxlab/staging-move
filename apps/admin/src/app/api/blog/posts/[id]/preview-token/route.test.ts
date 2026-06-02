import { beforeEach, describe, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findFirst: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findFirst: (...args: unknown[]) => mocks.findFirst(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  },
}));

import { POST } from "./route";

function request() {
  return new NextRequest("https://admin.locateflow.com/api/blog/posts/post_1/preview-token", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.20" },
  });
}

describe("blog preview token route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_JWT_SECRET = "test-admin-jwt-secret-must-be-at-least-32-chars";
    process.env.NEXT_PUBLIC_APP_URL = "https://locateflow.com/";
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "MODERATOR" });
    mocks.findFirst.mockResolvedValue({ id: "post_1", slug: "moving-day" });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("mints a scoped short-lived preview URL and audits the action", async () => {
    const response = await POST(request(), { params: Promise.resolve({ id: "post_1" }) });
    const body = (await response.json()) as { token: string; url: string; expiresInSeconds: number };

    expect(response.status).toBe(200);
    expect(body.expiresInSeconds).toBe(600);
    expect(body.url).toBe(`https://locateflow.com/blog/preview/${body.token}`);

    const verified = await jwtVerify(
      body.token,
      new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!),
      { audience: "blog-preview", issuer: "locateflow-admin" },
    );
    expect(verified.payload.postId).toBe("post_1");
    expect(verified.payload.adminId).toBe("admin_1");
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "BLOG_PREVIEW_TOKEN",
          entityType: "BlogPost",
          entityId: "post_1",
        }),
      }),
    );
  });

  it("does not mint a token when the signing secret is missing", async () => {
    delete process.env.ADMIN_JWT_SECRET;

    const response = await POST(request(), { params: Promise.resolve({ id: "post_1" }) });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Server misconfigured");
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
