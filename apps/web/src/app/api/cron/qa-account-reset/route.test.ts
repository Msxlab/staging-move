import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock("@/lib/qa-account", () => ({
  getQaResettableAccountEmails: vi.fn(() => ["mobile.qa@locateflow.com"]),
  resetAllowlistedQaAccountForSignup: vi.fn(() => Promise.resolve({ reset: true })),
}));

import { guardCronRequest } from "@/lib/cron-guard";
import {
  getQaResettableAccountEmails,
  resetAllowlistedQaAccountForSignup,
} from "@/lib/qa-account";
import { GET, POST } from "./route";

const guardCronRequestMock = guardCronRequest as unknown as Mock;
const getQaResettableAccountEmailsMock = getQaResettableAccountEmails as unknown as Mock;
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
    getQaResettableAccountEmailsMock.mockReturnValue(["mobile.qa@locateflow.com"]);
    resetAllowlistedQaAccountForSignupMock.mockResolvedValue({ reset: true });
  });

  it("hard-resets all configured QA persona accounts", async () => {
    getQaResettableAccountEmailsMock.mockReturnValue([
      "mobile.qa@locateflow.com",
      "mobileindividual@locateflow.com",
    ]);
    resetAllowlistedQaAccountForSignupMock
      .mockResolvedValueOnce({ reset: true })
      .mockResolvedValueOnce({ reset: false, reason: "email_not_allowlisted" });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      reset: true,
      accounts: [
        { email: "mobile.qa@locateflow.com", reset: true },
        {
          email: "mobileindividual@locateflow.com",
          reset: false,
          reason: "email_not_allowlisted",
        },
      ],
    });
    expect(guardCronRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "qa-account-reset",
      { limit: 3, windowSeconds: 60 },
    );
    expect(resetAllowlistedQaAccountForSignupMock).toHaveBeenNthCalledWith(1, {
      email: "mobile.qa@locateflow.com",
    });
    expect(resetAllowlistedQaAccountForSignupMock).toHaveBeenNthCalledWith(2, {
      email: "mobileindividual@locateflow.com",
    });
  });

  it("does nothing when the QA reset account is not configured", async () => {
    getQaResettableAccountEmailsMock.mockReturnValueOnce([]);

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
