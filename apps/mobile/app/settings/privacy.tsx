import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Shield,
  Download,
  Trash2,
  Eye,
  Lock,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";
import { hapticWarning } from "@/lib/haptics";

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const handleExportData = async () => {
    Alert.alert(
      t("settings.export"),
      t("settings.export_description"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.continue"),
          onPress: () => {
            router.push("/settings/export" as any);
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    hapticWarning();
    Alert.alert(
      t("settings.deleteAccount"),
      t("settings.delete_description"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.continue"),
          style: "destructive",
          onPress: () => {
            router.push("/settings/delete-account" as any);
          },
        },
      ]
    );
  };

  const infoItems = [
    {
      icon: Eye,
      title: t("settings.privacy_title"),
      description: t("settings.privacy_description"),
    },
    {
      icon: Lock,
      title: t("settings.security"),
      description: t("settings.twoFactor_enabledDescription"),
    },
    {
      icon: Shield,
      title: t("settings.privacy"),
      description: t("settings.privacy_doNotSell_description"),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.privacy")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Info Cards */}
        {infoItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} variant="default" style={{ marginBottom: 12 }}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Icon size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle}>{item.title}</Text>
                  <Text style={styles.infoDesc}>{item.description}</Text>
                </View>
              </View>
            </Card>
          );
        })}

        {/* Actions */}
        <Text style={styles.sectionTitle}>{t("common.more")}</Text>

        <TouchableOpacity style={styles.actionBtn} onPress={handleExportData} activeOpacity={0.6}>
          <Download size={18} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>{t("settings.export")}</Text>
            <Text style={styles.actionDesc}>{t("settings.export_description")}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount} activeOpacity={0.6}>
          <Trash2 size={18} color={theme.colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dangerLabel}>{t("settings.deleteAccount")}</Text>
            <Text style={styles.dangerDesc}>{t("settings.delete_description")}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  infoRow: { flexDirection: "row", gap: 14 },
  infoIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.colors.primaryFaded, alignItems: "center", justifyContent: "center",
  },
  infoTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  infoDesc: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 4, lineHeight: 18 },
  sectionTitle: {
    fontSize: 13, fontWeight: "600", color: theme.colors.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 24, marginBottom: 12, marginLeft: 4,
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10,
  },
  actionLabel: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
  actionDesc: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  dangerBtn: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
    backgroundColor: theme.colors.errorFaded, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.2)", marginTop: 8,
  },
  dangerLabel: { fontSize: 15, fontWeight: "600", color: theme.colors.error },
  dangerDesc: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
});
