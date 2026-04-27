import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { api, API_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { theme } from "@/lib/theme";
import { createQueryClient, PERSISTER_OPTIONS } from "@/lib/query-client";
import * as SplashScreen from "expo-splash-screen";
import "../src/styles/global.css";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { SessionTracker } from "@/components/SessionTracker";
import { initI18n } from "@/i18n/config";
import { initMobileSentry } from "@/lib/sentry";

SplashScreen.preventAutoHideAsync();

// Wire up the lightweight error reporter as early as possible — before
// any module-level init that might throw — so the first crash a user
// sees is the LAST one we miss in GlitchTip.
initMobileSentry();

// Kick off i18n resolution before the first render. Resolves:
//   1. Stored preference (AsyncStorage) — set by the LanguageSelector.
//   2. Device locale via expo-localization.
//   3. Default "en".
// initI18n returns a promise that the splash screen masks, so the
// first painted screen already renders in the right locale.
const i18nReady = initI18n().catch(() => undefined);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { token, user, loading, hydrate, refreshUser } = useAuthStore();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  // 1) On mount, load the persisted token from SecureStore.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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
    return <AnimatedSplash onFinish={() => setShowSplash(false)} />;
  }

  return (
    // PersistQueryClientProvider rehydrates cached queries from
    // AsyncStorage on boot (so users see their last dashboard even on
    // airplane mode) and writes the cache back as mutations change it.
    // The cache is versioned via PERSISTER_OPTIONS.buster — bump it on
    // breaking API changes to force a clean refetch.
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={PERSISTER_OPTIONS}
    >
      <AuthGuard>
        <RootNavigator />
      </AuthGuard>
    </PersistQueryClientProvider>
  );
}
