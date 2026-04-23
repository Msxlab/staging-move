import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useFonts } from "expo-font";
import {
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_300Light_Italic,
  Fraunces_400Regular_Italic,
} from "@expo-google-fonts/fraunces";
import {
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
} from "@expo-google-fonts/geist-mono";
import { api, API_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { theme } from "@/lib/theme";
import { createQueryClient, PERSISTER_OPTIONS } from "@/lib/query-client";
import * as SplashScreen from "expo-splash-screen";
import "../src/styles/global.css";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { SessionTracker } from "@/components/SessionTracker";
import { initI18n } from "@/i18n/config";

SplashScreen.preventAutoHideAsync();

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

  // Edition VI · Champagne & Rose — Fraunces (display, italic + light) + Geist
  // (UI sans) + Geist Mono (meta, numerals). Names here are the fontFamily
  // strings used in stylesheets and NativeWind's tailwind.config.ts.
  const [fontsLoaded] = useFonts({
    Fraunces: Fraunces_400Regular,
    "Fraunces-Light": Fraunces_300Light,
    "Fraunces-Medium": Fraunces_500Medium,
    "Fraunces-Italic": Fraunces_400Regular_Italic,
    "Fraunces-LightItalic": Fraunces_300Light_Italic,
    Geist: Geist_400Regular,
    "Geist-Light": Geist_300Light,
    "Geist-Medium": Geist_500Medium,
    "Geist-SemiBold": Geist_600SemiBold,
    "Geist-Bold": Geist_700Bold,
    GeistMono: GeistMono_400Regular,
    "GeistMono-Medium": GeistMono_500Medium,
  });

  useEffect(() => {
    SplashScreen.hideAsync();
    void i18nReady.then(() => setI18nHydrated(true));
  }, []);

  // Hold the splash until i18n is ready, fonts are loaded, AND the animated
  // splash finishes. All three guards must pass; otherwise the first frame
  // flashes system-font copy before Fraunces joins, or the wrong locale.
  if (showSplash || !i18nHydrated || !fontsLoaded) {
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
