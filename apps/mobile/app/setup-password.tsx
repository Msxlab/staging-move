import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Check, KeyRound, ShieldCheck, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { api, API_URL } from "@/lib/api";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useAuthStore } from "@/lib/auth-store";
import { useAppTheme, type Theme } from "@/lib/theme";
import { getPasswordRuleResults } from "@/lib/password-policy";

export default function SetupPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const patchUser = useAuthStore((s) => s.patchUser);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ruleResults = useMemo(
    () => getPasswordRuleResults(password),
    [password],
  );
  const policyMet = ruleResults.every((rule) => rule.passed);
  const canSubmit = !saving && policyMet && password === confirmPassword;

  const savePassword = async () => {
    setError("");
    if (!policyMet) {
      setError(t("auth.setupPasswordHelper"));
      hapticError();
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.setupPasswordMismatch"));
      hapticError();
      return;
    }

    setSaving(true);
    try {
      const res = await api.post<any>("/api/auth/security", {
        action: "set_password",
        newPassword: password,
      });

      if (res.error) {
        setError(res.error || t("auth.setupPasswordFailed"));
        hapticError();
        return;
      }

      // Optimistically clear the gate locally so the AuthGuard does not bounce
      // us straight back to this screen while /api/auth/me is still in flight.
      // refreshUser then reconciles with the server; if it fails (timeout/5xx)
      // the local patch keeps the user moving forward instead of looping.
      patchUser({ hasPasswordLogin: true, needsPasswordSetup: false });
      hapticSuccess();
      await refreshUser(API_URL.replace(/\/api\/?$/, "")).catch(() => {});
      router.replace("/onboarding");
    } catch {
      setError(t("auth.setupPasswordFailed"));
      hapticError();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LogoBrand />
          <View style={styles.iconWrap}>
            <ShieldCheck size={26} color={theme.colors.success} />
          </View>
          <Text style={styles.title}>{t("auth.setupPasswordTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.setupPasswordSubtitle")}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Input
            label={t("auth.newPassword")}
            placeholder={t("auth.newPasswordPlaceholder")}
            value={password}
            onChangeText={setPassword}
            isPassword
            autoComplete="password-new"
            leftIcon={<KeyRound size={16} color={theme.colors.textMuted} />}
          />
          <Input
            label={t("auth.confirmPassword")}
            placeholder={t("auth.confirmPasswordPlaceholder")}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            autoComplete="password-new"
          />

          <View style={styles.rulesBox}>
            {ruleResults.map((rule) => {
              const active = password.length > 0;
              const color = !active
                ? theme.colors.textTertiary
                : rule.passed
                ? theme.colors.success
                : theme.colors.textMuted;
              return (
                <View key={rule.key} style={styles.ruleRow}>
                  {rule.passed && active ? (
                    <Check size={14} color={theme.colors.success} />
                  ) : (
                    <X size={14} color={active ? theme.colors.textMuted : theme.colors.textTertiary} />
                  )}
                  <Text style={[styles.ruleText, { color }]}>{t(rule.labelKey)}</Text>
                </View>
              );
            })}
          </View>

          <Button
            title={saving ? t("common.loading") : t("auth.setupPasswordCta")}
            onPress={savePassword}
            loading={saving}
            disabled={!canSubmit}
            fullWidth
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: theme.colors.successFaded,
    borderWidth: 1,
    borderColor: "rgba(135, 221, 192, 0.28)",
    marginTop: 18,
  },
  title: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: 12,
  },
  error: {
    color: theme.colors.error,
    backgroundColor: theme.colors.errorFaded,
    borderWidth: 1,
    borderColor: "rgba(240, 140, 142, 0.28)",
    borderRadius: theme.radius.lg,
    padding: 12,
    fontSize: 13,
    lineHeight: 19,
  },
  rulesBox: {
    gap: 6,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 12,
  },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleText: { fontSize: 12, lineHeight: 18 },
});
