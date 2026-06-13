import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { api } from "@/lib/api";

export default function ForgotPasswordScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const res = await api.post<{ success?: boolean; error?: string }>(
      "/api/auth/password/reset/request",
      { email: email.trim() },
    );

    setLoading(false);

    if (res.error) {
      setError(res.error);
      hapticError();
      return;
    }

    setSent(true);
    hapticSuccess();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authPanel}>
          <LogoBrand />
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              {sent ? (
                <CheckCircle2 size={24} color={theme.colors.primary} />
              ) : (
                <Mail size={24} color={theme.colors.primary} />
              )}
            </View>
            <Text style={styles.heroKicker}>ACCOUNT RECOVERY</Text>
            <Text style={styles.title}>
              {sent ? t("auth.checkEmail", "Check your email") : t("auth.forgotPassword")}
            </Text>
            <Text style={styles.subtitle}>
              {sent
                ? t("auth.forgotPassword_sentDescription", {
                    defaultValue: "If an account exists, we sent password reset instructions.",
                  })
                : t("auth.forgotPassword_subtitle", "Enter your account email.")}
            </Text>
          </View>

        {sent ? (
          <View style={styles.sentBox}>
            <Button
              title={t("auth.signIn")}
              onPress={() => router.replace("/(auth)/sign-in")}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Input
              placeholder={t("auth.email")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Mail size={16} color={theme.colors.textMuted} />}
            />

            <Button
              title={loading ? t("common.loading") : t("auth.forgotPassword_submit", "Send reset link")}
              onPress={handleSubmit}
              disabled={loading || !email}
              rightIcon={<ArrowRight size={16} color="#fff" />}
              style={{ marginTop: 12 }}
            />

            <TouchableOpacity
              onPress={() => router.replace("/(auth)/sign-in")}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>
                <Text style={styles.linkEmphasis}>{t("auth.signIn")}</Text>
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
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 24, gap: 10, flexGrow: 1, justifyContent: "center" },
  authPanel: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
    ...theme.shadow.sm,
  },
  hero: { alignItems: "center", marginTop: 18, marginBottom: 18 },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.primary + "33",
    marginBottom: 12,
  },
  heroKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 0, color: theme.colors.accent, textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.text, marginTop: 6, textAlign: "center" },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginTop: 8, marginBottom: 0, textAlign: "center", lineHeight: 20 },
  error: { color: theme.colors.error, fontSize: 13, marginBottom: 8 },
  sentBox: { alignItems: "center", paddingBottom: 4, gap: 8 },
  linkRow: { alignItems: "center", marginTop: 16 },
  linkText: { color: theme.colors.textMuted, fontSize: 13 },
  linkEmphasis: { color: theme.colors.primary, fontWeight: "600" },
});
