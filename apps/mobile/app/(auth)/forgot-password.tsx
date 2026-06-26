import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MoveRaccoon } from "@/components/move";
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
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authPanel}>
          <Animated.View style={styles.hero} entering={FadeInDown.duration(480)}>
            <View style={styles.brandBadge}>
              <MoveRaccoon size={62} mood={sent ? "happy" : "calm"} />
            </View>
            <Text style={styles.heroKicker}>
              {t("auth.forgotPassword_kicker", "ACCOUNT RECOVERY")}
            </Text>
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
          </Animated.View>

          {sent ? (
            <View style={styles.sentBox}>
              <View style={styles.sentBadge}>
                <CheckCircle2 size={18} color={theme.colors.success} />
                <Text style={styles.sentBadgeText}>
                  {t("auth.checkEmail", "Check your email")}
                </Text>
              </View>
              <Button
                variant="gradient"
                fullWidth
                title={t("auth.signIn")}
                onPress={() => router.replace("/(auth)/sign-in")}
                rightIcon={<ArrowRight size={16} color={theme.colors.onAccent} />}
                style={styles.cta}
              />
            </View>
          ) : (
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}

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
              </View>

              <Button
                variant="gradient"
                fullWidth
                title={loading ? t("common.loading") : t("auth.forgotPassword_submit", "Send reset link")}
                onPress={handleSubmit}
                disabled={loading || !email}
                rightIcon={<ArrowRight size={16} color={theme.colors.onAccent} />}
                style={styles.cta}
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
  heroKicker: {
    fontFamily: fonts.sansSemibold,
    fontSize: 10,
    letterSpacing: 1,
    color: theme.colors.accent,
    textTransform: "uppercase",
    marginTop: 16,
  },
  title: {
    fontFamily: fonts.serifBlack,
    fontSize: 30,
    color: theme.colors.text,
    marginTop: 8,
    textAlign: "center",
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: theme.colors.dim,
    marginTop: 6,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  error: { color: theme.colors.error, fontSize: 13, marginBottom: 10, textAlign: "center" },
  fields: { gap: 11 },
  cta: { marginTop: 18 },
  sentBox: { gap: 8 },
  sentBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  sentBadgeText: {
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: fonts.sansSemibold,
  },
  linkRow: { alignItems: "center", marginTop: 24 },
  linkText: { color: theme.colors.dim, fontSize: 13, fontFamily: fonts.sans },
  linkEmphasis: { color: theme.colors.accent, fontFamily: fonts.sansSemibold },
});
