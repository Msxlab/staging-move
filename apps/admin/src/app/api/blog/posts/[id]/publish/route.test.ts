import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  auditCreate: vi.fn(),
  revalidatePublicBlog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findFirst: (...args: unknown[]) => mocks.findFirst(...args),
    },
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
  },
}));

vi.mock("@/lib/blog-revalidate", () => ({
  revalidatePublicBlog: (...args: unknown[]) => mocks.revalidatePublicBlog(...args),
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/blog/posts/post_1/publish", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.20" },
    body: JSON.stringify(body),
  });
}

function existingPost(status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED") {
  return {
    id: "post_1",
    slug: "moving-day",
    locale: "en",
    status,
    title: "Moving day checklist",
    contentText: "This post has enough sanitized text content to pass the publish gate.",
  };
}

describe("blog publish lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "MODERATOR" });
    mocks.findFirst.mockResolvedValue(existingPost("DRAFT"));
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        blogPost: { update: (...args: unknown[]) => mocks.update(...args) },
        adminAuditLog: { create: (...args: unknown[]) => mocks.auditCreate(...args) },
      }),
    );
    mocks.update.mockResolvedValue({ id: "post_1" });
    mocks.auditCreate.mockResolvedValue({});
    mocks.revalidatePublicBlog.mockResolvedValue({ ok: true });
  });

  it("blocks schedule from an already published post so live content is not silently pulled", async () => {
    mocks.findFirst.mockResolvedValue(existingPost("PUBLISHED"));

    const response = await POST(
      request({ action: "schedule", scheduledAt: new Date(Date.now() + 120_000).toISOString() }),
      { params: Promise.resolve({ id: "post_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/DRAFT or ARCHIVED/);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.revalidatePublicBlog).not.toHaveBeenCalled();
  });

  it("blocks direct re-publish of an already published post", async () => {
    mocks.findFirst.mockResolvedValue(existingPost("PUBLISHED"));

    const response = await POST(request({ action: "publish" }), {
      params: Promise.resolve({ id: "post_1" }),
    });

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows an archived post to be published again and refreshes the public cache", async () => {
    mocks.findFirst.mockResolvedValue(existingPost("ARCHIVED"));

    const response = await POST(request({ action: "publish" }), {
      params: Promise.resolve({ id: "post_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("PUBLISHED");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "post_1" },
      data: expect.objectContaining({ status: "PUBLISHED", scheduledAt: null }),
    });
    expect(mocks.revalidatePublicBlog).toHaveBeenCalledWith({ slug: "moving-day", locale: "en" });
  });

  it("allows a published post to be unpublished", async () => {
    mocks.findFirst.mockResolvedValue(existingPost("PUBLISHED"));

    const response = await POST(request({ action: "unpublish" }), {
      params: Promise.resolve({ id: "post_1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ARCHIVED");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "post_1" },
      data: { status: "ARCHIVED", publishedAt: null, scheduledAt: null },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "BLOG_UNPUBLISH",
          entityType: "BlogPost",
          entityId: "post_1",
        }),
      }),
    );
  });
});
