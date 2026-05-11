import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("admin healthz route", () => {
  it("returns public liveness without sensitive data", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ ok: true, service: "admin" });
  });
});
