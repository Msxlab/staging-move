import React, { useEffect, useState } from "react";
import { Alert, Linking, View } from "react-native";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { api, API_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { ThemeProvider, useThemePreference } from "@/lib/theme";
import { createQueryClient } from "@/lib/query-client";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts as useFraunces,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from "@expo-google-fonts/fraunces";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { GeistMono_400Regular, GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import "../src/styles/global.css";
import { AnimatedSplash } from "@/components/AnimatedSplash";
import { AppLockGate } from "@/components/AppLockGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionTracker } from "@/components/SessionTracker";
import { initI18n } from "@/i18n/config";
import { initMobileSentry, captureException } from "@/lib/sentry";
import { getPostAuthMobileRoute } from "@/lib/post-auth-route";
import {
  getPendingLegalConsents,
  hydratePendingLegalConsents,
  hasRequiredLegalConsents,
  setPendingLegalConsents,
} from "@/lib/legal";
import { exchangeMobileOAuthCallbackUrl } from "@/lib/mobile-oauth-handoff";

// Cache the last known onboarding-completion flag so a transient /api/profile
// failure does not silently route a brand-new account into (tabs). Cache hits
// keep returning users unblocked; cache miss defaults to "needs onboarding"
// which is the safe direction to fail on.
const ONBOARDING_CACHE_KEY = "locateflow.onboardingCompleted";
async function readOnboardingCache(): Promise<boolean | null> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_CACHE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  } catch {
    return null;
  }
}
async function writeOnboardingCache(completed: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_CACHE_KEY, completed ? "true" : "false");
  } catch {
    /* best effort */
  }
}

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
  const { t } = useTranslation();
  const { token, user, loading, hydrate, refreshUser, setSession } = useAuthStore();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  // 1) On mount, load the persisted token from SecureStore.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const handleOAuthUrl = async (url: string | null) => {
      // exchangeMobileOAuthCallbackUrl is idempotent and coalesces concurrent
      // callers (see apps/mobile/src/lib/mobile-oauth-handoff.ts). When the
      // WebBrowser path in (auth)/sign-in.tsx already won the race, this
      // call resolves to the same {token, user} from its in-process cache
      // (or null if the code was consumed in a prior process). Either way we
      // do not duplicate the request to the server.
      let exchanged: { token?: string; user?: any } | null = null;
      try {
        exchanged = await exchangeMobileOAuthCallbackUrl(url);
      } catch {
        Alert.alert(t("auth.mobileSignInFailedTitle"), t("auth.mobileSignInFailedBody"));
        return;
      }
      // null = the URL was not an OAuth callback OR the code was already
      // consumed in a prior app instance. Either way: nothing to do here.
      if (!exchanged?.token || !exchanged.user) return;

      await setSession(exchanged.token, exchanged.user);
      await hydratePendingLegalConsents();
      const pendingLegalConsents = getPendingLegalConsents();
      if (hasRequiredLegalConsents(pendingLegalConsents)) {
        // Only clear the pending blob when the server actually acknowledges
        // the acceptance — a transient 5xx/timeout must NOT silently drop the
        // record, otherwise the consent chain is broken and onboarding has to
        // re-prompt without a paper trail.
        const legalRes = await api.post("/api/legal/acceptance", { legalConsents: pendingLegalConsents });
        if (!legalRes.error) {
          await setPendingLegalConsents(null);
        }
      }
      router.replace(getPostAuthMobileRoute(exchanged.user));
    };

    Linking.getInitialURL().then((url) => void handleOAuthUrl(url)).catch(() => {});
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleOAuthUrl(url);
    });
    return () => subscription.remove();
  }, [router, setSession, t]);

  // 2) When a token appears, fetch /api/auth/me to hydrate the user.
  useEffect(() => {
    if (token && !user) {
      void refreshUser(API_URL.replace(/\/api\/?$/, ""));
    }
  }, [token, user, refreshUser]);

  // 3) Check onboarding completion after login.
  //
  // Failure-mode policy: a transient /api/profile failure (5xx, timeout,
  // network) must NOT silently bypass onboarding for a brand-new account.
  // Resolution order:
  //   1. Server returns a real answer  → trust it, write to cache.
  //   2. Server returns a legal/onboarding error → needsOnboarding = true.
  //   3. Server is unreachable → fall back to cached completion if any
  //      (returning users stay unblocked); otherwise default to true so a
  //      brand-new account is held on /onboarding instead of bouncing into
  //      (tabs) without a profile row or legal consent.
  useEffect(() => {
    if (loading) return;
    if (!token) {
      setNeedsOnboarding(null);
      return;
    }
    let cancelled = false;
    api.get<any>("/api/profile").then(async (res) => {
      if (cancelled) return;
      if (res.error) {
        const message = res.error.toLowerCase();
        if (message.includes("legal") || message.includes("onboarding")) {
          setNeedsOnboarding(true);
          return;
        }
        // Generic failure (timeout / 5xx / network). Use cached value if we
        // have one, else default to "needs onboarding" — safer for a brand-
        // new account than the previous default of false.
        const cached = await readOnboardingCache();
        if (cancelled) return;
        setNeedsOnboarding(cached === true ? false : true);
        return;
      }
      const completed = res.data?.onboardingCompleted === true;
      setNeedsOnboarding(!completed);
      void writeOnboardingCache(completed);
    }).catch(async () => {
      if (cancelled) return;
      const cached = await readOnboardingCache();
      if (cancelled) return;
      setNeedsOnboarding(cached === true ? false : true);
    });
    return () => { cancelled = true; };
  }, [token, loading]);

  // 4) Route based on auth state.
  useEffect(() => {
    if (loading) return;

    const currentSegment = String(segments[0] || "");
    const inAuthGroup = currentSegment === "(auth)";
    const inOnboarding = currentSegment === "onboarding";
    const inPasswordSetup = currentSegment === "setup-password";
    const inOAuthCallback = currentSegment === "oauth";
    const inPasswordReset = currentSegment === "reset-password";
    const inPublicBlog = currentSegment === "blog";

    if (!token && !inAuthGroup && !inOAuthCallback && !inPasswordReset && !inPublicBlog) {
      router.replace("/(auth)/sign-in");
      return;
    }
    if (!token || !user || needsOnboarding === null) return;

    // Single source of truth: backend's getPostAuthUserState mirrors this
    // computation (`oauthAccounts.length > 0 && !passwordHash`) and the API
    // surfaces it as `needsPasswordSetup`. We intentionally do NOT derive
    // this from `hasPasswordLogin === false` — that would force legacy
    // magic-link-only users (no OAuth, no password) into setup too, which
    // is a different remediation path.
    const needsPasswordSetup = user.needsPasswordSetup === true;
    if (needsPasswordSetup) {
      if (!inPasswordSetup) {
        router.replace("/setup-password");
      }
      return;
    }
    if (inPasswordSetup) {
      router.replace(needsOnboarding ? "/onboarding" : "/(tabs)");
      return;
    }

    if (token && inAuthGroup) {
      router.replace(needsOnboarding ? "/onboarding" : "/(tabs)");
    } else if (token && inOAuthCallback) {
      router.replace(needsOnboarding ? "/onboarding" : "/(tabs)");
    } else if (token && !needsOnboarding && inOnboarding) {
      router.replace("/(tabs)");
    } else if (token && needsOnboarding && !inOnboarding && !inAuthGroup) {
      // The onboarding screen can finish and route into the app before this
      // guard's cached needsOnboarding flag has refreshed. Re-check once so a
      // successful completion does not bounce the user back to step 1.
      let cancelled = false;
      void api.get<any>("/api/profile").then((res) => {
        if (cancelled) return;
        if (res.data?.onboardingCompleted === true) {
          setNeedsOnboarding(false);
          void writeOnboardingCache(true);
          return;
        }
        router.replace("/onboarding");
      }).catch(() => {
        if (!cancelled) router.replace("/onboarding");
      });
      return () => { cancelled = true; };
    }
  }, [token, user, loading, segments, needsOnboarding, router]);

  return (
    <>
      <AppLockGate>
        <SessionTracker />
        {children}
      </AppLockGate>
    </>
  );
}

function RootNavigator() {
  // Drive StatusBar + content surface from the resolved (preference-aware)
  // theme so toggling Appearance in Settings flips the chrome immediately.
  // The `key` on the Stack forces the navigator subtree to remount when
  // the resolved scheme changes — that's what lets screens with static
  // StyleSheet styles refresh in place rather than waiting for the next
  // app launch.
  const { resolvedScheme, colors } = useThemePreference();

  // Keep the OS root view (visible behind navigators during transitions
  // and when the keyboard collapses) in sync with the active palette.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => null);
  }, [colors.background]);

  return (
    <>
      <StatusBar
        style={resolvedScheme === "light" ? "dark" : "light"}
        backgroundColor={colors.background}
      />
      <Stack
        key={resolvedScheme}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen name="onboarding" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="setup-password" options={{ animation: "slide_from_right" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [i18nHydrated, setI18nHydrated] = useState(false);
  const [queryClient] = useState(() => createQueryClient());

  // Edition VII · Aurora. Fraunces is the display face (Locate*flow*
  // wordmark, hero copy); Geist is the UI face. Both are loaded on first
  // boot and the splash is held until they resolve so the auth screen never
  // flashes a system fallback for the brand wordmark.
  const [fontsLoaded] = useFraunces({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });

  useEffect(() => {
    SplashScreen.hideAsync()
      .catch(() => undefined)
      .finally(() => setNativeSplashHidden(true));
    void i18nReady.then(() => setI18nHydrated(true));
  }, []);

  // Hold the splash until i18n + fonts are ready AND the animated splash
  // finishes. All three guards must pass; otherwise the first frame flashes
  // either EN copy (i18n) or system fallback (fonts) on the brand wordmark.
  const ready = i18nHydrated && fontsLoaded;
  if (!nativeSplashHidden) {
    return <View style={{ flex: 1, backgroundColor: "#0A0F18" }} />;
  }
  if (showSplash || !ready) {
    return <AnimatedSplash ready={ready} onFinish={() => setShowSplash(false)} />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGuard>
            <RootNavigator />
          </AuthGuard>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
