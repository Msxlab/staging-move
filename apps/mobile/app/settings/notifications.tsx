import React, { useEffect, useState, useMemo } from "react";
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
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { registerForPushNotifications } from "@/lib/push";

interface Prefs {
  emailTaskReminders: boolean;
  emailBillReminders: boolean;
  emailBillOverdue: boolean;
  emailContractExpiring: boolean;
  emailWeeklyDigest: boolean;
  emailMoveAlerts: boolean;
  pushTaskReminders: boolean;
  pushBillReminders: boolean;
  pushMoveAlerts: boolean;
}

const DEFAULT_PREFS: Prefs = {
  emailTaskReminders: true,
  emailBillReminders: true,
  emailBillOverdue: true,
  emailContractExpiring: true,
  emailWeeklyDigest: false,
  emailMoveAlerts: true,
  pushTaskReminders: true,
  pushBillReminders: true,
  pushMoveAlerts: true,
};

export default function NotificationSettingsScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
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
    const wantsPush = prefs.pushTaskReminders || prefs.pushBillReminders || prefs.pushMoveAlerts;
    if (wantsPush) {
      // Toggling a push category ON is an explicit opt-in — bypass the
      // soft-prompt gate so the OS permission prompt actually fires (otherwise,
      // on a fresh install the gate silently no-ops and nothing is delivered).
      const registered = await registerForPushNotifications({ requireSoftPrompt: false });
      if (!registered) {
        setSaving(false);
        hapticError();
        // Failure here is a denied/undetermined OS permission, not a network error.
        Alert.alert(
          t("notifications.title"),
          t("notifications.pushPermissionDenied", {
            defaultValue: "Turn on notifications for LocateFlow in your device Settings to receive push alerts.",
          }),
        );
        return;
      }
    }
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
      title: t("notifications.section_email"),
      hint: t("notifications.section_email_hint"),
      items: [
        {
          key: "emailTaskReminders" as keyof Prefs,
          label: t("notifications.email_taskReminders_label"),
          desc: t("notifications.email_taskReminders_desc"),
        },
        {
          key: "emailBillReminders" as keyof Prefs,
          label: t("notifications.email_billReminders_label", { defaultValue: "Bill reminders" }),
          desc: t("notifications.email_billReminders_desc", { defaultValue: "Upcoming bill due dates." }),
        },
        {
          key: "emailBillOverdue" as keyof Prefs,
          label: t("notifications.email_billOverdue_label", { defaultValue: "Overdue bills" }),
          desc: t("notifications.email_billOverdue_desc", { defaultValue: "When a tracked bill becomes overdue." }),
        },
        {
          key: "emailContractExpiring" as keyof Prefs,
          label: t("notifications.email_contractExpiring_label", { defaultValue: "Contract expiry" }),
          desc: t("notifications.email_contractExpiring_desc", { defaultValue: "When a contract or auto-renewal is approaching." }),
        },
        {
          key: "emailWeeklyDigest" as keyof Prefs,
          label: t("notifications.email_weeklyDigest_label"),
          desc: t("notifications.email_weeklyDigest_desc"),
        },
        {
          key: "emailMoveAlerts" as keyof Prefs,
          label: t("notifications.email_moveAlerts_label"),
          desc: t("notifications.email_moveAlerts_desc"),
        },
      ],
    },
    {
      title: t("notifications.section_push"),
      hint: t("notifications.section_push_hint"),
      items: [
        {
          key: "pushTaskReminders" as keyof Prefs,
          label: t("notifications.push_taskReminders_label"),
          desc: t("notifications.push_taskReminders_desc"),
        },
        {
          key: "pushBillReminders" as keyof Prefs,
          label: t("notifications.push_billReminders_label", { defaultValue: "Bill reminders" }),
          desc: t("notifications.push_billReminders_desc", { defaultValue: "Upcoming bill due dates." }),
        },
        {
          key: "pushMoveAlerts" as keyof Prefs,
          label: t("notifications.push_moveAlerts_label"),
          desc: t("notifications.push_moveAlerts_desc"),
        },
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
            {section.hint ? <Text style={styles.sectionHint}>{section.hint}</Text> : null}
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

const makeStyles = (theme: Theme) => StyleSheet.create({
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
  sectionHint: {
    fontSize: 12, color: theme.colors.textMuted, lineHeight: 16,
    marginLeft: 4, marginBottom: 8,
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
