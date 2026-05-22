import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, User, CheckCircle2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { AppleLogoMark, GoogleGMark } from "@/components/ui/BrandLogos";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { api, API_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { LegalConsentPanel } from "@/components/legal/LegalConsentPanel";
import {
  createAcceptedLegalConsents,
  getDefaultLegalConsents,
  hasRequiredLegalConsents,
  setPendingLegalConsents,
} from "@/lib/legal";
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

export default function SignUpScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const { t } = useTranslation();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<OAuthProviderStatusMap | null>(null);
  const [legalConsents, setLegalConsents] = useState(() => getDefaultLegalConsents());
  const [nativeAppleAvailable, setNativeAppleAvailable] = useState(false);

  useEffect(() => {
    api.get<{ providers?: OAuthProviderStatusMap }>("/api/auth/oauth/providers")
      .then((res) => {
        if (__DEV__) {
          console.info("[OAuthProviders] sign-up", {
            apiUrl: API_URL,
            error: res.error,
            providers: res.data?.providers ?? null,
          });
        }
        setOauthProviders(res.data?.providers || null);
      })
      .catch((err) => {
        if (__DEV__) {
          console.warn("[OAuthProviders] sign-up fetch failed", {
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
  const legalAccepted = hasRequiredLegalConsents(legalConsents);
  const showOAuthReadinessNote = shouldShowOAuthReadinessNote(oauthProviders);

  const handleSubmit = async () => {
    if (!legalAccepted) {
      setError(t("auth.acceptLegalBeforeAccount"));
      hapticError();
      return;
    }
    setLoading(true);
    setError("");
    const res = await api.post<{ success?: boolean; error?: string }>("/api/auth/register", {
      email: email.trim(),
      password,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      legalConsents: createAcceptedLegalConsents(legalConsents),
    });

    if (res.error || !res.data?.success) {
      setError(res.error || t("auth.invalid"));
      hapticError();
      setLoading(false);
      return;
    }

    hapticSuccess();
    setDone(true);
    setLoading(false);
  };

  const openOAuth = async (provider: OAuthProvider) => {
    if (!legalAccepted) {
      setError(t("auth.acceptLegalBeforeProvider", { provider: provider === "google" ? "Google" : "Apple" }));
      hapticError();
      return;
    }
    setOauthLoading(provider);
    setError("");
    const acceptedLegalConsents = createAcceptedLegalConsents(legalConsents);
    try {
      await setPendingLegalConsents(acceptedLegalConsents);

      if (provider === "apple" && Platform.OS === "ios" && nativeAppleAvailable) {
        const native = await signInWithAppleNative({ legalConsents: acceptedLegalConsents });
        if (native.status === "cancelled") {
          await setPendingLegalConsents(null);
          return;
        }
        if (native.status === "ok" && native.token && native.user) {
          await setSession(native.token, native.user);
          // The native Apple route persisted these consents during the handoff.
          await setPendingLegalConsents(null);
          hapticSuccess();
          router.replace(getPostAuthMobileRoute(native.user));
          return;
        }
        if (native.status === "error") {
          await setPendingLegalConsents(null);
          setError(native.error || t("auth.invalid"));
          hapticError();
          return;
        }
        // status === "unavailable" → fall through to the web flow.
      }

      const result = await startMobileOAuthSession(provider, setSession);
      if (result.cancelled) {
        await setPendingLegalConsents(null);
        return;
      }
      if (!result.success) {
        await setPendingLegalConsents(null);
        setError(result.error || t("auth.invalid"));
        hapticError();
        return;
      }
      hapticSuccess();
      router.replace(getPostAuthMobileRoute(result.user));
    } catch (err: any) {
      await setPendingLegalConsents(null);
      setError(err?.message || t("auth.invalid"));
      hapticError();
    } finally {
      setOauthLoading(null);
    }
  };

  if (done) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <CheckCircle2 size={48} color="#34d399" style={{ alignSelf: "center" }} />
        <Text style={styles.title}>{t("auth.checkEmail")}</Text>
        <Text style={styles.subtitle}>
          {t("auth.checkEmailDescription", { email })}
        </Text>
        <Button
          title={t("auth.signIn")}
          onPress={() => router.replace("/(auth)/sign-in")}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LogoBrand />
        <Text style={styles.title}>{t("auth.signUp_title")}</Text>
        <Text style={styles.subtitle}>{t("auth.signUp")}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

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
            {t("auth.socialSignUpUnavailable")}
          </Text>
        ) : null}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t("auth.or").toUpperCase()}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input placeholder={t("auth.firstName")} value={firstName} onChangeText={setFirstName}
              leftIcon={<User size={16} color={theme.colors.textMuted} />} />
          </View>
          <View style={{ flex: 1 }}>
            <Input placeholder={t("auth.lastName")} value={lastName} onChangeText={setLastName} />
          </View>
        </View>

        <Input
          placeholder={t("auth.email")} value={email} onChangeText={setEmail}
          keyboardType="email-address" autoCapitalize="none" autoComplete="email"
          leftIcon={<Mail size={16} color={theme.colors.textMuted} />}
        />
        <Input
          placeholder={t("auth.password")} value={password} onChangeText={setPassword}
          isPassword autoComplete="password-new"
          leftIcon={<Lock size={16} color={theme.colors.textMuted} />}
        />

        <LegalConsentPanel
          consents={legalConsents}
          onChange={setLegalConsents}
          title={t("auth.requiredAcknowledgements")}
          description={t("auth.requiredAcknowledgementsDescription")}
          compact
        />

        <Button
          title={loading ? t("common.loading") : t("auth.signUp")}
          onPress={handleSubmit}
          disabled={loading || !email || !password || !legalAccepted}
          style={{ marginTop: 12 }}
        />

        <TouchableOpacity
          onPress={() => router.replace("/(auth)/sign-in")}
          style={{ alignItems: "center", marginTop: 12 }}
        >
          <Text style={styles.linkText}>
            {t("auth.haveAccount")} <Text style={styles.linkEmphasis}>{t("auth.signIn")}</Text>
          </Text>
        </TouchableOpacity>
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
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.textMuted, fontSize: 10, letterSpacing: 1.5 },
  row: { flexDirection: "row", gap: 8 },
  hint: { fontSize: 11, color: theme.colors.textMuted, marginTop: -4 },
  linkText: { color: theme.colors.textMuted, fontSize: 13 },
  linkEmphasis: { color: theme.colors.primary, fontWeight: "600" },
});
