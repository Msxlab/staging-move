import { describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { version: "1.2.3" },
  },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import {
  buildMobileAuthHeaders,
  CLIENT_IDENTITY_HEADERS,
  CLIENT_PLATFORM,
  CLIENT_USER_AGENT,
  CLIENT_VERSION,
} from "./client-identity";

describe("mobile client identity headers", () => {
  it("keeps authenticated native request identity stable", () => {
    expect(CLIENT_PLATFORM).toBe("ios");
    expect(CLIENT_VERSION).toBe("1.2.3");
    expect(CLIENT_USER_AGENT).toBe("LocateFlow/1.2.3 (iOS; Expo)");
    expect(CLIENT_IDENTITY_HEADERS).toMatchObject({
      "x-client-type": "mobile",
      "x-client-platform": "ios",
      "x-client-version": "1.2.3",
      "User-Agent": "LocateFlow/1.2.3 (iOS; Expo)",
    });
    expect(buildMobileAuthHeaders("token-1")).toMatchObject({
      ...CLIENT_IDENTITY_HEADERS,
      Authorization: "Bearer token-1",
    });
  });
});
