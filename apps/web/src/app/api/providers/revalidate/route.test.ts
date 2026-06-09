import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

const mocks = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: (...a: unknown[]) => mocks.revalidateTag(...a),
  revalidatePath: (...a: unknown[]) => mocks.revalidatePath(...a),
}));

import { POST } from "./route";

const SECRET = "x".repeat(40);

function sign(timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", SECRET).update(`${timestamp}.${body}`).digest("hex")}`;
}

function request(headers: Record<string, string>, body = "{}") {
  return new NextRequest("https://locateflow.com/api/providers/revalidate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("POST /api/providers/revalidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.INTERNAL_WEBHOOK_SECRET;
  });

  it("rejects an unsigned request", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(403);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects a bad signature", async () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const res = await POST(
      request({ "x-internal-webhook-timestamp": ts, "x-internal-webhook-signature": "sha256=deadbeef" }),
    );
    expect(res.status).toBe(403);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects a stale timestamp even with a valid signature", async () => {
    const ts = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 min old
    const res = await POST(
      request({ "x-internal-webhook-timestamp": ts, "x-internal-webhook-signature": sign(ts, "{}") }),
    );
    expect(res.status).toBe(403);
  });

  it("invalidates the providers tag + page for a valid signature", async () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const res = await POST(
      request({ "x-internal-webhook-timestamp": ts, "x-internal-webhook-signature": sign(ts, "{}") }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("providers", "default");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/providers");
  });
});
