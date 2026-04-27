import { describe, expect, it } from "vitest";
import {
  apiErrorMessage,
  PROVIDER_LOGO_AUTO_FETCH_BULK_CONCURRENCY,
  readApiResponsePayload,
} from "./provider-logo-auto-fetch";

describe("provider logo auto-fetch response handling", () => {
  it("reads JSON error responses", async () => {
    const response = new Response(
      JSON.stringify({
        error: "LOGO_FETCH_FAILED",
        message: "No logo source returned a usable image",
      }),
      {
        status: 422,
        headers: { "content-type": "application/json" },
      },
    );

    const payload = await readApiResponsePayload(response);

    expect(payload.error).toBe("LOGO_FETCH_FAILED");
    expect(apiErrorMessage(payload, "fallback")).toBe(
      "No logo source returned a usable image",
    );
  });

  it("turns HTML error responses into a clean message", async () => {
    const response = new Response(
      "<html><body><h1>504 Gateway Timeout</h1></body></html>",
      {
        status: 504,
        statusText: "Gateway Timeout",
        headers: { "content-type": "text/html" },
      },
    );

    const payload = await readApiResponsePayload(response);

    expect(payload.error).toBe("NON_JSON_RESPONSE");
    expect(payload.message).toBe("504 Gateway Timeout");
  });

  it("handles empty responses without throwing", async () => {
    const response = new Response("", { status: 504 });

    await expect(readApiResponsePayload(response)).resolves.toEqual({});
  });

  it("keeps catalog auto-fetch concurrency bounded", () => {
    expect(PROVIDER_LOGO_AUTO_FETCH_BULK_CONCURRENCY).toBeLessThanOrEqual(3);
    expect(PROVIDER_LOGO_AUTO_FETCH_BULK_CONCURRENCY).toBeGreaterThanOrEqual(1);
  });
});
