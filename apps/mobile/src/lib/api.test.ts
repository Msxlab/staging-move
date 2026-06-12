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

// api.ts (and auth-store.ts, which it imports) pull `Platform` from
// react-native; the real module ships Flow syntax that the vitest rollup
// transform can't parse. Mock it like the other mobile lib tests do.
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
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
    process.env.EXPO_PUBLIC_ENV = "production";
  });

  it("uses mobile bearer auth settings and clears the session on 401", async () => {
    const mod = await import("./api");

    expect(mod.API_URL).toBe("https://locateflow.com/api");
    expect(captured.config.clientType).toBe("mobile");
    expect(captured.config.clientPlatform).toBe("ios");
    expect(captured.config.clientVersion).toBe("0.0.0");
    expect(captured.config.userAgent).toBe("LocateFlow/0.0.0 (iOS; Expo)");
    expect(captured.config.timeoutMs).toBe(20_000);

    await captured.config.onUnauthorized();
    expect(captured.clearSession).toHaveBeenCalled();
  });

  it("keeps non-dev production-like builds on HTTPS", async () => {
    process.env.EXPO_PUBLIC_API_URL = "http://example.test/api";
    process.env.EXPO_PUBLIC_ENV = "production";

    const mod = await import("./api");

    expect(mod.API_URL).toBe("https://locateflow.com/api");
  });

  it("allows the local Android emulator proxy only for development builds", async () => {
    process.env.EXPO_PUBLIC_API_URL = "http://10.0.2.2:4300/api";
    process.env.EXPO_PUBLIC_ENV = "development";

    const mod = await import("./api");

    expect(mod.API_URL).toBe("http://10.0.2.2:4300/api");
  });
});
