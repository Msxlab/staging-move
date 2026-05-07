import React, { useState, useMemo } from "react";
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
    { type: "full", title: t("settings.export"), desc: "", icon: Database, formats: ["JSON"] },
  ];

  const handleExport = async (type: string, format: string) => {
    setExporting(`${type}-${format}`);
    try {
      const res = await api.get<any>(`/api/export`, { type, format: format.toLowerCase() });
      if (res.error) {
        hapticError();
        Alert.alert(t("common.retry"), res.error);
      } else {
        hapticSuccess();
        const dataStr = typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
        const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;

        if (!baseDir) {
          throw new Error("Export storage is unavailable on this device.");
        }

        const fileName = buildExportFileName(type, format);
        const fileUri = `${baseDir}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, dataStr, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const shareUri = Platform.OS === "android"
          ? await FileSystem.getContentUriAsync(fileUri)
          : fileUri;

        await Share.share({
          url: shareUri,
          message: `LocateFlow ${type} export`,
          title: `LocateFlow ${type} export (${format})`,
        });
        await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
      }
    } catch (e: any) {
      hapticError();
      Alert.alert(t("common.retry"), e.message || t("toast.networkError"));
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

        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            {t("settings.privacy_description")}
          </Text>
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
                      disabled={!!exporting}
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
            Your exports use the live privacy endpoint and include your core LocateFlow records with sensitive fields masked for safety.
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
