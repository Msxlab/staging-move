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
});
