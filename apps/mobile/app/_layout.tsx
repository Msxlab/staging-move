import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { api, API_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { theme } from "@/lib/theme";
import { createQueryClient } from "@/lib/query-client";
import * as SplashScreen from "expo-splash-screen";
import "../src/styles/global.css";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionTracker } from "@/components/SessionTracker";
import { initI18n } from "@/i18n/config";
import { initMobileSentry } from "@/lib/sentry";
import {
  getPendingLegalConsents,
  hydratePendingLegalConsents,
  hasRequiredLegalConsents,
  setPendingLegalConsents,
} from "@/lib/legal";
import {
  exchangeMobileOAuthCallbackUrl,
  readMobileOAuthCallback,
} from "@/lib/mobile-oauth-handoff";

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
    const handleOAuthUrl = async (url: string | null) => {
      const callback = readMobileOAuthCallback(url);
      const code = callback?.code;
      if (!code || handledOAuthCodes.current.has(code)) return;
      handledOAuthCodes.current.add(code);

      let exchanged: { token?: string; user?: any } | null = null;
      try {
        exchanged = await exchangeMobileOAuthCallbackUrl(url);
      } catch (err: any) {
        handledOAuthCodes.current.delete(code);
        Alert.alert("Sign-in failed", err?.message || "Could not complete mobile sign-in.");
        return;
      }
      if (!exchanged?.token || !exchanged.user) return;

      await setSession(exchanged.token, exchanged.user);
      await hydratePendingLegalConsents();
      const pendingLegalConsents = getPendingLegalConsents();
      if (hasRequiredLegalConsents(pendingLegalConsents)) {
        await api.post("/api/legal/acceptance", { legalConsents: pendingLegalConsents }).catch(() => null);
        await setPendingLegalConsents(null);
      }
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
      if (res.error) {
        const message = res.error.toLowerCase();
        setNeedsOnboarding(message.includes("legal") || message.includes("onboarding") ? true : false);
        return;
      }
      setNeedsOnboarding(res.data?.onboardingCompleted !== true);
    }).catch(() => {
      if (!cancelled) setNeedsOnboarding(false);
    });
    return () => { cancelled = true; };
  }, [token, loading]);

  // 4) Route based on auth state.
  useEffect(() => {
    if (loading) return;

    const currentSegment = String(segments[0] || "");
    const inAuthGroup = currentSegment === "(auth)";
    const inOnboarding = currentSegment === "onboarding";
    const inOAuthCallback = currentSegment === "oauth";
    const inPasswordReset = currentSegment === "reset-password";
    const inPublicBlog = currentSegment === "blog";

    if (!token && !inAuthGroup && !inOAuthCallback && !inPasswordReset && !inPublicBlog) {
      router.replace("/(auth)/sign-in");
      return;
    }
    if (!token || needsOnboarding === null) return;

    if (token && inAuthGroup) {
      router.replace(needsOnboarding ? "/onboarding" : "/(tabs)");
    } else if (token && inOAuthCallback) {
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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthGuard>
          <RootNavigator />
        </AuthGuard>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
