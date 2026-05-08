import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  config: null as any,
  clearSession: vi.fn(),
}));

vi.mock("@locateflow/shared", () => ({
  ApiClient: class MockApiClient {
    config: any;
    constructor(config: any) {
      captured.config = config;
      this.config = config;
    }
  },
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { extra: {} },
    linkingUri: null,
  },
}));

vi.mock("@/lib/auth-store", () => ({
  getToken: vi.fn(() => Promise.resolve("token")),
  useAuthStore: {
    getState: () => ({
      clearSession: captured.clearSession,
    }),
  },
}));

describe("mobile api client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    captured.config = null;
    captured.clearSession.mockResolvedValue(undefined);
    vi.stubGlobal("__DEV__", false);
    process.env.EXPO_PUBLIC_API_URL = "https://locateflow.com/api";
  });

  it("uses mobile bearer auth settings and clears the session on 401", async () => {
    const mod = await import("./api");

    expect(mod.API_URL).toBe("https://locateflow.com/api");
    expect(captured.config.clientType).toBe("mobile");
    expect(captured.config.timeoutMs).toBe(20_000);

    await captured.config.onUnauthorized();
    expect(captured.clearSession).toHaveBeenCalled();
  });
});
