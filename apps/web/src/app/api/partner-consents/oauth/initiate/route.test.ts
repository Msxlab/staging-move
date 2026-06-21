import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  buildAuthorizeUrl: vi.fn(),
  generatePkce: vi.fn(),
  generateState: vi.fn(),
  getOAuthRedirectUri: vi.fn(),
  getUserSession: vi.fn(),
  isApiConnectorsEnabled: vi.fn(),
  isConnectorEnabled: vi.fn(),
  userHasApiConnectorEntitlement: vi.fn(),
  getConnectorOAuthConfig: vi.fn(),
  resolveWorkspaceDataScope: vi.fn(),
  assertWorkspaceAction: vi.fn(),
}));

vi.mock("@locateflow/connectors", () => ({
  buildAuthorizeUrl: (...a: unknown[]) => mocks.buildAuthorizeUrl(...a),
}));

vi.mock("@/lib/oauth", () => ({
  generatePkce: (...a: unknown[]) => mocks.generatePkce(...a),
  generateState: (...a: unknown[]) => mocks.generateState(...a),
  getOAuthRedirectUri: (...a: unknown[]) => mocks.getOAuthRedirectUri(...a),
}));

vi.mock("@/lib/user-auth", () => ({
  getUserSession: (...a: unknown[]) => mocks.getUserSession(...a),
  shouldUseSecureSessionCookies: vi.fn(() => true),
}));

vi.mock("@/lib/connector-oauth", () => ({
  getConnectorOAuthConfig: (...a: unknown[]) => mocks.getConnectorOAuthConfig(...a),
  isApiConnectorsEnabled: (...a: unknown[]) => mocks.isApiConnectorsEnabled(...a),
  isConnectorEnabled: (...a: unknown[]) => mocks.isConnectorEnabled(...a),
  isValidConnectorKey: (key: string) => /^[a-z][a-z0-9-]*$/.test(key),
  userHasApiConnectorEntitlement: (...a: unknown[]) => mocks.userHasApiConnectorEntitlement(...a),
}));

vi.mock("@/lib/workspace-data-scope", () => ({
  resolveWorkspaceDataScope: (...a: unknown[]) => mocks.resolveWorkspaceDataScope(...a),
  assertWorkspaceAction: (...a: unknown[]) => mocks.assertWorkspaceAction(...a),
}));

function initiateRequest() {
  return new NextRequest("https://locateflow.com/api/partner-consents/oauth/initiate?connector=usps");
}

describe("partner consent OAuth initiate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOAuthRedirectUri.mockResolvedValue("https://locateflow.com/api/partner-consents/oauth/callback");
    mocks.getUserSession.mockResolvedValue({ userId: "user_1" });
    mocks.isApiConnectorsEnabled.mockResolvedValue(true);
    mocks.userHasApiConnectorEntitlement.mockResolvedValue(true);
    mocks.isConnectorEnabled.mockResolvedValue(true);
    mocks.getConnectorOAuthConfig.mockResolvedValue({ scopes: ["addresses"] });
    mocks.generateState.mockReturnValue("state-1");
    mocks.generatePkce.mockReturnValue({ verifier: "verifier-1", challenge: "challenge-1" });
    mocks.buildAuthorizeUrl.mockReturnValue("https://partner.example/oauth?state=state-1");
    mocks.resolveWorkspaceDataScope.mockResolvedValue({
      actorUserId: "user_1",
      ownerUserId: "user_1",
      workspaceId: null,
      workspaceMode: false,
      memberRole: null,
      memberStatus: null,
    });
    mocks.assertWorkspaceAction.mockReturnValue(undefined);
  });

  it("uses workspace owner entitlement for member-initiated OAuth", async () => {
    mocks.resolveWorkspaceDataScope.mockResolvedValue({
      actorUserId: "user_1",
      ownerUserId: "owner_1",
      workspaceId: "ws_1",
      workspaceMode: true,
      memberRole: "MEMBER",
      memberStatus: "ACTIVE",
    });
    const { GET } = await import("./route");

    const response = await GET(initiateRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://partner.example/oauth?state=state-1");
    expect(mocks.userHasApiConnectorEntitlement).toHaveBeenCalledWith("owner_1");
    expect(mocks.assertWorkspaceAction).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws_1", ownerUserId: "owner_1" }),
      "addressChange.initiate",
      { resourceUserId: "user_1" },
    );
  });

  it("rejects the flow when the selected workspace owner is not entitled", async () => {
    mocks.resolveWorkspaceDataScope.mockResolvedValue({
      actorUserId: "user_1",
      ownerUserId: "owner_1",
      workspaceId: "ws_1",
      workspaceMode: true,
      memberRole: "MEMBER",
      memberStatus: "ACTIVE",
    });
    mocks.userHasApiConnectorEntitlement.mockResolvedValue(false);
    const { GET } = await import("./route");

    const response = await GET(initiateRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Your plan doesn't include partner API sync.",
    });
    expect(mocks.buildAuthorizeUrl).not.toHaveBeenCalled();
  });
});
