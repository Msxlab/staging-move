import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: (...a: unknown[]) => mocks.guardCronRequest(...a),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    emailLog: {
      findMany: (...a: unknown[]) => mocks.findMany(...a),
      updateMany: (...a: unknown[]) => mocks.updateMany(...a),
    },
  },
}));

import { GET } from "./route";

function makeRequest() {
  return new NextRequest("http://localhost/api/cron/email-reconcile", {
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("email-reconcile cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardCronRequest.mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.clearAllMocks());

  it("returns the guard response when auth fails", async () => {
    const denied = { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    mocks.guardCronRequest.mockResolvedValue(denied);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("flips stuck PENDING rows to FAILED", async () => {
    mocks.findMany.mockResolvedValue([{ id: "log_1" }, { id: "log_2" }]);
    mocks.updateMany.mockResolvedValue({ count: 2 });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reconciled: 2 });

    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("PENDING");
    expect(where.createdAt.lt).toBeInstanceOf(Date);

    const updateArgs = mocks.updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: { in: ["log_1", "log_2"] }, status: "PENDING" });
    expect(updateArgs.data.status).toBe("FAILED");
  });

  it("no-ops when nothing is stuck", async () => {
    mocks.findMany.mockResolvedValue([]);
    const res = await GET(makeRequest());
    expect(await res.json()).toEqual({ ok: true, reconciled: 0 });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
