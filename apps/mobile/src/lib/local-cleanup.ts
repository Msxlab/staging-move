import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import { setAnalyticsEnabled } from "@/lib/analytics";
import { useAppLockStore } from "@/lib/app-lock-store";
import { clearAllOfflineCaches } from "@/lib/offline-cache";
import { SELECTED_WORKSPACE_ID_KEY } from "@/lib/workspace-selection";

const SENSITIVE_ASYNC_STORAGE_KEYS = [
  "locateflow.handledOAuthCodes",
  "locateflow.pendingLegalConsents",
  "locateflow_pending_legal_consents",
  // Onboarding-completion cache lives next to the auth store and is keyed by
  // device, not user. On logout/delete we wipe it so the next account that
  // signs in on this device doesn't inherit the previous user's onboarding
  // status (which would silently bypass /onboarding for them).
  "locateflow.onboardingCompleted",
  // Offline cold-start dashboard snapshot — echoes the last signed-in user's
  // move route, task titles, saved addresses and providers. Device-keyed, so
  // wipe it on logout/delete or the next account would briefly see the prior
  // user's last-known dashboard on a no-signal cold start.
  "locateflow.dashboard.snapshot.v1",
  // Home-screen widget snapshot (move countdown / next task). Same rationale.
  "locateflow.widget.snapshot.v1",
  // Last-known plan hint (premium flag + tier) used to seed the dashboard hero
  // on cold start so it doesn't flash the FREE upsell before the entitlement
  // resolves. Device-keyed, so wipe it or the next account could briefly seed
  // off the previous user's plan.
  "locateflow.lastPlan.v1",
  SELECTED_WORKSPACE_ID_KEY,
];

export async function clearSensitiveLocalState(queryClient?: QueryClient) {
  queryClient?.clear();
  setAnalyticsEnabled(false);
  // Reset the biometric app-lock so the next account on this device doesn't
  // inherit (and get gated behind) the previous user's lock — the flag is
  // device-keyed, not user-keyed.
  await useAppLockStore.getState().disable().catch(() => {});
  await Promise.all(SENSITIVE_ASYNC_STORAGE_KEYS.map((key) => AsyncStorage.removeItem(key))).catch(() => {});
  // Offline list caches (Services/Moving "last-known data") are device-keyed
  // and echo the prior user's data — wipe them all by prefix on logout/delete.
  await clearAllOfflineCaches();
}
