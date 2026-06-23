import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform, StatusBar as NativeStatusBar, View } from "react-native";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter, useSegments } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as SystemUI from "expo-system-ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { api, API_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { ThemeProvider, useThemePreference } from "@/lib/theme";
import { createQueryClient } from "@/lib/query-client";
import { clearSensitiveLocalState } from "@/lib/local-cleanup";
import { hydrateOfflineCache } from "@/lib/offline-cache";
import { setSessionCleanupHook } from "@/lib/session-cleanup-hook";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
  PlayfairDisplay_800ExtraBold,
  PlayfairDisplay_900Black,
} from "@expo-google-fonts/playfair-display";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";
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
import { consumePendingInviteJoin, extractInviteToken, setPendingInviteToken } from "@/lib/workspace-invite";
import { reconcilePendingPurchases } from "@/lib/iap";

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

// Map a delivered push notification's `data` payload onto an in-app route.
// The server attaches these keys when sending pushes (see
// apps/web/src/lib/notifications.ts -> sendPush, where `data` = the
// notification `metadata`). We route most-specific-first:
//   movingPlanId -> the moving-plan detail screen
//   taskId       -> the move tab (task lives inside its plan's timeline)
//   serviceId    -> the service detail screen (bill/contract reminders)
//   supportTicketId -> the support ticket thread
//   subscriptionId  -> the subscription settings screen
// Anything else falls back to the in-app notifications list so a tap is
// never a dead end. Returns null when there's nothing actionable.
function resolveNotificationRoute(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data || typeof data !== "object") return null;
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;

  const movingPlanId = str(data.movingPlanId);
  if (movingPlanId) return `/moving/${movingPlanId}`;

  const taskId = str(data.taskId);
  if (taskId) return "/(tabs)/moving";

  const serviceId = str(data.serviceId);
  if (serviceId) return `/services/${serviceId}`;

  const supportTicketId = str(data.supportTicketId);
  if (supportTicketId) return `/help/tickets/${supportTicketId}`;

  if (str(data.subscriptionId)) return "/settings/subscription";

  // Generic / informational notification — land on the notifications list.
  return "/notifications";
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTranslation();
  const { token, user, loading, hydrate, refreshUser, setSession } = useAuthStore();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  // Guards the once-per-launch IAP pending-purchase reconciler (effect 6).
  const reconciledPurchasesRef = useRef(false);

  // 1) On mount, load the persisted token from SecureStore.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const handleOAuthUrl = async (url: string | null) => {
      // Invite deep links: a NEVER-REGISTERED invitee taps /invitations/<token>
      // with no session, so the AuthGuard is about to bounce them to sign-in and
      // the native invite landing never renders. Stash the token NOW so that, as
      // soon as they finish signing up / signing in, the auth screens auto-join
      // them to the inviting workspace. (An already-signed-in user instead lands
      // on the invite screen directly and Joins there — this stash is harmless:
      // that screen also captures the token, and it's consumed on the next auth.)
      const inviteToken = extractInviteToken(url);
      if (inviteToken) {
        await setPendingInviteToken(inviteToken).catch(() => {});
      }

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
      // OAuth handoff (incl. invited users who signed up via Google/Apple from
      // the invite link): now that a session exists, consume any stashed invite
      // token to auto-join. Idempotent + best-effort; the onboarding mount also
      // retries this for the new-user path.
      await consumePendingInviteJoin().catch(() => null);
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

  // 2b) Warm the private offline tab caches after auth so tab navigation can
  // synchronously seed from memory instead of flashing a full skeleton while
  // AsyncStorage resolves. Logout/delete still clears these by prefix.
  useEffect(() => {
    if (!token) return;
    void Promise.all([
      hydrateOfflineCache("services"),
      hydrateOfflineCache("moving"),
    ]);
  }, [token]);

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
    // Do not force OAuth-only users through setup-password on mobile.
    // Sign in with Apple must complete without requiring account creation
    // credentials outside the Apple-authenticated session. Users can still
    // add a password later from Settings > Privacy & Security.

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

  // 5) Route on notification taps.
  //
  // Two entry points:
  //   a) Cold start — the app was launched by tapping a notification while
  //      killed. getLastNotificationResponseAsync replays that tap once the
  //      tree mounts.
  //   b) Warm — addNotificationResponseReceivedListener fires while the app
  //      is foregrounded or backgrounded.
  //
  // Both are gated on an authenticated, onboarded session: routing a logged-
  // out user into /moving/[id] would just bounce them through the AuthGuard.
  // We also wait for needsOnboarding to resolve so we don't deep-link into the
  // app while the user still belongs on /onboarding. The handled-response is
  // tracked so the cold-start replay isn't re-processed when the warm listener
  // later reports the same tap.
  useEffect(() => {
    // Require a fully-resolved, onboarded session. needsOnboarding is tri-state
    // (null = still loading); only `false` means "in the app and safe to deep-
    // link". The warm listener is re-attached once this becomes true.
    if (!token || !user || needsOnboarding !== false) return;

    let cancelled = false;
    const handledIds = new Set<string>();

    const routeFromResponse = (
      response: Notifications.NotificationResponse | null,
    ) => {
      if (cancelled || !response) return;
      const id = response.notification.request.identifier;
      if (id) {
        if (handledIds.has(id)) return;
        handledIds.add(id);
      }
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | null
        | undefined;
      const route = resolveNotificationRoute(data);
      if (route) router.push(route as Parameters<typeof router.push>[0]);
    };

    // Cold-start: replay the tap that launched the app, if any.
    Notifications.getLastNotificationResponseAsync()
      .then(routeFromResponse)
      .catch(() => {});

    // Warm: taps while the app is already running.
    const subscription =
      Notifications.addNotificationResponseReceivedListener(routeFromResponse);

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [token, user, needsOnboarding, router]);

  // 6) Recover charged-but-unverified IAP purchases on app start.
  //
  // If a purchase's verify failed mid-flow last session (transient network /
  // 120s timeout), the StoreKit/Play transaction is still pending and the user
  // was charged without an entitlement. Once an authenticated session exists,
  // run the reconciler ONCE per launch: it finishes/verifies any pending
  // transactions in the background so the user doesn't have to discover the
  // manual "Restore purchases" button. Fully best-effort and non-blocking —
  // never throws, never disturbs routing.
  useEffect(() => {
    if (!token || !user || reconciledPurchasesRef.current) return;
    reconciledPurchasesRef.current = true;
    void reconcilePendingPurchases().catch(() => {
      // Swallow: recovery is opportunistic; manual Restore remains the backstop.
    });
  }, [token, user]);

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
  const reduceMotion = useReducedMotion();

  // Keep the OS root view (visible behind navigators during transitions
  // and when the keyboard collapses) in sync with the active palette.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => null);
    if (Platform.OS === "android") {
      NativeStatusBar.setBackgroundColor(colors.background, true);
    }
  }, [colors.background]);

  // Screen-to-screen transitions: a consistent, light push (~220ms) so
  // navigation reads as a fluid page-turn rather than an abrupt cut. The two
  // "container swap" boundaries (auth↔app, the onboarding modal) get a softer
  // fade so the whole surface doesn't shove sideways. Under reduce-motion we
  // drop to instant ("none") everywhere — the OS-level preference must win, and
  // transitions are purely cosmetic, never gating navigation/readiness.
  const pushAnimation = reduceMotion ? "none" : "slide_from_right";
  const fadeAnimation = reduceMotion ? "none" : "fade";
  const modalAnimation = reduceMotion ? "none" : "slide_from_bottom";

  return (
    <>
      <StatusBar style={resolvedScheme === "light" ? "dark" : "light"} />
      <Stack
        key={resolvedScheme}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: pushAnimation,
          // Keep the push brisk; the default ~350ms can feel heavy on a deep
          // nav stack. 220ms lands in the "fluid, not sluggish" band.
          animationDuration: 220,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="(auth)" options={{ animation: fadeAnimation }} />
        <Stack.Screen name="(tabs)" options={{ animation: fadeAnimation }} />
        <Stack.Screen name="onboarding" options={{ animation: modalAnimation }} />
        <Stack.Screen name="setup-password" options={{ animation: pushAnimation }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [i18nHydrated, setI18nHydrated] = useState(false);
  const [queryClient] = useState(() => createQueryClient());

  // Route forced logouts (401 → clearSession from onUnauthorized / refreshUser)
  // through the SAME sensitive-state teardown the manual sign-out uses, so an
  // expired session never leaves the prior user's PII (dashboard/widget
  // snapshots, last-plan hint, onboarding cache) on the device. Registered here
  // because clearSensitiveLocalState needs the queryClient; auth-store invokes
  // it via the hook to avoid an import cycle.
  useEffect(() => {
    setSessionCleanupHook(() => clearSensitiveLocalState(queryClient));
    return () => setSessionCleanupHook(null);
  }, [queryClient]);

  // LocateFlow design system. Playfair Display is the display/serif face (the
  // wordmark, hero numerals, section titles); DM Sans is the UI face; DM Mono
  // is for numerals/meta. These three families are the only faces the app
  // renders (legacy Fraunces + Geist loading was removed — they were no longer
  // referenced by any screen). All are loaded on first boot and the splash is
  // held until they resolve so no screen flashes a system fallback for the
  // brand wordmark.
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
    PlayfairDisplay_800ExtraBold,
    PlayfairDisplay_900Black,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
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
    // Pre-splash flash color = the design's mobile dark canvas (#0A0F1C).
    // No exact token exists for this transitional bg (surface tokens are the
    // app's #070B14 navy); the design literal is used to match the handoff.
    return <View style={{ flex: 1, backgroundColor: "#0A0F1C" }} />;
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
