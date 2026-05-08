import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
  },
}));

import { GET } from "./route";

describe("public health endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([{ ok: 1 }]);
  });

  it("returns minimal readiness output when healthy", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "healthy",
      ready: true,
    });
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof body.uptimeSec).toBe("number");
    expect(JSON.stringify(body)).not.toMatch(
      /DATABASE_URL|UPSTASH|STRIPE|GOOGLE_PLAY|NEXT_PUBLIC|memory|seo|checks|config|commit/i,
    );
  });

  it("keeps readiness status non-200 when the database check fails", async () => {
    mocks.queryRaw.mockRejectedValueOnce(new Error("db down"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "unhealthy",
      ready: false,
    });
    expect(JSON.stringify(body)).not.toContain("db down");
  });
});
