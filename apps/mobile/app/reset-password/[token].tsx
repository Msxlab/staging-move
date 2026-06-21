import React, { useState, useMemo } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Input } from "@/components/ui/Input";
import { MoveRaccoon, SectionHeader } from "@/components/move";
import { api } from "@/lib/api";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";

export default function ResetPasswordScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!token) {
      setError(t("auth.resetPasswordMissingToken"));
      return;
    }
    if (!newPassword || newPassword !== confirmPassword) {
      setError(t("auth.resetPasswordMismatch"));
      return;
    }

    setSaving(true);
    const res = await api.post<{ success?: boolean }>("/api/auth/password/reset/confirm", {
      token,
      newPassword,
    });
    setSaving(false);

    if (res.error || !res.data?.success) {
      setError(t("auth.resetPasswordFailed"));
      hapticError();
      return;
    }

    hapticSuccess();
    Alert.alert(t("auth.resetPasswordSuccessTitle"), t("auth.resetPasswordSuccessBody"), [
      { text: t("auth.resetPasswordSignIn"), onPress: () => router.replace("/(auth)/sign-in") },
    ]);
  };

  const disabled = saving || !newPassword || !confirmPassword;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(auth)/sign-in")} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("auth.resetPasswordTitle")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.authPanel}>
            <View style={styles.hero}>
              <View style={styles.brandBadge}>
                <MoveRaccoon size={56} mood="calm" />
              </View>
              <View style={styles.iconWrap}>
                <Lock size={20} color={theme.colors.primary} />
              </View>
              <Text style={styles.heroKicker}>SECURE RESET</Text>
              <Text style={styles.heading}>{t("auth.resetPasswordHeading")}</Text>
              <Text style={styles.copy}>{t("auth.resetPasswordCopy")}</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <SectionHeader label={t("auth.resetPasswordTitle")} style={styles.sectionHeader} />

            <View style={styles.fields}>
              <Input
                label={t("auth.newPassword")}
                value={newPassword}
                onChangeText={setNewPassword}
                isPassword
                autoCapitalize="none"
                placeholder={t("auth.newPasswordPlaceholder")}
              />
              <Input
                label={t("auth.confirmPassword")}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
                autoCapitalize="none"
                placeholder={t("auth.confirmPasswordPlaceholder")}
              />
            </View>

            <TouchableOpacity
              onPress={submit}
              disabled={disabled}
              activeOpacity={0.85}
              style={[styles.ctaWrap, disabled && styles.ctaDisabled]}
            >
              <LinearGradient
                colors={theme.colors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>
                  {saving ? t("auth.saving") : t("auth.resetPasswordTitle")}
                </Text>
                <ArrowRight size={16} color={theme.colors.onAccent} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
  content: { flexGrow: 1, justifyContent: "center", padding: 24 },
  authPanel: { gap: 0 },
  hero: { alignItems: "center", marginBottom: 24 },
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
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    marginBottom: 12,
  },
  heroKicker: {
    fontSize: 10,
    fontFamily: fonts.sansBold,
    letterSpacing: 1.4,
    color: theme.colors.accent,
    textTransform: "uppercase",
    textAlign: "center",
  },
  heading: {
    fontFamily: fonts.serifBlack,
    fontSize: 26,
    color: theme.colors.text,
    textAlign: "center",
    marginTop: 8,
  },
  copy: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: theme.colors.dim,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
    maxWidth: 280,
  },
  error: { color: theme.colors.error, fontSize: 13, marginBottom: 10, textAlign: "center" },
  sectionHeader: { marginBottom: 12 },
  fields: { gap: 11 },
  ctaWrap: { marginTop: 18, borderRadius: theme.radius.lg, overflow: "hidden" },
  ctaDisabled: { opacity: 0.5 },
  cta: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  ctaText: { color: theme.colors.onAccent, fontSize: 15, fontFamily: fonts.sansSemibold },
});
