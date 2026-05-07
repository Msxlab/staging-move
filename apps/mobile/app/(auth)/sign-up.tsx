import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, User, CheckCircle2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { LegalConsentPanel } from "@/components/legal/LegalConsentPanel";
import {
  createAcceptedLegalConsents,
  getDefaultLegalConsents,
  hasRequiredLegalConsents,
  setPendingLegalConsents,
} from "@/lib/legal";
import { startMobileOAuthSession, type OAuthProvider } from "@/lib/mobile-oauth";

interface OAuthProviderStatus {
  configured: boolean;
  label: string;
  message: string;
}

export default function SignUpScreen() {
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
  const [oauthProviders, setOauthProviders] = useState<Record<string, OAuthProviderStatus> | null>(null);
  const [legalConsents, setLegalConsents] = useState(() => getDefaultLegalConsents());

  useEffect(() => {
    api.get<{ providers?: Record<string, OAuthProviderStatus> }>("/api/auth/oauth/providers")
      .then((res) => setOauthProviders(res.data?.providers || null))
      .catch(() => setOauthProviders(null));
  }, []);

  const googleReady = oauthProviders?.google?.configured === true;
  const appleReady = oauthProviders?.apple?.configured === true;
  const legalAccepted = hasRequiredLegalConsents(legalConsents);
  const showOAuthReadinessNote =
    Boolean(oauthProviders) && (!googleReady || !appleReady);

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
      router.replace("/onboarding");
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

const styles = StyleSheet.create({
  scroll: { padding: 24, gap: 10, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", color: theme.colors.text, marginTop: 24 },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
  error: { color: theme.colors.error, fontSize: 13, marginBottom: 8 },
  oauthBtn: { marginBottom: 6 },
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
