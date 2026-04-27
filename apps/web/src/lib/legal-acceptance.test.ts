import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userEventFindFirst: vi.fn(),
  userEventCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    userEvent: {
      findFirst: (...args: unknown[]) => mocks.userEventFindFirst(...args),
      create: (...args: unknown[]) => mocks.userEventCreate(...args),
    },
  },
}));

import { LEGAL_CONSENT_EVENT } from "@/lib/legal";
import { recordLegalAcceptance } from "./legal-acceptance";

function request() {
  return new NextRequest("https://locateflow.com/onboarding?step=legal", {
    headers: {
      "user-agent": "vitest",
      "x-forwarded-for": "203.0.113.10",
    },
  });
}

describe("recordLegalAcceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userEventFindFirst.mockResolvedValue(null);
    mocks.userEventCreate.mockResolvedValue({});
  });

  it("records legal acceptance when no current acknowledgement exists", async () => {
    await recordLegalAcceptance({
      userId: "user_1",
      request: request(),
      page: "/onboarding",
      source: "oauth_legal_gate",
      consents: {
        termsAccepted: true,
        disclaimerAccepted: true,
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-26T12:00:00.000Z",
      },
    });

    expect(mocks.userEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        event: LEGAL_CONSENT_EVENT,
        page: "/onboarding",
      }),
    });
  });

  it("does not duplicate current-version legal acceptance rows", async () => {
    mocks.userEventFindFirst.mockResolvedValue({
      metadata: JSON.stringify({
        termsAccepted: true,
        disclaimerAccepted: true,
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-25T12:00:00.000Z",
      }),
    });

    await recordLegalAcceptance({
      userId: "user_1",
      request: request(),
      page: "/onboarding",
      source: "oauth_legal_gate",
      consents: {
        termsAccepted: true,
        disclaimerAccepted: true,
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-26T12:00:00.000Z",
      },
    });

    expect(mocks.userEventCreate).not.toHaveBeenCalled();
  });
});
