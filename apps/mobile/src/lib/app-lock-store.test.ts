import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
  },
}));

vi.mock("expo-local-authentication", () => ({
  AuthenticationType: {
    FACIAL_RECOGNITION: 2,
    FINGERPRINT: 1,
  },
  hasHardwareAsync: vi.fn(() => Promise.resolve(false)),
  isEnrolledAsync: vi.fn(() => Promise.resolve(false)),
  supportedAuthenticationTypesAsync: vi.fn(() => Promise.resolve([])),
  authenticateAsync: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import { useAppLockStore } from "./app-lock-store";

describe("app lock store", () => {
  beforeEach(() => {
    storage.clear();
    useAppLockStore.setState({
      enabled: false,
      hydrated: false,
      locked: false,
      checking: false,
      authenticating: false,
      available: false,
      methodLabel: "biometric unlock",
      error: null,
    });
  });

  it("fails closed when app lock is enabled but biometric capability disappears", async () => {
    storage.set("locateflow.appLock.enabled", "true");

    await useAppLockStore.getState().hydrate();
    const afterHydrate = useAppLockStore.getState();

    expect(afterHydrate.enabled).toBe(true);
    expect(afterHydrate.available).toBe(false);
    expect(afterHydrate.locked).toBe(true);

    const result = await useAppLockStore.getState().unlock({
      promptMessage: "Unlock",
      cancelLabel: "Cancel",
      fallbackLabel: "Use passcode",
    });

    expect(result.success).toBe(false);
    expect(useAppLockStore.getState().locked).toBe(true);
  });
});
