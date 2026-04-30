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

import { api } from "./api";

let registrationInFlight: Promise<boolean> | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
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

export async function registerForPushNotifications(): Promise<boolean> {
  if (registrationInFlight) return registrationInFlight;

  registrationInFlight = (async () => {
    try {
      if (!Device.isDevice) return false;

      const granted = await ensurePermission();
      if (!granted) return false;

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
    await api.delete(`/api/push/register?token=${encodeURIComponent(token)}`);
  } catch {
    /* best-effort */
  }
}
