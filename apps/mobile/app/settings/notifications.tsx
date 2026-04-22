import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";

interface Prefs {
  emailTaskReminders: boolean;
  emailWeeklyDigest: boolean;
  emailMoveAlerts: boolean;
  pushTaskReminders: boolean;
  pushMoveAlerts: boolean;
  pushStreakReminders: boolean;
}

const DEFAULT_PREFS: Prefs = {
  emailTaskReminders: true,
  emailWeeklyDigest: false,
  emailMoveAlerts: true,
  pushTaskReminders: true,
  pushMoveAlerts: true,
  pushStreakReminders: false,
};

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    (async () => {
      const res = await api.get<any>("/api/notifications/preferences");
      if (res.data?.preferences) {
        setPrefs({ ...DEFAULT_PREFS, ...res.data.preferences });
      }
      setPageLoading(false);
    })();
  }, []);

  const toggle = (key: keyof Prefs) =>
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    const res = await api.put<any>("/api/notifications/preferences", prefs);
    setSaving(false);
    if (res.error) {
      hapticError();
      Alert.alert(t("common.retry"), res.error);
    } else {
      if (res.data?.preferences) {
        setPrefs({ ...DEFAULT_PREFS, ...res.data.preferences });
      }
      hapticSuccess();
      router.back();
    }
  };

  if (pageLoading) return <LoadingScreen />;

  const sections = [
    {
      title: t("notifications.type_billReminder"),
      items: [
        { key: "emailTaskReminders" as keyof Prefs, label: t("notifications.type_billReminder"), desc: "" },
        { key: "emailWeeklyDigest" as keyof Prefs, label: t("notifications.type_system"), desc: "" },
        { key: "emailMoveAlerts" as keyof Prefs, label: t("notifications.type_moveReminder"), desc: "" },
      ],
    },
    {
      title: t("notifications.title"),
      items: [
        { key: "pushTaskReminders" as keyof Prefs, label: t("notifications.type_billReminder"), desc: "" },
        { key: "pushMoveAlerts" as keyof Prefs, label: t("notifications.type_moveReminder"), desc: "" },
        { key: "pushStreakReminders" as keyof Prefs, label: t("notifications.type_contractEnding"), desc: "" },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("notifications.title")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, i) => (
                <View
                  key={item.key}
                  style={[styles.row, i < section.items.length - 1 && styles.rowBorder]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowDesc}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={prefs[item.key]}
                    onValueChange={() => toggle(item.key)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check size={18} color="#fff" />
              <Text style={styles.saveBtnText}>{t("common.save")}</Text>
            </>
          )}
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
  section: { marginTop: 20 },
  sectionTitle: {
    fontSize: 13, fontWeight: "600", color: theme.colors.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 4,
  },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { fontSize: 15, fontWeight: "500", color: theme.colors.text },
  rowDesc: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    paddingVertical: 16, marginTop: 28, ...theme.shadow.glow,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
