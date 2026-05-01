import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, ArrowRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { registerForPushNotifications } from "@/lib/push";
import { startMobileOAuthSession, type OAuthProvider } from "@/lib/mobile-oauth";

interface OAuthProviderStatus {
  configured: boolean;
  label: string;
  message: string;
}

export default function SignInScreen() {
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
  const [oauthProviders, setOauthProviders] = useState<Record<string, OAuthProviderStatus> | null>(null);

  useEffect(() => {
    api.get<{ providers?: Record<string, OAuthProviderStatus> }>("/api/auth/oauth/providers")
      .then((res) => setOauthProviders(res.data?.providers || null))
      .catch(() => setOauthProviders(null));
  }, []);

  const googleReady = oauthProviders?.google?.configured ?? true;
  const appleReady = oauthProviders?.apple?.configured ?? true;
  const showOAuthReadinessNote =
    Boolean(oauthProviders) && (!googleReady || !appleReady);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const res = await api.post<{ token?: string; user?: any; requiresMfa?: boolean; error?: string }>(
      "/api/auth/login",
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
    registerForPushNotifications().catch(() => {});
    router.replace("/(tabs)");
  };

  const openOAuth = (provider: "google" | "apple") => {
    // OAuth on mobile hands off to an in-app browser. The server sets a session
    // cookie at the end of the flow, which the WebView/browser can carry back
    // via the expo-web-browser auth-session return URL. For simplicity in MVP
    // we open the web URL and exchange the returned mobile code.
    const mobileRedirectUri = encodeURIComponent("locateflow://oauth");
    Linking.openURL(`${webBase}/api/auth/oauth/${provider}?client=mobile&mobileRedirectUri=${mobileRedirectUri}&redirect=/dashboard`);
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
            <Button
              title={googleReady ? t("auth.continueWithGoogle") : t("auth.googleUnavailable")}
              variant="outline"
              onPress={() => openOAuth("google")}
              disabled={!googleReady || Boolean(oauthLoading)}
              style={styles.oauthBtn}
            />
            <Button
              title={appleReady ? t("auth.continueWithApple") : t("auth.appleUnavailable")}
              variant="primary"
              onPress={() => openOAuth("apple")}
              disabled={!appleReady || Boolean(oauthLoading)}
              style={{ ...styles.oauthBtn, backgroundColor: "#000" }}
            />

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

const styles = StyleSheet.create({
  scroll: { padding: 24, gap: 10, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", color: theme.colors.text, marginTop: 24 },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
  error: { color: "#f87171", fontSize: 13, marginBottom: 8 },
  oauthBtn: { marginBottom: 6 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.textMuted, fontSize: 10, letterSpacing: 1.5 },
  oauthNote: {
    color: "#fde68a",
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  linkRow: { alignItems: "center", marginTop: 10 },
  linkText: { color: theme.colors.textMuted, fontSize: 13 },
  linkEmphasis: { color: theme.colors.primary, fontWeight: "600" },
});
