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
import { theme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";
import { hapticWarning } from "@/lib/haptics";

export default function PrivacySettingsScreen() {
  const router = useRouter();

  const handleExportData = async () => {
    Alert.alert(
      "Export Data",
      "Choose the data and format you want to export on the next screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
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
      "Delete Account",
      "This will take you to a final confirmation screen before anything is deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
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
      title: "Data We Collect",
      description: "We collect your addresses, services, moving plans, and profile information to provide the LocateFlow service.",
    },
    {
      icon: Lock,
      title: "Data Security",
      description: "Your data is encrypted in transit and at rest. We use industry-standard security practices.",
    },
    {
      icon: Shield,
      title: "Your Rights",
      description: "You can export or delete your data at any time. We never sell your personal information.",
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy & Data</Text>
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
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity style={styles.actionBtn} onPress={handleExportData} activeOpacity={0.6}>
          <Download size={18} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Export My Data</Text>
            <Text style={styles.actionDesc}>Download all your data as a file</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount} activeOpacity={0.6}>
          <Trash2 size={18} color={theme.colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dangerLabel}>Delete My Account</Text>
            <Text style={styles.dangerDesc}>Permanently remove all your data</Text>
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
