import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  stateRuleFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    stateRule: {
      findUnique: (...args: unknown[]) => mocks.stateRuleFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: (...args: unknown[]) => mocks.requireDbUserId(...args),
}));

import { GOVERNMENT_INFO_SOURCE_LINKS } from "@locateflow/shared";
import { GET } from "./route";

function makeRequest(state: string | null) {
  const url = state
    ? `https://locateflow.com/api/state-rules?state=${encodeURIComponent(state)}`
    : "https://locateflow.com/api/state-rules";
  return new NextRequest(url);
}

describe("/api/state-rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDbUserId.mockResolvedValue("user_1");
  });

  it("rejects unauthenticated callers", async () => {
    mocks.requireDbUserId.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    const response = await GET(makeRequest("CA"));
    expect(response.status).toBe(401);
  });

  it("requires a state query param", async () => {
    const response = await GET(makeRequest(null));
    expect(response.status).toBe(400);
  });

  it("returns the documented contract with visible official government source links", async () => {
    mocks.stateRuleFindUnique.mockResolvedValue({
      stateCode: "CA",
      stateName: "California",
      dmvRules: "Update license within 10 days.",
      voterRegistration: "Register at sos.ca.gov.",
      taxInfo: "State income tax applies.",
      // Extra columns the route deliberately drops:
      id: "sr_1",
      utilityNotes: "ignored",
    });

    const response = await GET(makeRequest("CA"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      stateRule: {
        stateCode: "CA",
        stateName: "California",
        dmvRules: "Update license within 10 days.",
        voterRegistration: "Register at sos.ca.gov.",
        taxInfo: "State income tax applies.",
        officialSources: GOVERNMENT_INFO_SOURCE_LINKS,
      },
    });
    expect(body.stateRule.officialSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "dmv", url: "https://www.usa.gov/state-motor-vehicle-services" }),
        expect.objectContaining({ id: "voter", url: "https://vote.gov/register" }),
        expect.objectContaining({ id: "tax", url: "https://www.usa.gov/state-taxes" }),
      ]),
    );
    // Guard against accidental shape drift to a `rules` array.
    expect("rules" in body).toBe(false);
  });

  it("returns { stateRule: null } when no rule exists for the state", async () => {
    mocks.stateRuleFindUnique.mockResolvedValue(null);
    const response = await GET(makeRequest("ZZ"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ stateRule: null });
  });

  it("normalizes the state code to uppercase before querying", async () => {
    mocks.stateRuleFindUnique.mockResolvedValue(null);
    await GET(makeRequest("ca"));
    expect(mocks.stateRuleFindUnique).toHaveBeenCalledWith({
      where: { stateCode: "CA" },
    });
  });
});
