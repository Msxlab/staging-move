import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock("@/lib/qa-account", () => ({
  getQaResettableAccountEmail: vi.fn(() => "mobile.qa@locateflow.com"),
  resetAllowlistedQaAccountForSignup: vi.fn(() => Promise.resolve({ reset: true })),
}));

import { guardCronRequest } from "@/lib/cron-guard";
import {
  getQaResettableAccountEmail,
  resetAllowlistedQaAccountForSignup,
} from "@/lib/qa-account";
import { GET, POST } from "./route";

const guardCronRequestMock = guardCronRequest as unknown as Mock;
const getQaResettableAccountEmailMock = getQaResettableAccountEmail as unknown as Mock;
const resetAllowlistedQaAccountForSignupMock = resetAllowlistedQaAccountForSignup as unknown as Mock;

function makeRequest(method = "GET") {
  return new NextRequest("https://locateflow.com/api/cron/qa-account-reset", {
    method,
    headers: { authorization: "Bearer cron-secret" },
  });
}

describe("qa-account-reset cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardCronRequestMock.mockResolvedValue({ ok: true });
    getQaResettableAccountEmailMock.mockReturnValue("mobile.qa@locateflow.com");
    resetAllowlistedQaAccountForSignupMock.mockResolvedValue({ reset: true });
  });

  it("hard-resets only the configured QA account", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      email: "mobile.qa@locateflow.com",
      reset: true,
    });
    expect(guardCronRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "qa-account-reset",
      { limit: 3, windowSeconds: 60 },
    );
    expect(resetAllowlistedQaAccountForSignupMock).toHaveBeenCalledWith({
      email: "mobile.qa@locateflow.com",
    });
  });

  it("does nothing when the QA reset account is not configured", async () => {
    getQaResettableAccountEmailMock.mockReturnValueOnce(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      reset: false,
      reason: "config_disabled",
    });
    expect(resetAllowlistedQaAccountForSignupMock).not.toHaveBeenCalled();
  });

  it("returns the cron guard denial response", async () => {
    guardCronRequestMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(makeRequest("POST"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(resetAllowlistedQaAccountForSignupMock).not.toHaveBeenCalled();
  });
});
