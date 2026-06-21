import React, { useState, useMemo } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useAppTheme, type Theme } from "@/lib/theme";

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
            <View style={styles.iconWrap}>
              <Lock size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.heroKicker}>SECURE RESET</Text>
            <Text style={styles.heading}>{t("auth.resetPasswordHeading")}</Text>
            <Text style={styles.copy}>{t("auth.resetPasswordCopy")}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

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
            <Button
              title={saving ? t("auth.saving") : t("auth.resetPasswordTitle")}
              onPress={submit}
              loading={saving}
              disabled={saving || !newPassword || !confirmPassword}
              fullWidth
              style={{ marginTop: 12 }}
            />
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
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
  authPanel: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
    ...theme.shadow.sm,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: "rgba(203, 164, 94,0.22)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  heroKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 0, color: theme.colors.accent, textTransform: "uppercase", textAlign: "center" },
  heading: { fontSize: 24, fontWeight: "800", color: theme.colors.text, textAlign: "center", marginTop: 6 },
  copy: { fontSize: 14, color: theme.colors.textTertiary, lineHeight: 20, marginBottom: 8, marginTop: 8, textAlign: "center" },
  error: { color: theme.colors.error, fontSize: 13, marginBottom: 4 },
});
