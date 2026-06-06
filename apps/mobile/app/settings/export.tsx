import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Download,
  FileText,
  Table,
  Database,
  MapPin,
  Zap,
  DollarSign,
  Truck,
  Bell,
  Ticket,
  Crown,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { Input } from "@/components/ui/Input";
import * as FileSystem from "expo-file-system/legacy";

function buildExportFileName(type: string, format: string) {
  return `locateflow-${type}-export.${format.toLowerCase()}`;
}

export default function ExportScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const [exporting, setExporting] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  // Re-auth method available to this account: password, or (for OAuth-only
  // accounts) an authenticator/backup code. Without this, OAuth-only users were
  // blocked from exporting even though the server accepts an MFA/backup code.
  const [security, setSecurity] = useState<{ hasPasswordLogin: boolean; mfaEnabled: boolean } | null>(null);
  useEffect(() => {
    (async () => {
      const res = await api.get<any>("/api/auth/security");
      if (res.data?.account) {
        setSecurity({
          hasPasswordLogin: res.data.account.hasPasswordLogin === true,
          mfaEnabled: res.data.account.mfaEnabled === true,
        });
      }
    })();
  }, []);

  // Default to password until we know; switch to code only for OAuth-only + MFA.
  const usePasswordStepUp = security ? security.hasPasswordLogin : true;
  const useCodeStepUp = security ? !security.hasPasswordLogin && security.mfaEnabled : false;
  const noStepUpMethod = security ? !security.hasPasswordLogin && !security.mfaEnabled : false;

  // Export option labels resolve at render — users switching language
  // mid-session see the new titles without a reload.
  const EXPORT_OPTIONS = [
    { type: "addresses", title: t("addresses.title"), desc: "", icon: MapPin, formats: ["CSV", "JSON"] },
    { type: "services", title: t("services.title"), desc: "", icon: Zap, formats: ["CSV", "JSON"] },
    { type: "budget", title: t("budget.title"), desc: "", icon: DollarSign, formats: ["CSV", "JSON"] },
    { type: "moving", title: t("moving.title"), desc: "", icon: Truck, formats: ["JSON"] },
    { type: "support", title: t("settings.support"), desc: "", icon: Ticket, formats: ["JSON"] },
    { type: "notifications", title: t("notifications.title"), desc: "", icon: Bell, formats: ["JSON"] },
    { type: "subscription", title: t("settings.subscription"), desc: "", icon: Crown, formats: ["JSON"] },
    { type: "tax", title: t("settings.exportTaxTitle", { defaultValue: "Tax & Property (Pro)" }), desc: "", icon: FileText, formats: ["CSV", "JSON"] },
    { type: "full", title: t("settings.export"), desc: "", icon: Database, formats: ["JSON"] },
  ];

  const handleExport = async (type: string, format: string) => {
    setExporting(`${type}-${format}`);
    try {
      // Send the step-up field that matches the account's available method: a
      // password, or (OAuth-only + MFA) a 6-digit TOTP / backup code.
      const stepUpField = usePasswordStepUp
        ? { confirmPassword }
        : /^\d{6}$/.test(confirmPassword.trim())
          ? { mfaCode: confirmPassword.trim() }
          : { backupCode: confirmPassword.trim() };
      const res = await api.post<any>(`/api/export`, {
        type,
        format: format.toLowerCase(),
        ...stepUpField,
      });
      if (res.error) {
        hapticError();
        if (res.code === "UPGRADE_REQUIRED") {
          // Pro-gated export (tax & property) for a non-Pro account — surface the
          // server's reason and offer a path to upgrade rather than a generic error.
          Alert.alert(
            t("settings.exportProTitle", { defaultValue: "Pro feature" }),
            res.error,
            [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("settings.upgradeToPro", { defaultValue: "Upgrade" }), onPress: () => router.push("/settings/subscription") },
            ],
          );
        } else {
          Alert.alert(t("common.retry"), res.error || t("toast.networkError"));
        }
      } else {
        hapticSuccess();
        const dataStr = typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
        const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;

        if (!baseDir) {
          throw new Error(t("settings.exportStorageUnavailable"));
        }

        const fileName = buildExportFileName(type, format);
        const fileUri = `${baseDir}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, dataStr, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        // iOS: share the file URL ALONE. Passing a `message` alongside a file
        // `url` makes iOS drop the attachment for Save-to-Files and most targets,
        // so the export "did nothing". Android RN Share cannot attach a file via
        // `url` (only `message` is honored) — that needs a native share module in
        // a future build; keep the content-uri attempt as best-effort.
        if (Platform.OS === "ios") {
          await Share.share({
            url: fileUri,
            title: t("settings.exportShareTitle", { type, format }),
          });
        } else {
          const contentUri = await FileSystem.getContentUriAsync(fileUri);
          await Share.share({
            url: contentUri,
            title: t("settings.exportShareTitle", { type, format }),
          });
        }
        // Do NOT delete here: cacheDirectory is OS-reclaimed, and deleting
        // immediately after the sheet presents can race a target still copying
        // the file.
      }
    } catch (error) {
      hapticError();
      Alert.alert(t("common.retry"), error instanceof Error ? error.message : t("settings.exportFailed"));
    } finally {
      setExporting(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.export")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          {t("settings.export_description")}
        </Text>

        <View style={styles.stepUpCard}>
          <Text style={styles.stepUpTitle}>{t("settings.export_confirmTitle", { defaultValue: "Confirm it's you" })}</Text>
          {noStepUpMethod ? (
            <Text style={styles.stepUpHint}>
              {t("settings.export_needsStepUp", { defaultValue: "Set a password or turn on two-factor authentication to export your data." })}
            </Text>
          ) : (
            <>
              <Text style={styles.stepUpHint}>
                {useCodeStepUp
                  ? t("settings.export_codeHint", { defaultValue: "Enter a code from your authenticator app (or a backup code) to export." })
                  : t("settings.export_passwordHint", { defaultValue: "Enter your password to download your data." })}
              </Text>
              <View style={{ marginTop: 10 }}>
                <Input
                  placeholder={useCodeStepUp
                    ? t("settings.export_codePlaceholder", { defaultValue: "Authenticator or backup code" })
                    : t("auth.password")}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  isPassword={usePasswordStepUp}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel={t("settings.currentPasswordA11y")}
                  accessibilityHint={t("settings.currentPasswordHint")}
                />
              </View>
            </>
          )}
        </View>

        {EXPORT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <View key={opt.type} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBox}>
                  <Icon size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{opt.title}</Text>
                  <Text style={styles.cardDesc}>{opt.desc}</Text>
                </View>
              </View>
              <View style={styles.formatRow}>
                {opt.formats.map((fmt) => {
                  const isLoading = exporting === `${opt.type}-${fmt}`;
                  return (
                    <TouchableOpacity
                      key={fmt}
                      style={styles.formatBtn}
                      onPress={() => handleExport(opt.type, fmt)}
                      disabled={!!exporting || !confirmPassword}
                      activeOpacity={0.7}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={theme.colors.primary} size="small" />
                      ) : (
                        <>
                          <Download size={14} color={theme.colors.primary} />
                          <Text style={styles.formatBtnText}>{fmt}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={styles.gdprNote}>
          <Text style={styles.gdprText}>
            {t("settings.exportPrivacyNote")}
          </Text>
        </View>
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
  subtitle: { fontSize: 14, color: theme.colors.textTertiary, lineHeight: 20, marginBottom: 20 },
  noticeBox: { marginBottom: 16, padding: 14, borderRadius: theme.radius.lg, backgroundColor: "rgba(242, 196, 108,0.08)", borderWidth: 1, borderColor: "rgba(242, 196, 108,0.2)" },
  noticeText: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 },
  stepUpCard: { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, padding: 16, marginBottom: 20 },
  stepUpTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text, marginBottom: 4 },
  stepUpHint: { fontSize: 12, color: theme.colors.textTertiary, lineHeight: 18 },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  cardIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: "rgba(127, 182, 232,0.2)", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  cardDesc: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  formatRow: { flexDirection: "row", gap: 8 },
  formatBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: "rgba(127, 182, 232,0.2)" },
  formatBtnText: { fontSize: 13, fontWeight: "600", color: theme.colors.primary },
  gdprNote: { marginTop: 12, padding: 14, borderRadius: theme.radius.lg, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: theme.colors.border },
  gdprText: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
});
