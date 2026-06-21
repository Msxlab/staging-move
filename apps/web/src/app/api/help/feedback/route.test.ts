import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    helpArticle: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "help-feedback:ip"),
  rateLimit: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

const updateMock = prisma.helpArticle.update as unknown as Mock;
const rateLimitMock = rateLimit as unknown as Mock;

function request(body: unknown) {
  return new NextRequest("https://locateflow.com/api/help/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 19, resetAt: Date.now() + 60_000 });
  updateMock.mockResolvedValue({ helpfulYes: 4, helpfulNo: 1 });
});

describe("POST /api/help/feedback", () => {
  it("rate limits public help votes before mutating counters", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() + 30_000 });

    const response = await POST(request({ articleId: "article_1", vote: "yes" }));

    expect(response.status).toBe(429);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("increments the selected counter after passing the limiter", async () => {
    const response = await POST(request({ articleId: "article_1", vote: "no" }));

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "article_1" },
      data: { helpfulNo: { increment: 1 } },
      select: { helpfulYes: true, helpfulNo: true },
    });
  });
});
