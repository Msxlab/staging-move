import { beforeEach, describe, expect, it, vi } from "vitest";

const secureStoreMocks = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY",
  getItemAsync: secureStoreMocks.getItemAsync,
  setItemAsync: secureStoreMocks.setItemAsync,
  deleteItemAsync: secureStoreMocks.deleteItemAsync,
}));

import { AUTH_SECURE_STORE_OPTIONS, tokenCache } from "./auth";

describe("tokenCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    secureStoreMocks.getItemAsync.mockResolvedValue("token");
    secureStoreMocks.setItemAsync.mockResolvedValue(undefined);
    secureStoreMocks.deleteItemAsync.mockResolvedValue(undefined);
  });

  it("uses explicit SecureStore options for auth tokens", async () => {
    await expect(tokenCache.getToken("auth")).resolves.toBe("token");
    await tokenCache.saveToken("auth", "token");
    await tokenCache.clearToken("auth");

    expect(secureStoreMocks.getItemAsync).toHaveBeenCalledWith("auth", AUTH_SECURE_STORE_OPTIONS);
    expect(secureStoreMocks.setItemAsync).toHaveBeenCalledWith("auth", "token", AUTH_SECURE_STORE_OPTIONS);
    expect(secureStoreMocks.deleteItemAsync).toHaveBeenCalledWith("auth", AUTH_SECURE_STORE_OPTIONS);
    expect(AUTH_SECURE_STORE_OPTIONS.requireAuthentication).toBe(false);
  });
});
