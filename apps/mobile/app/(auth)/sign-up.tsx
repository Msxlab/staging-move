import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Mail, Lock, User, Check, CheckCircle2, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme, fonts } from "@/lib/theme";
import { MoveRaccoon } from "@/components/move";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
import { consumePendingInviteJoin, hydratePendingInviteToken } from "@/lib/workspace-invite";
import { registerForPushNotifications } from "@/lib/push";
import {
  canAttemptAppleOAuth,
  canAttemptGoogleOAuth,
  isOAuthProviderExplicitlyUnavailable,
  shouldShowOAuthReadinessNote,
  type OAuthProviderStatusMap,
} from "@/lib/oauth-provider-status";
import { getPasswordRuleResults } from "@/lib/password-policy";

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
  // True when the user reached sign-up from an invite deep link (token stashed
  // by the root layout). Drives the "you're joining a household" banner so the
  // continuity is visible; the actual auto-join happens post-auth.
  const [hasPendingInvite, setHasPendingInvite] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hydratePendingInviteToken().then((token) => {
      if (!cancelled) setHasPendingInvite(Boolean(token));
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
  const passwordRuleResults = useMemo(() => getPasswordRuleResults(password), [password]);
  const passwordPolicyMet = passwordRuleResults.every((rule) => rule.passed);

  const handleSubmit = async () => {
    if (!legalAccepted) {
      setError(t("auth.acceptLegalBeforeAccount"));
      hapticError();
      return;
    }
    if (!passwordPolicyMet) {
      setError(t("auth.setupPasswordHelper"));
      hapticError();
      return;
    }
    setLoading(true);
    setError("");
    const emailValue = email.trim();
    const res = await api.post<{
      success?: boolean;
      error?: string;
      emailVerified?: boolean;
      requiresEmailVerification?: boolean;
    }>("/api/auth/register", {
      email: emailValue,
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

    if (res.data.emailVerified === true || res.data.requiresEmailVerification === false) {
      const loginRes = await api.post<{ token?: string; user?: any; error?: string }>(
        "/api/mobile/auth/login",
        { email: emailValue, password },
      );

      if (loginRes.error || !loginRes.data?.token || !loginRes.data.user) {
        setError(loginRes.error || t("auth.invalid"));
        hapticError();
        setLoading(false);
        return;
      }

      await setSession(loginRes.data.token, loginRes.data.user);
      hapticSuccess();
      void registerForPushNotifications().catch(() => null);
      // Auto-verified account (e.g. QA allowlist): a session exists right away,
      // so consume any pending invite token NOW to auto-join the invitee. The
      // normal email-verify path below has no session yet — its token is
      // consumed on the later sign-in (see sign-in.tsx).
      await consumePendingInviteJoin().catch(() => null);
      router.replace(getPostAuthMobileRoute(loginRes.data.user));
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
          await consumePendingInviteJoin().catch(() => null);
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
      await consumePendingInviteJoin().catch(() => null);
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.authPanel}>
          <View style={styles.confirmHero}>
            <View style={styles.confirmIcon}>
              <CheckCircle2 size={32} color={theme.colors.success} />
            </View>
            <Text style={styles.confirmTitle}>{t("auth.checkEmail")}</Text>
            <Text style={styles.confirmSubtitle}>
              {t("auth.checkEmailDescription", { email })}
            </Text>
          </View>
          <Button
            title={t("auth.signIn")}
            onPress={() => router.replace("/(auth)/sign-in")}
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.authPanel}>
          <Animated.View style={styles.hero} entering={FadeInDown.duration(480)}>
            <View style={styles.markBadge}>
              <MoveRaccoon size={56} mood="calm" />
            </View>
            <Text style={styles.title}>{t("auth.signUp_title")}</Text>
            <Text style={styles.subtitle}>{t("auth.signUp")}</Text>
          </Animated.View>

          {hasPendingInvite ? (
            <View style={styles.inviteBanner}>
              <Text style={styles.inviteBannerText}>
                {t(
                  "auth.inviteSignUpContext",
                  "You're creating an account to join the household you were invited to. We'll add you automatically once you're signed in.",
                )}
              </Text>
            </View>
          ) : null}

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
          {password.length > 0 ? (
            <View style={styles.rulesBox}>
              {passwordRuleResults.map((rule) => {
                const color = rule.passed ? theme.colors.success : theme.colors.textMuted;
                return (
                  <View key={rule.key} style={styles.ruleRow}>
                    {rule.passed ? (
                      <Check size={14} color={theme.colors.success} />
                    ) : (
                      <X size={14} color={theme.colors.textMuted} />
                    )}
                    <Text style={[styles.ruleText, { color }]}>{t(rule.labelKey)}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <LegalConsentPanel
            consents={legalConsents}
            onChange={setLegalConsents}
            title={t("auth.requiredAcknowledgements")}
            description={t("auth.requiredAcknowledgementsDescription")}
            compact
          />

          <Button
            variant="gradient"
            fullWidth
            title={loading ? t("common.loading") : t("auth.signUp")}
            onPress={handleSubmit}
            disabled={loading || !email || !password || !passwordPolicyMet || !legalAccepted}
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 20, flexGrow: 1, justifyContent: "center" },
  authPanel: {
    borderRadius: 28,
    padding: 18,
    gap: 10,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
    ...theme.shadow.sm,
  },
  hero: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 8,
  },
  markBadge: {
    width: 78,
    height: 78,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.serifBlack,
    color: theme.colors.text,
    marginTop: 16,
    textAlign: "center",
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 13.5,
    fontFamily: fonts.sans,
    color: theme.colors.dim,
    marginTop: 6,
    marginBottom: 16,
    textAlign: "center",
  },
  confirmHero: { alignItems: "center", paddingTop: 8, paddingBottom: 8 },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.successFaded,
  },
  confirmTitle: {
    fontSize: 22,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
    marginTop: 16,
    textAlign: "center",
  },
  confirmSubtitle: {
    fontSize: 13.5,
    fontFamily: fonts.sans,
    color: theme.colors.dim,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 8,
    textAlign: "center",
  },
  inviteBanner: {
    padding: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primaryFaded,
    backgroundColor: theme.colors.primaryFaded,
    marginBottom: 12,
  },
  inviteBannerText: { fontSize: 12, color: theme.colors.text, lineHeight: 18, fontFamily: fonts.sans },
  error: { color: theme.colors.error, fontSize: 13, marginBottom: 8, fontFamily: fonts.sansMedium },
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
  oauthGoogleText: { color: "#14202F", fontSize: 14.5, fontFamily: fonts.sansSemibold },
  oauthAppleText: { color: "#fff", fontSize: 14.5, fontFamily: fonts.sansSemibold },
  oauthNote: {
    color: theme.colors.warning,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.sans,
    backgroundColor: theme.colors.warningFaded,
    borderWidth: 1,
    borderColor: theme.colors.amberLine,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.faint, fontSize: 10, letterSpacing: 1.5, fontFamily: fonts.sansMedium },
  row: { flexDirection: "row", gap: 8 },
  hint: { fontSize: 11, color: theme.colors.textMuted, marginTop: -4 },
  rulesBox: {
    gap: 7,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleText: { fontSize: 12, lineHeight: 16, fontFamily: fonts.sans },
  linkText: { color: theme.colors.dim, fontSize: 13, fontFamily: fonts.sans },
  linkEmphasis: { color: theme.colors.primary, fontFamily: fonts.sansSemibold },
});
