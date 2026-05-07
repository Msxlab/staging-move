import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2, AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { hapticWarning, hapticSuccess, hapticError } from "@/lib/haptics";
import { Input } from "@/components/ui/Input";
import { unregisterPushNotifications } from "@/lib/push";
import { clearSensitiveLocalState } from "@/lib/local-cleanup";

export default function DeleteAccountScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [confirmText, setConfirmText] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasPasswordLogin, setHasPasswordLogin] = useState<boolean | null>(null);
  const [passwordSetupBusy, setPasswordSetupBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The confirmation phrase has to match ONE of the localized strings so
  // Spanish users can type ELIMINAR and English users can type DELETE.
  const confirmPhrases = [t("settings.delete_confirmInput"), "DELETE"];

  useEffect(() => {
    api.get<any>("/api/auth/security")
      .then((res) => setHasPasswordLogin(res.data?.account?.hasPasswordLogin === true))
      .catch(() => setHasPasswordLogin(null));
  }, []);

  const requestSetPasswordEmail = async () => {
    setPasswordSetupBusy(true);
    const res = await api.post<any>("/api/auth/security", { action: "request_set_password" });
    setPasswordSetupBusy(false);
    if (res.error) {
      hapticError();
      Alert.alert("Password", res.error);
      return;
    }
    hapticSuccess();
    Alert.alert("Password", "We sent a secure password setup link to your email.");
  };

  const handleDelete = async () => {
    if (hasPasswordLogin === false) {
      Alert.alert("Password required", "Use the emailed setup link to set a password before deleting this account.");
      return;
    }
    if (!confirmPhrases.includes(confirmText) || !confirmPassword) {
      Alert.alert(t("settings.delete_confirmTitle"), t("settings.delete_confirmDescription"));
      return;
    }

    hapticWarning();
    setDeleting(true);
    const res = await api.post("/api/account/delete", { confirmPassword });
    setDeleting(false);

    if (res.error) {
      hapticError();
      Alert.alert(t("common.retry"), res.error || t("toast.networkError"));
      return;
    }

    hapticSuccess();
    await unregisterPushNotifications().catch(() => {});
    await clearSession();
    await clearSensitiveLocalState(queryClient);
    router.replace("/(auth)/sign-in");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to privacy settings"
        >
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.deleteAccount")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.warningCard}>
          <View style={styles.warningIcon}>
            <AlertTriangle size={18} color={theme.colors.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>{t("settings.delete_confirmTitle")}</Text>
            <Text style={styles.warningText}>
              {t("settings.delete_description")}
            </Text>
          </View>
        </View>

        {hasPasswordLogin === false && (
          <View style={styles.passwordRequiredCard}>
            <Text style={styles.warningTitle}>Password required</Text>
            <Text style={styles.warningText}>
              This account uses Google or Apple sign-in. Before deletion, set a password from a secure email link so we can confirm it is you.
            </Text>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={requestSetPasswordEmail}
              disabled={passwordSetupBusy}
            >
              {passwordSetupBusy ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <Text style={styles.secondaryBtnText}>Email setup link</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t("common.confirm")}</Text>
        <Text style={styles.bodyText}>
          {t("settings.delete_confirmDescription")} <Text style={styles.strong}>{t("settings.delete_confirmInput")}</Text>
        </Text>

        <Input
          placeholder={t("settings.delete_confirmInput")}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Delete account confirmation text"
          accessibilityHint='Type DELETE exactly to enable permanent account deletion'
        />

        <Input
          containerStyle={{ marginTop: 12 }}
          placeholder={t("auth.password")}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          isPassword
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Current password"
          accessibilityHint="Confirms your identity before account deletion"
        />

        <TouchableOpacity
          style={[styles.deleteBtn, (!confirmPhrases.includes(confirmText) || !confirmPassword || deleting || hasPasswordLogin === false) && { opacity: 0.6 }]}
          onPress={handleDelete}
          disabled={!confirmPhrases.includes(confirmText) || !confirmPassword || deleting || hasPasswordLogin === false}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Permanently delete account"
          accessibilityHint="Deletes your account and all associated data"
          accessibilityState={{ disabled: !confirmPhrases.includes(confirmText) || !confirmPassword || deleting || hasPasswordLogin === false }}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Trash2 size={18} color="#fff" />
              <Text style={styles.deleteBtnText}>{t("settings.delete_button")}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  warningCard: { flexDirection: "row", gap: 12, padding: 16, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: "rgba(240, 140, 142, 0.20)", backgroundColor: theme.colors.errorFaded, marginBottom: 24 },
  passwordRequiredCard: { gap: 10, padding: 16, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: "rgba(242, 196, 108,0.25)", backgroundColor: theme.colors.warningFaded, marginBottom: 20 },
  secondaryBtn: { alignItems: "center", justifyContent: "center", borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 12, backgroundColor: theme.colors.card },
  secondaryBtnText: { fontSize: 14, fontWeight: "700", color: theme.colors.primary },
  warningIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(240, 140, 142, 0.12)" },
  warningTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.error },
  warningText: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 4, lineHeight: 18 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: theme.colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginLeft: 4 },
  bodyText: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  strong: { fontWeight: "800", color: theme.colors.error },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.error, borderRadius: theme.radius.lg, paddingVertical: 16, marginTop: 24 },
  deleteBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
