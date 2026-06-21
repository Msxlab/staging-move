import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api-client";

describe("ApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves 401 response details while still running the unauthorized hook", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Invalid Apple identity token." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient({
      baseUrl: "https://locateflow.com/api",
      getToken: async () => null,
      onUnauthorized,
    });

    const response = await client.post("/mobile/auth/apple/native", {
      identityToken: "token",
    });

    expect(response).toEqual({
      error: "Invalid Apple identity token.",
      code: "UNAUTHORIZED",
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("adds dynamic headers while keeping bearer auth authoritative", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient({
      baseUrl: "https://locateflow.com/api",
      getToken: async () => "real-token",
      getAdditionalHeaders: async () => ({
        "x-workspace-id": "ws_123",
        "x-empty": "",
        Authorization: "Bearer stale-token",
      }),
    });

    await client.get("/profile");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-workspace-id": "ws_123",
      Authorization: "Bearer real-token",
    });
    expect((init.headers as Record<string, string>)["x-empty"]).toBeUndefined();
  });
});
