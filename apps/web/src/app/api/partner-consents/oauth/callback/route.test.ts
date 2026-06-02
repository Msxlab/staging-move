import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getOAuthRedirectUri: vi.fn(),
  getOAuthResponseUrl: vi.fn(),
  getUserSession: vi.fn(),
  isApiConnectorsEnabled: vi.fn(),
  isConnectorEnabled: vi.fn(),
  userHasApiConnectorEntitlement: vi.fn(),
  getConnectorOAuthConfig: vi.fn(),
  exchangeConnectorCode: vi.fn(),
  upsertGrantedConsent: vi.fn(),
}));

vi.mock("@/lib/oauth", () => ({
  getOAuthRedirectUri: (...a: unknown[]) => mocks.getOAuthRedirectUri(...a),
  getOAuthResponseUrl: (...a: unknown[]) => mocks.getOAuthResponseUrl(...a),
}));
vi.mock("@/lib/user-auth", () => ({
  getUserSession: (...a: unknown[]) => mocks.getUserSession(...a),
}));
vi.mock("@/lib/connector-oauth", () => ({
  exchangeConnectorCode: (...a: unknown[]) => mocks.exchangeConnectorCode(...a),
  getConnectorOAuthConfig: (...a: unknown[]) => mocks.getConnectorOAuthConfig(...a),
  isApiConnectorsEnabled: (...a: unknown[]) => mocks.isApiConnectorsEnabled(...a),
  isConnectorEnabled: (...a: unknown[]) => mocks.isConnectorEnabled(...a),
  isValidConnectorKey: (key: string) => /^[a-z][a-z0-9-]*$/.test(key),
  upsertGrantedConsent: (...a: unknown[]) => mocks.upsertGrantedConsent(...a),
  userHasApiConnectorEntitlement: (...a: unknown[]) => mocks.userHasApiConnectorEntitlement(...a),
}));

function callbackRequest(cookie = "pc_oauth_state=state-1; pc_oauth_pkce=verifier-1; pc_oauth_connector=usps") {
  return new NextRequest("https://locateflow.com/api/partner-consents/oauth/callback?code=code-1&state=state-1", {
    headers: { Cookie: cookie },
  });
}

describe("partner consent OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOAuthRedirectUri.mockResolvedValue("https://locateflow.com/api/partner-consents/oauth/callback");
    mocks.getOAuthResponseUrl.mockImplementation(async (_request: Request, path: string) => `https://locateflow.com${path}`);
    mocks.getUserSession.mockResolvedValue({ userId: "user_1" });
    mocks.isApiConnectorsEnabled.mockResolvedValue(true);
    mocks.userHasApiConnectorEntitlement.mockResolvedValue(true);
    mocks.isConnectorEnabled.mockResolvedValue(true);
    mocks.getConnectorOAuthConfig.mockResolvedValue({ scopes: ["addresses"] });
    mocks.exchangeConnectorCode.mockResolvedValue({ accessToken: "at", refreshToken: "rt" });
    mocks.upsertGrantedConsent.mockResolvedValue("consent_1");
  });

  it("does not persist tokens if the user loses connector entitlement before callback", async () => {
    mocks.userHasApiConnectorEntitlement.mockResolvedValue(false);
    const { GET } = await import("./route");

    const res = await GET(callbackRequest());

    expect(res.headers.get("location")).toBe("https://locateflow.com/dashboard?connector_error=plan-not-entitled");
    expect(mocks.exchangeConnectorCode).not.toHaveBeenCalled();
    expect(mocks.upsertGrantedConsent).not.toHaveBeenCalled();
  });

  it("does not persist tokens if the connector is disabled before callback", async () => {
    mocks.isConnectorEnabled.mockResolvedValue(false);
    const { GET } = await import("./route");

    const res = await GET(callbackRequest());

    expect(res.headers.get("location")).toBe("https://locateflow.com/dashboard?connector_error=connector-disabled");
    expect(mocks.exchangeConnectorCode).not.toHaveBeenCalled();
    expect(mocks.upsertGrantedConsent).not.toHaveBeenCalled();
  });

  it("persists a consent only after callback gates still pass", async () => {
    const { GET } = await import("./route");

    const res = await GET(callbackRequest());

    expect(res.headers.get("location")).toBe("https://locateflow.com/dashboard?connector_connected=usps");
    expect(mocks.exchangeConnectorCode).toHaveBeenCalled();
    expect(mocks.upsertGrantedConsent).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user_1",
      connectorKey: "usps",
    }));
  });
});
