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

import * as LocalAuthentication from "expo-local-authentication";
import { useAppLockStore } from "./app-lock-store";

describe("app lock store", () => {
  beforeEach(() => {
    storage.clear();
    (LocalAuthentication.authenticateAsync as any).mockResolvedValue({ success: true });
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

  it("falls back to device authentication when biometric capability disappears", async () => {
    // hasHardware/isEnrolled are false (biometric capability gone), but the OS
    // authenticate succeeds via the device passcode fallback — the user must NOT
    // be bricked out of an already-authenticated session.
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

    expect(result.success).toBe(true);
    expect(useAppLockStore.getState().locked).toBe(false);
  });

  it("stays locked but is recoverable via disable when no auth method is available", async () => {
    // No biometrics AND no device passcode → authenticate fails.
    (LocalAuthentication.authenticateAsync as any).mockResolvedValueOnce({
      success: false,
      error: "not_available",
    });
    storage.set("locateflow.appLock.enabled", "true");

    await useAppLockStore.getState().hydrate();
    const result = await useAppLockStore.getState().unlock({
      promptMessage: "Unlock",
      cancelLabel: "Cancel",
      fallbackLabel: "Use passcode",
    });

    expect(result.success).toBe(false);
    expect(useAppLockStore.getState().locked).toBe(true);

    // Recovery escape: disabling the non-functional lock keeps the user in
    // their session instead of forcing a full sign-out.
    await useAppLockStore.getState().disable();
    expect(useAppLockStore.getState().locked).toBe(false);
    expect(useAppLockStore.getState().enabled).toBe(false);
  });
});
