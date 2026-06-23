import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  findMany: vi.fn(),
  emitSecurityEvent: vi.fn(),
}));

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: (...a: unknown[]) => mocks.guardCronRequest(...a),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    integrationDailyStat: {
      findMany: (...a: unknown[]) => mocks.findMany(...a),
    },
  },
}));
vi.mock("@/lib/security-events", () => ({
  emitSecurityEvent: (...a: unknown[]) => mocks.emitSecurityEvent(...a),
}));

import { GET } from "./route";

function makeRequest() {
  return new NextRequest("http://localhost/api/cron/integration-health", {
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("integration-health cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardCronRequest.mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.clearAllMocks());

  it("returns the guard response when auth fails", async () => {
    mocks.guardCronRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("emits a security event for a source over the error-ratio threshold", async () => {
    mocks.findMany.mockResolvedValue([
      { source: "fcc", statusCounts: { ok: 5, error: 25 } }, // 25/30 = 0.83 over
      { source: "water", statusCounts: { ok: 100, timeout: 1 } }, // healthy
    ]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.emitSecurityEvent).toHaveBeenCalledTimes(1);
    expect(mocks.emitSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "LIMITER_DEGRADED",
        severity: "error",
        key: "fcc",
        context: expect.objectContaining({ source: "fcc", failures: 25, total: 30 }),
      }),
    );
  });

  it("does not alert when below the minimum sample size", async () => {
    mocks.findMany.mockResolvedValue([{ source: "radon", statusCounts: { error: 3 } }]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.emitSecurityEvent).not.toHaveBeenCalled();
  });

  it("degrades to no alert when the stat read fails", async () => {
    mocks.findMany.mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.emitSecurityEvent).not.toHaveBeenCalled();
  });
});
