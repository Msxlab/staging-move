import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, ArrowRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MoveRaccoon } from "@/components/move";
import { AppleLogoMark, GoogleGMark } from "@/components/ui/BrandLogos";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { api, API_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { registerForPushNotifications } from "@/lib/push";
import { startMobileOAuthSession, type OAuthProvider } from "@/lib/mobile-oauth";
import { isNativeAppleSignInAvailable, signInWithAppleNative } from "@/lib/apple-auth";
import { getPostAuthMobileRoute } from "@/lib/post-auth-route";
import { consumePendingInviteJoin } from "@/lib/workspace-invite";
import {
  canAttemptAppleOAuth,
  canAttemptGoogleOAuth,
  isOAuthProviderExplicitlyUnavailable,
  shouldShowOAuthReadinessNote,
  type OAuthProviderStatusMap,
} from "@/lib/oauth-provider-status";

export default function SignInScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");
  const [oauthProviders, setOauthProviders] = useState<OAuthProviderStatusMap | null>(null);
  const [nativeAppleAvailable, setNativeAppleAvailable] = useState(false);

  useEffect(() => {
    api.get<{ providers?: OAuthProviderStatusMap }>("/api/auth/oauth/providers")
      .then((res) => {
        if (__DEV__) {
          console.info("[OAuthProviders] sign-in", {
            apiUrl: API_URL,
            error: res.error,
            providers: res.data?.providers ?? null,
          });
        }
        setOauthProviders(res.data?.providers || null);
      })
      .catch((err) => {
        if (__DEV__) {
          console.warn("[OAuthProviders] sign-in fetch failed", {
            apiUrl: API_URL,
            message: err instanceof Error ? err.message : String(err),
          });
        }
        setOauthProviders(null);
      });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let cancelled = false;
    void isNativeAppleSignInAvailable().then((available) => {
      if (!cancelled) setNativeAppleAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const googleReady = canAttemptGoogleOAuth(oauthProviders);
  const appleReady = canAttemptAppleOAuth(oauthProviders);
  const googleUnavailable = isOAuthProviderExplicitlyUnavailable(oauthProviders, "google");
  const showOAuthReadinessNote = shouldShowOAuthReadinessNote(oauthProviders);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const res = await api.post<{ token?: string; user?: any; requiresMfa?: boolean; error?: string }>(
      "/api/mobile/auth/login",
      {
        email: email.trim(),
        password,
        // A 6-digit numeric value is a TOTP code; anything else is treated as a
        // recovery/backup code so a user who lost their authenticator can still
        // sign in (the web login route accepts mfaCode OR backupCode).
        ...(requiresMfa && mfaCode
          ? /^\d{6}$/.test(mfaCode.trim())
            ? { mfaCode: mfaCode.trim() }
            : { backupCode: mfaCode.trim() }
          : {}),
      },
    );

    // The MFA challenge returns as HTTP 403, where the shared API client
    // exposes only `error` + `code` (the body's `data` is dropped on non-2xx).
    // Key off the stable `code` so MFA-enrolled users actually reach the
    // code-entry step instead of seeing a generic "invalid credentials" error.
    if (res.code === "MFA_REQUIRED" || res.data?.requiresMfa) {
      setRequiresMfa(true);
      setLoading(false);
      return;
    }

    if (res.error || !res.data?.token || !res.data.user) {
      setError(res.error || t("auth.invalid"));
      hapticError();
      setLoading(false);
      return;
    }

    await setSession(res.data.token, res.data.user);
    hapticSuccess();
    // Push registration is gated by the soft-prompt decision; this call is a
    // no-op until the user accepts the in-app pre-prompt from onboarding /
    // settings. Kept here so previously-opted-in devices re-register on login.
    void registerForPushNotifications().catch(() => null);
    // If a NEVER-REGISTERED invitee created their account from an invite link and
    // is now signing in (the common email-verify-then-sign-in path), consume the
    // stashed token to auto-join them. Best-effort + idempotent: a failure here
    // never blocks sign-in, and the in-app pending-invite prompt is the backstop.
    await consumePendingInviteJoin().catch(() => null);
    // Route through the same post-auth destination as the OAuth/Apple paths so a
    // not-yet-onboarded password user lands on onboarding directly instead of
    // flashing into the tab bar and being bounced back by the AuthGuard.
    router.replace(getPostAuthMobileRoute(res.data.user));
  };

  const openOAuth = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    setError("");
    try {
      // iOS: prefer the native Sign in with Apple sheet when available.
      // This satisfies Apple HIG / Login Services guidance for any app that
      // offers third-party login. Falls back to the server-mediated OAuth
      // flow (still Sign in with Apple via Safari View Controller) when
      // unavailable (e.g. simulator, deprovisioned capability).
      if (provider === "apple" && Platform.OS === "ios" && nativeAppleAvailable) {
        const native = await signInWithAppleNative();
        if (native.status === "cancelled") return;
        if (native.status === "ok" && native.token && native.user) {
          await setSession(native.token, native.user);
          hapticSuccess();
          void registerForPushNotifications().catch(() => null);
          await consumePendingInviteJoin().catch(() => null);
          router.replace(getPostAuthMobileRoute(native.user));
          return;
        }
        if (native.status === "error") {
          setError(native.error || t("auth.invalid"));
          hapticError();
          return;
        }
        // status === "unavailable" → fall through to the web flow.
      }

      const result = await startMobileOAuthSession(provider, setSession);
      if (result.cancelled) {
        return;
      }
      if (!result.success) {
        setError(result.error || t("auth.invalid"));
        hapticError();
        return;
      }
      hapticSuccess();
      void registerForPushNotifications().catch(() => null);
      await consumePendingInviteJoin().catch(() => null);
      router.replace(getPostAuthMobileRoute(result.user));
    } catch (err: any) {
      setError(err?.message || t("auth.invalid"));
      hapticError();
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authPanel}>
          <View style={styles.hero}>
            <View style={styles.brandBadge}>
              <MoveRaccoon size={62} mood="calm" />
            </View>
            <Text style={styles.title}>{t("auth.signIn")}</Text>
            <Text style={styles.subtitle}>{t("auth.signIn_title")}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!requiresMfa && (
            <>
            <View style={styles.fields}>
              <Input
                placeholder={t("auth.email")}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon={<Mail size={16} color={theme.colors.textMuted} />}
              />
              <Input
                placeholder={t("auth.password")}
                value={password}
                onChangeText={setPassword}
                isPassword
                autoComplete="password"
                leftIcon={<Lock size={16} color={theme.colors.textMuted} />}
              />
              <TouchableOpacity
                onPress={() => router.push("/(auth)/forgot-password")}
                style={styles.forgotRow}
              >
                <Text style={styles.forgotText}>{t("auth.forgotPassword")}</Text>
              </TouchableOpacity>
            </View>
            </>
          )}

          {requiresMfa && (
            <Input
              placeholder={t("auth.mfaCode")}
              value={mfaCode}
              onChangeText={(v) => setMfaCode(v.replace(/\s/g, "").slice(0, 12))}
              autoCapitalize="characters"
              maxLength={12}
              autoFocus
            />
          )}

          <Button
            variant="gradient"
            fullWidth
            title={
              loading
                ? t("common.loading")
                : requiresMfa
                ? t("common.submit")
                : t("auth.signIn")
            }
            onPress={handleSubmit}
            disabled={loading || !email || !password || (requiresMfa && mfaCode.length < 6)}
            rightIcon={<ArrowRight size={16} color={theme.colors.onAccent} />}
            style={styles.cta}
          />

          {!requiresMfa && (
            <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t("auth.or").toUpperCase()}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.oauthGroup}>
              {appleReady && (
              <TouchableOpacity
                onPress={() => openOAuth("apple")}
                disabled={Boolean(oauthLoading)}
                activeOpacity={0.78}
                style={[styles.oauthButton, styles.oauthApple, Boolean(oauthLoading) && styles.oauthDisabled]}
                accessibilityLabel={t("auth.continueWithApple")}
                accessibilityRole="button"
              >
                <AppleLogoMark size={18} color="#fff" />
                <Text style={styles.oauthAppleText}>
                  {t("auth.continueWithApple")}
                </Text>
              </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => openOAuth("google")}
                disabled={!googleReady || Boolean(oauthLoading)}
                activeOpacity={0.78}
                style={[styles.oauthButton, styles.oauthGoogle, (!googleReady || Boolean(oauthLoading)) && styles.oauthDisabled]}
                accessibilityLabel={t("auth.continueWithGoogle")}
                accessibilityRole="button"
              >
                <GoogleGMark size={20} />
                <Text style={styles.oauthGoogleText}>
                  {googleUnavailable ? t("auth.googleUnavailable") : t("auth.continueWithGoogle")}
                </Text>
              </TouchableOpacity>
            </View>

            {showOAuthReadinessNote ? (
              <Text style={styles.oauthNote}>
                {t("auth.socialSignInUnavailable")}
              </Text>
            ) : null}

            <TouchableOpacity
              onPress={() => router.push("/(auth)/sign-up")}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>
                {t("auth.noAccount")}{" "}
                <Text style={styles.linkEmphasis}>{t("auth.signUp")}</Text>
              </Text>
            </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 24, flexGrow: 1, justifyContent: "center" },
  authPanel: {
    gap: 0,
  },
  hero: {
    alignItems: "center",
    marginBottom: 28,
  },
  brandBadge: {
    width: 78,
    height: 78,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    ...theme.shadow.sm,
  },
  title: {
    fontFamily: fonts.serifBlack,
    fontSize: 30,
    color: theme.colors.text,
    marginTop: 16,
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: theme.colors.dim,
    marginTop: 6,
    textAlign: "center",
    maxWidth: 280,
  },
  error: { color: theme.colors.error, fontSize: 13, marginBottom: 10, textAlign: "center" },
  fields: { gap: 11 },
  forgotRow: { alignSelf: "flex-end", paddingVertical: 2 },
  forgotText: {
    color: theme.colors.accent,
    fontSize: 12.5,
    fontFamily: fonts.sansSemibold,
  },
  cta: { marginTop: 18 },
  oauthButton: {
    minHeight: 50,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  oauthGroup: { gap: 10 },
  oauthGoogle: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  oauthApple: {
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  oauthDisabled: { opacity: 0.5 },
  oauthGoogleText: { color: theme.colors.text, fontSize: 14, fontFamily: fonts.sansSemibold },
  oauthAppleText: { color: "#fff", fontSize: 14, fontFamily: fonts.sansSemibold },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.faint, fontSize: 11, letterSpacing: 1 },
  oauthNote: {
    color: theme.colors.warning,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: theme.colors.warningFaded,
    borderWidth: 1,
    borderColor: theme.colors.amberLine,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  linkRow: { alignItems: "center", marginTop: 24 },
  linkText: { color: theme.colors.dim, fontSize: 13, fontFamily: fonts.sans },
  linkEmphasis: { color: theme.colors.accent, fontFamily: fonts.sansSemibold },
});
