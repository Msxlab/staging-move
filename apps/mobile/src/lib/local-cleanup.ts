import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import { setAnalyticsEnabled } from "@/lib/analytics";

const SENSITIVE_ASYNC_STORAGE_KEYS = [
  "locateflow.handledOAuthCodes",
  "locateflow.pendingLegalConsents",
  "locateflow_pending_legal_consents",
  // Onboarding-completion cache lives next to the auth store and is keyed by
  // device, not user. On logout/delete we wipe it so the next account that
  // signs in on this device doesn't inherit the previous user's onboarding
  // status (which would silently bypass /onboarding for them).
  "locateflow.onboardingCompleted",
];

export async function clearSensitiveLocalState(queryClient?: QueryClient) {
  queryClient?.clear();
  setAnalyticsEnabled(false);
  await Promise.all(SENSITIVE_ASYNC_STORAGE_KEYS.map((key) => AsyncStorage.removeItem(key))).catch(() => {});
}
