import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api-client";

describe("ApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves 401 response details while still running the unauthorized hook", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
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
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
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

    const call = fetchMock.mock.calls[0];
    if (!call?.[1]) {
      throw new Error("Expected ApiClient to call fetch with request init");
    }
    const init = call[1];
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-workspace-id": "ws_123",
      Authorization: "Bearer real-token",
    });
    expect((init.headers as Record<string, string>)["x-empty"]).toBeUndefined();
  });

  it("notifies callers about structured response errors", async () => {
    const onResponseError = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({
        error: "Your selected workspace is no longer available.",
        code: "STALE_WORKSPACE_SELECTION",
      }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    ));

    const client = new ApiClient({
      baseUrl: "https://locateflow.com/api",
      getToken: async () => "token",
      onResponseError,
    });

    await expect(client.get("/services")).resolves.toEqual({
      error: "Your selected workspace is no longer available.",
      code: "STALE_WORKSPACE_SELECTION",
    });
    expect(onResponseError).toHaveBeenCalledWith({
      status: 409,
      code: "STALE_WORKSPACE_SELECTION",
      message: "Your selected workspace is no longer available.",
    });
  });
});
