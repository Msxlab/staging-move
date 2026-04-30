import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, API_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { theme } from "@/lib/theme";
import { createQueryClient } from "@/lib/query-client";
import * as SplashScreen from "expo-splash-screen";
import "../src/styles/global.css";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { SessionTracker } from "@/components/SessionTracker";
import { initI18n } from "@/i18n/config";
import { initMobileSentry } from "@/lib/sentry";
import {
  getPendingLegalConsents,
  hydratePendingLegalConsents,
  hasRequiredLegalConsents,
  setPendingLegalConsents,
} from "@/lib/legal";
import { registerForPushNotifications } from "@/lib/push";

SplashScreen.preventAutoHideAsync();

// Wire up the lightweight error reporter as early as possible before
// any module-level init that might throw, so the first crash a user
// sees is the LAST one we miss in GlitchTip.
initMobileSentry();

// Kick off i18n resolution before the first render. Resolves:
//   1. Stored preference (AsyncStorage) set by the LanguageSelector.
//   2. Device locale via expo-localization.
//   3. Default "en".
// initI18n returns a promise that the splash screen masks, so the
// first painted screen already renders in the right locale.
const i18nReady = initI18n().catch(() => undefined);
const HANDLED_OAUTH_CODES_STORAGE_KEY = "locateflow.handledOAuthCodes";

async function hasHandledOAuthCode(code: string) {
  try {
    const raw = await AsyncStorage.getItem(HANDLED_OAUTH_CODES_STORAGE_KEY);
    const codes = raw ? JSON.parse(raw) : [];
    return Array.isArray(codes) && codes.includes(code);
  } catch {
    return false;
  }
}

async function rememberHandledOAuthCode(code: string) {
  try {
    const raw = await AsyncStorage.getItem(HANDLED_OAUTH_CODES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const codes = Array.isArray(parsed) ? parsed : [];
    const next = [code, ...codes.filter((item: unknown) => typeof item === "string" && item !== code)].slice(0, 20);
    await AsyncStorage.setItem(HANDLED_OAUTH_CODES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* best effort */
  }
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { token, user, loading, hydrate, refreshUser, setSession } = useAuthStore();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const handledOAuthCodes = useRef<Set<string>>(new Set());

  // 1) On mount, load the persisted token from SecureStore.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const readCode = (url: string | null) => {
      if (!url || !url.startsWith("locateflow://oauth")) return null;
      const queryStart = url.indexOf("?");
      if (queryStart < 0) return null;
      const params = new URLSearchParams(url.slice(queryStart + 1).split("#")[0]);
      return params.get("code");
    };

    const handleOAuthUrl = async (url: string | null) => {
      const code = readCode(url);
      if (!code || handledOAuthCodes.current.has(code)) return;
      if (await hasHandledOAuthCode(code)) return;
      handledOAuthCodes.current.add(code);

      const res = await api.post<{ token?: string; user?: any }>("/api/mobile/auth/exchange", { code });
      if (res.error || !res.data?.token || !res.data.user) {
        handledOAuthCodes.current.delete(code);
        Alert.alert("Sign-in failed", res.error || "Could not complete mobile sign-in.");
        return;
      }
      await rememberHandledOAuthCode(code);

      await setSession(res.data.token, res.data.user);
      await hydratePendingLegalConsents();
      const pendingLegalConsents = getPendingLegalConsents();
      if (hasRequiredLegalConsents(pendingLegalConsents)) {
        await api.post("/api/legal/acceptance", { legalConsents: pendingLegalConsents }).catch(() => null);
        await setPendingLegalConsents(null);
      }
      registerForPushNotifications().catch(() => {});
      router.replace("/onboarding");
    };

    Linking.getInitialURL().then((url) => void handleOAuthUrl(url)).catch(() => {});
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleOAuthUrl(url);
    });
    return () => subscription.remove();
  }, [router, setSession]);

  // 2) When a token appears, fetch /api/auth/me to hydrate the user.
  useEffect(() => {
    if (token && !user) {
      void refreshUser(API_URL.replace(/\/api\/?$/, ""));
    }
  }, [token, user, refreshUser]);

  // 3) Check onboarding completion after login.
  useEffect(() => {
    if (loading) return;
    if (!token) {
      setNeedsOnboarding(null);
      return;
    }
    let cancelled = false;
    api.get<any>("/api/profile").then((res) => {
      if (cancelled) return;
      setNeedsOnboarding(res.data?.onboardingCompleted !== true);
    }).catch(() => {
      if (!cancelled) setNeedsOnboarding(true);
    });
    return () => { cancelled = true; };
  }, [token, loading]);

  // 4) Route based on auth state.
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";

    if (!token && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
      return;
    }
    if (!token || needsOnboarding === null) return;

    if (token && inAuthGroup) {
      router.replace(needsOnboarding ? "/onboarding" : "/(tabs)");
    } else if (token && !needsOnboarding && inOnboarding) {
      router.replace("/(tabs)");
    } else if (token && needsOnboarding && !inOnboarding && !inAuthGroup) {
      router.replace("/onboarding");
    }
  }, [token, loading, segments, needsOnboarding, router]);

  return (
    <>
      <SessionTracker />
      {children}
    </>
  );
}

function RootNavigator() {
  return (
    <>
      <StatusBar style="light" backgroundColor={theme.colors.background} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen name="onboarding" options={{ animation: "slide_from_bottom" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [i18nHydrated, setI18nHydrated] = useState(false);
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    SplashScreen.hideAsync();
    void i18nReady.then(() => setI18nHydrated(true));
  }, []);

  // Hold the splash until i18n is ready AND the animated splash finishes.
  // Both guards must pass; otherwise the first frame flashes EN copy
  // before the user's ES preference applies.
  if (showSplash || !i18nHydrated) {
    return <AnimatedSplash ready={i18nHydrated} onFinish={() => setShowSplash(false)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <RootNavigator />
      </AuthGuard>
    </QueryClientProvider>
  );
}
