import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";
import { create } from "zustand";

const APP_LOCK_ENABLED_KEY = "locateflow.appLock.enabled";

export interface AppLockPromptCopy {
  promptMessage: string;
  cancelLabel: string;
  fallbackLabel: string;
}

export interface AppLockResult {
  success: boolean;
  reason?: string;
  skipped?: boolean;
}

interface AppLockCapability {
  available: boolean;
  methodLabel: string;
  reason?: "unsupported_platform" | "no_hardware" | "not_enrolled" | "unknown";
}

interface AppLockState extends AppLockCapability {
  enabled: boolean;
  hydrated: boolean;
  locked: boolean;
  checking: boolean;
  authenticating: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  refreshCapability: () => Promise<AppLockCapability>;
  enable: (copy: AppLockPromptCopy) => Promise<AppLockResult>;
  disable: () => Promise<void>;
  lock: () => void;
  unlock: (copy: AppLockPromptCopy) => Promise<AppLockResult>;
}

const DEFAULT_METHOD_LABEL = "biometric unlock";

async function resolveCapability(): Promise<AppLockCapability> {
  if (Platform.OS === "web") {
    return { available: false, methodLabel: DEFAULT_METHOD_LABEL, reason: "unsupported_platform" };
  }

  try {
    const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    if (!hasHardware) {
      return { available: false, methodLabel: DEFAULT_METHOD_LABEL, reason: "no_hardware" };
    }
    if (!isEnrolled) {
      return { available: false, methodLabel: DEFAULT_METHOD_LABEL, reason: "not_enrolled" };
    }

    const hasFace = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const hasFingerprint = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const methodLabel = Platform.OS === "ios"
      ? hasFace
        ? "Face ID"
        : "Touch ID"
      : hasFace && hasFingerprint
        ? "face or fingerprint"
        : hasFace
          ? "face unlock"
          : hasFingerprint
            ? "fingerprint"
            : DEFAULT_METHOD_LABEL;

    return { available: true, methodLabel };
  } catch {
    return { available: false, methodLabel: DEFAULT_METHOD_LABEL, reason: "unknown" };
  }
}

async function authenticate(copy: AppLockPromptCopy): Promise<AppLockResult> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: copy.promptMessage,
    cancelLabel: copy.cancelLabel,
    fallbackLabel: copy.fallbackLabel,
    disableDeviceFallback: false,
  });

  if (result.success) return { success: true };
  return { success: false, reason: result.error || "authentication_failed" };
}

export const useAppLockStore = create<AppLockState>((set, get) => ({
  enabled: false,
  hydrated: false,
  locked: false,
  checking: false,
  authenticating: false,
  available: false,
  methodLabel: DEFAULT_METHOD_LABEL,
  error: null,

  async hydrate() {
    set({ checking: true, error: null });
    const [stored, capability] = await Promise.all([
      AsyncStorage.getItem(APP_LOCK_ENABLED_KEY).catch(() => null),
      resolveCapability(),
    ]);
    const enabled = stored === "true";
    set({
      ...capability,
      enabled,
      hydrated: true,
      locked: enabled,
      checking: false,
      error: enabled && !capability.available ? capability.reason || "not_available" : null,
    });
  },

  async refreshCapability() {
    const capability = await resolveCapability();
    set(capability);
    return capability;
  },

  async enable(copy) {
    set({ checking: true, error: null });
    const capability = await resolveCapability();
    set({ ...capability, checking: false });
    if (!capability.available) {
      const reason = capability.reason || "not_available";
      set({ error: reason });
      return { success: false, reason };
    }

    set({ authenticating: true });
    const result = await authenticate(copy);
    set({ authenticating: false });
    if (!result.success) {
      set({ error: result.reason || "authentication_failed" });
      return result;
    }

    await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, "true");
    set({ enabled: true, locked: false, error: null });
    return { success: true };
  },

  async disable() {
    await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, "false");
    set({ enabled: false, locked: false, error: null });
  },

  lock() {
    const state = get();
    if (state.enabled) {
      set({ locked: true, error: null });
    }
  },

  async unlock(copy) {
    const state = get();
    if (!state.enabled || !state.locked) return { success: true, skipped: true };
    if (state.authenticating) return { success: false, reason: "already_authenticating" };

    // Flag BEFORE the first await so the whole async window (capability check +
    // the OS prompt that backgrounds the app) is covered by the gate's guard.
    set({ authenticating: true, error: null });
    const capability = await resolveCapability();
    set(capability);
    if (!capability.available) {
      const reason = capability.reason || "not_available";
      set({ authenticating: false, locked: true, error: reason });
      return { success: false, reason };
    }

    const result = await authenticate(copy);
    set({ authenticating: false });
    if (result.success) {
      set({ locked: false, error: null });
    } else {
      set({ error: result.reason || "authentication_failed" });
    }
    return result;
  },
}));
