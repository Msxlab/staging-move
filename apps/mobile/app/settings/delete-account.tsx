import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Trash2, AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { hapticWarning, hapticSuccess, hapticError } from "@/lib/haptics";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [confirmText, setConfirmText] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  // The confirmation phrase has to match ONE of the localized strings so
  // Spanish users can type ELIMINAR and English users can type DELETE.
  const confirmPhrases = [t("settings.delete_confirmInput"), "DELETE"];

  const handleDelete = async () => {
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
    await clearSession();
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

        <Text style={styles.sectionTitle}>{t("common.confirm")}</Text>
        <Text style={styles.bodyText}>
          {t("settings.delete_confirmDescription")} <Text style={styles.strong}>{t("settings.delete_confirmInput")}</Text>
        </Text>

        <TextInput
          style={styles.input}
          placeholder={t("settings.delete_confirmInput")}
          placeholderTextColor={theme.colors.textMuted}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Delete account confirmation text"
          accessibilityHint='Type DELETE exactly to enable permanent account deletion'
        />

        <TextInput
          style={[styles.input, { marginTop: 12 }]}
          placeholder={t("auth.password")}
          placeholderTextColor={theme.colors.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Current password"
          accessibilityHint="Confirms your identity before account deletion"
        />

        <TouchableOpacity
          style={[styles.deleteBtn, (!confirmPhrases.includes(confirmText) || !confirmPassword || deleting) && { opacity: 0.6 }]}
          onPress={handleDelete}
          disabled={!confirmPhrases.includes(confirmText) || !confirmPassword || deleting}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Permanently delete account"
          accessibilityHint="Deletes your account and all associated data"
          accessibilityState={{ disabled: !confirmPhrases.includes(confirmText) || !confirmPassword || deleting }}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  warningCard: { flexDirection: "row", gap: 12, padding: 16, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)", backgroundColor: theme.colors.errorFaded, marginBottom: 24 },
  warningIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(239,68,68,0.12)" },
  warningTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.error },
  warningText: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 4, lineHeight: 18 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: theme.colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginLeft: 4 },
  bodyText: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  strong: { fontWeight: "800", color: theme.colors.error },
  input: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.error, borderRadius: theme.radius.lg, paddingVertical: 16, marginTop: 24 },
  deleteBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
