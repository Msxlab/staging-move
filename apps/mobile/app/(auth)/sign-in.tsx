import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, ArrowRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { AppleLogoMark, GoogleGMark } from "@/components/ui/BrandLogos";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { api, API_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { registerForPushNotifications } from "@/lib/push";
import { startMobileOAuthSession, type OAuthProvider } from "@/lib/mobile-oauth";
import { isNativeAppleSignInAvailable, signInWithAppleNative } from "@/lib/apple-auth";
import { getPostAuthMobileRoute } from "@/lib/post-auth-route";
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
        ...(requiresMfa && mfaCode ? { mfaCode } : {}),
      },
    );

    if (res.data?.requiresMfa) {
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
    router.replace("/(tabs)");
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
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <LogoBrand />
        <Text style={styles.title}>{t("auth.signIn")}</Text>
        <Text style={styles.subtitle}>{t("auth.signIn_title")}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!requiresMfa && (
          <>
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
            <TouchableOpacity
              onPress={() => openOAuth("apple")}
              disabled={!appleReady || Boolean(oauthLoading)}
              activeOpacity={0.78}
              style={[styles.oauthButton, styles.oauthApple, (!appleReady || Boolean(oauthLoading)) && styles.oauthDisabled]}
              accessibilityLabel={t("auth.continueWithApple")}
              accessibilityRole="button"
            >
              <AppleLogoMark size={18} color="#fff" />
              <Text style={styles.oauthAppleText}>
                {appleReady ? t("auth.continueWithApple") : t("auth.appleUnavailable")}
              </Text>
            </TouchableOpacity>

            {showOAuthReadinessNote ? (
              <Text style={styles.oauthNote}>
                {t("auth.socialSignInUnavailable")}
              </Text>
            ) : null}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t("auth.or").toUpperCase()}</Text>
              <View style={styles.dividerLine} />
            </View>

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
          title={
            loading
              ? t("common.loading")
              : requiresMfa
              ? t("common.submit")
              : t("auth.signIn")
          }
          onPress={handleSubmit}
          disabled={loading || !email || !password || (requiresMfa && mfaCode.length < 6)}
          rightIcon={<ArrowRight size={16} color="#fff" />}
          style={{ marginTop: 12 }}
        />

        {!requiresMfa && (
          <>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>{t("auth.forgotPassword")}</Text>
            </TouchableOpacity>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  scroll: { padding: 24, gap: 10, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", color: theme.colors.text, marginTop: 24 },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
  error: { color: theme.colors.error, fontSize: 13, marginBottom: 8 },
  oauthBtn: { marginBottom: 6 },
  oauthButton: {
    minHeight: 52,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  oauthGoogle: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(20, 32, 47, 0.14)",
    ...theme.shadow.sm,
  },
  oauthApple: {
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    ...theme.shadow.sm,
  },
  oauthDisabled: { opacity: 0.5 },
  oauthGoogleText: { color: "#14202F", fontSize: 15, fontWeight: "700" },
  oauthAppleText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.textMuted, fontSize: 10, letterSpacing: 1.5 },
  oauthNote: {
    color: theme.colors.warning,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: theme.colors.warningFaded,
    borderWidth: 1,
    borderColor: "rgba(242, 196, 108, 0.2)",
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  linkRow: { alignItems: "center", marginTop: 10 },
  linkText: { color: theme.colors.textMuted, fontSize: 13 },
  linkEmphasis: { color: theme.colors.primary, fontWeight: "600" },
});
