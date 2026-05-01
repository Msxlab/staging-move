import { useEffect, useRef, useState } from "react";
import { Platform, Dimensions } from "react-native";
import { useSegments } from "expo-router";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import {
  getAnalyticsEnabled,
  setAnalyticsEnabled,
  setAnalyticsSessionId,
  subscribeAnalyticsEnabled,
  trackScreenView,
} from "@/lib/analytics";

function getDeviceInfo() {
  const brand = Device.brand || "Unknown";
  const modelName = Device.modelName || "Unknown";
  const osName = Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : Platform.OS;
  const osVersion = Platform.Version ? String(Platform.Version) : "";
  const { width, height } = Dimensions.get("window");
  const screenResolution = `${Math.round(width)}x${Math.round(height)}`;
  const deviceType = Device.deviceType === Device.DeviceType.PHONE
    ? "MOBILE"
    : Device.deviceType === Device.DeviceType.TABLET
    ? "TABLET"
    : "UNKNOWN";

  return {
    browser: "Expo Go",
    browserVersion: Constants.expoConfig?.sdkVersion || "",
    os: osName,
    osVersion,
    device: `${brand} ${modelName}`.trim(),
    deviceType,
    platform: "MOBILE",
    screenResolution,
    language: "en",
  };
}

export function SessionTracker() {
  const isSignedIn = useAuthStore((s) => Boolean(s.user));
  const segments = useSegments();
  const [analyticsAllowed, setAnalyticsAllowed] = useState(getAnalyticsEnabled());
  const sessionIdRef = useRef<string | null>(null);
  const pageViewsRef = useRef(0);
  const initializedRef = useRef(false);

  useEffect(() => subscribeAnalyticsEnabled(setAnalyticsAllowed), []);

  useEffect(() => {
    if (!isSignedIn) {
      initializedRef.current = false;
      sessionIdRef.current = null;
      setAnalyticsEnabled(false);
      return;
    }

    api.get<any>("/api/consent")
      .then((res) => {
        setAnalyticsEnabled(res.data?.consents?.ANALYTICS?.granted === true);
      })
      .catch(() => setAnalyticsEnabled(false));
  }, [isSignedIn]);

  // Create session on sign-in
  useEffect(() => {
    if (!isSignedIn || !analyticsAllowed || initializedRef.current) return;
    initializedRef.current = true;

    const info = getDeviceInfo();

    api.post<any>("/api/tracking/session", info)
      .then((res) => {
        if (res.data?.sessionId) {
          sessionIdRef.current = res.data.sessionId;
          setAnalyticsSessionId(res.data.sessionId);
        } else if (res.data?.disabled) {
          setAnalyticsEnabled(false);
        }
      })
      .catch(() => {});
  }, [analyticsAllowed, isSignedIn]);

  // Update page views on navigation + track screen view event
  useEffect(() => {
    if (!isSignedIn || !analyticsAllowed || !sessionIdRef.current) return;
    pageViewsRef.current += 1;

    api.patch<any>("/api/tracking/session", {
      sessionId: sessionIdRef.current,
      pageViews: pageViewsRef.current,
    }).catch(() => {});

    // Track granular screen view event
    const screenPath = "/" + segments.filter(Boolean).join("/");
    trackScreenView(screenPath);
  }, [segments, analyticsAllowed, isSignedIn]);

  return null;
}
