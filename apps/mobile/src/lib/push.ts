/**
 * Push notification registration.
 *
 * Called after a successful sign-in/sign-up. Requests permission, fetches the
 * Expo push token, and sends it to the backend so the server can target this
 * device for notifications.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "./api";

let registrationInFlight: Promise<boolean> | null = null;

const SOFT_PROMPT_DECISION_KEY = "locateflow.pushSoftPromptDecision";

export type PushSoftPromptDecision = "accepted" | "deferred" | "declined";

/**
 * Persist the user's response to the in-app pre-prompt. Apple's HIG asks
 * us to explain the value of notifications BEFORE we trigger the OS prompt
 * (the OS prompt can only be presented once per install). The deferred /
 * declined value is read by the settings screen to render the right CTA.
 */
export async function setPushSoftPromptDecision(value: PushSoftPromptDecision): Promise<void> {
  try {
    await AsyncStorage.setItem(SOFT_PROMPT_DECISION_KEY, value);
  } catch {
    /* best effort */
  }
}

export async function getPushSoftPromptDecision(): Promise<PushSoftPromptDecision | null> {
  try {
    const raw = await AsyncStorage.getItem(SOFT_PROMPT_DECISION_KEY);
    if (raw === "accepted" || raw === "deferred" || raw === "declined") return raw;
    return null;
  } catch {
    return null;
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.DEFAULT,
  }),
});

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === "granted";
}

async function getProjectId(): Promise<string | undefined> {
  const fromConfig =
    (Constants.expoConfig as any)?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;
  return typeof fromConfig === "string" ? fromConfig : undefined;
}

async function ensureAndroidNotificationChannels() {
  if (Platform.OS !== "android") return;

  await Promise.all([
    Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    }),
    Notifications.setNotificationChannelAsync("billing", {
      name: "Billing",
      importance: Notifications.AndroidImportance.DEFAULT,
    }),
    Notifications.setNotificationChannelAsync("move-alerts", {
      name: "Move alerts",
      importance: Notifications.AndroidImportance.HIGH,
    }),
    Notifications.setNotificationChannelAsync("marketing", {
      name: "Updates and offers",
      importance: Notifications.AndroidImportance.LOW,
    }),
  ]);
}

/**
 * Register the device for push notifications.
 *
 * Behavior:
 *   - If `requireSoftPrompt: true` (default), the function only proceeds when
 *     the user has previously accepted the in-app pre-prompt. This satisfies
 *     Apple's HIG recommendation that an explanation precede the one-shot
 *     OS prompt.
 *   - If the OS already granted permission previously, registration proceeds
 *     and (best-effort) updates the persisted decision to "accepted".
 */
export async function registerForPushNotifications(opts?: {
  requireSoftPrompt?: boolean;
}): Promise<boolean> {
  const requireSoftPrompt = opts?.requireSoftPrompt ?? true;
  if (registrationInFlight) return registrationInFlight;

  registrationInFlight = (async () => {
    try {
      if (!Device.isDevice) return false;

      const existing = await Notifications.getPermissionsAsync();
      if (existing.status !== "granted") {
        if (requireSoftPrompt) {
          const decision = await getPushSoftPromptDecision();
          if (decision !== "accepted") return false;
        }
        const granted = await ensurePermission();
        if (!granted) return false;
      }
      await setPushSoftPromptDecision("accepted");

      await ensureAndroidNotificationChannels();

      const projectId = await getProjectId();
      const tokenRes = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      const token = tokenRes.data;
      if (!token) return false;

      const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";
      const deviceName = Device.deviceName ?? Device.modelName ?? undefined;

      const res = await api.post("/api/push/register", { token, platform, deviceName });
      return !res.error;
    } catch {
      return false;
    } finally {
      registrationInFlight = null;
    }
  })();

  return registrationInFlight;
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const projectId = await getProjectId();
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenRes.data;
    if (!token) return;
    await api.delete("/api/push/register", { token });
  } catch {
    /* best-effort */
  }
}
