import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import { setAnalyticsEnabled } from "@/lib/analytics";

const SENSITIVE_ASYNC_STORAGE_KEYS = [
  "locateflow.handledOAuthCodes",
  "locateflow.pendingLegalConsents",
  "locateflow_pending_legal_consents",
];

export async function clearSensitiveLocalState(queryClient?: QueryClient) {
  queryClient?.clear();
  setAnalyticsEnabled(false);
  await AsyncStorage.multiRemove(SENSITIVE_ASYNC_STORAGE_KEYS).catch(() => {});
}
