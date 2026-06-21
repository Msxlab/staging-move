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
import { ArrowLeft, Check, Mail, Smartphone } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { registerForPushNotifications } from "@/lib/push";
import { HeroCard, SectionHeader } from "@/components/move";

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
    let pushPermissionDenied = false;
    if (wantsPush) {
      // Toggling a push category ON is an explicit opt-in - bypass the
      // soft-prompt gate so the OS permission prompt actually fires (otherwise,
      // on a fresh install the gate silently no-ops and nothing is delivered).
      const registered = await registerForPushNotifications({ requireSoftPrompt: false });
      pushPermissionDenied = !registered;
    }

    // Persist the preferences REGARDLESS of the push-permission outcome. A
    // denied/undetermined OS permission must not silently discard the user's
    // edits (including unrelated email toggles) - we save what they chose and
    // warn separately that push needs the OS permission before it can deliver.
    const res = await api.put<any>("/api/notifications/preferences", prefs);
    setSaving(false);
    if (res.error) {
      hapticError();
      Alert.alert(t("common.retry"), res.error);
      return;
    }
    if (res.data?.preferences) {
      setPrefs({ ...DEFAULT_PREFS, ...res.data.preferences });
    }
    if (pushPermissionDenied) {
      hapticError();
      Alert.alert(
        t("notifications.title"),
        t("notifications.pushPermissionDenied", {
          defaultValue: "Your preferences were saved. To receive push alerts, turn on notifications for LocateFlow in your device Settings.",
        }),
      );
      return;
    }
    hapticSuccess();
    router.back();
  };

  if (pageLoading) return <LoadingScreen />;

  const sections = [
    {
      title: t("notifications.section_email"),
      hint: t("notifications.section_email_hint"),
      Icon: Mail,
      tone: theme.colors.sky,
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
      Icon: Smartphone,
      tone: theme.colors.emerald,
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
  const enabledTotal = Object.values(prefs).filter(Boolean).length;
  const totalPrefs = Object.keys(DEFAULT_PREFS).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("notifications.title")}</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Move hero — alert-command kicker, title, and a tri-stat strip
            mirroring enabled / email / push counts. */}
        <HeroCard style={styles.hero} padding={16} radius={20}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Smartphone size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>ALERT COMMAND</Text>
              <Text style={styles.heroTitle} numberOfLines={1}>{t("notifications.title")}</Text>
              <Text style={styles.heroSub}>{enabledTotal}/{totalPrefs} preferences enabled</Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{enabledTotal}</Text>
              <Text style={styles.heroStatLabel}>enabled</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{sections[0].items.filter((item) => prefs[item.key]).length}</Text>
              <Text style={styles.heroStatLabel}>email</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{sections[1].items.filter((item) => prefs[item.key]).length}</Text>
              <Text style={styles.heroStatLabel}>push</Text>
            </View>
          </View>
        </HeroCard>

        {sections.map((section) => {
          const SectionIcon = section.Icon;
          const enabledCount = section.items.filter((item) => prefs[item.key]).length;
          return (
          <View key={section.title} style={styles.section}>
            {/* Move grouped-card header — tonal icon chip + section header +
                on-count. */}
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIcon, { backgroundColor: section.tone.bg, borderColor: section.tone.border }]}>
                <SectionIcon size={15} color={section.tone.text} />
              </View>
              <SectionHeader label={section.title} style={styles.sectionHeaderLabel} />
              <View style={{ flex: 1 }} />
              <Text style={styles.sectionCount}>
                {enabledCount}/{section.items.length}
              </Text>
            </View>
            {section.hint ? <Text style={styles.sectionHint}>{section.hint}</Text> : null}
            <View style={styles.card}>
              {section.items.map((item, i) => (
                <View
                  key={item.key}
                  style={[styles.row, i < section.items.length - 1 && styles.rowBorder]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowDesc}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={prefs[item.key]}
                    onValueChange={() => toggle(item.key)}
                    trackColor={{ false: theme.colors.track, true: theme.colors.primary }}
                    thumbColor={theme.colors.onAccent}
                  />
                </View>
              ))}
            </View>
          </View>
          );
        })}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.onAccent} />
          ) : (
            <>
              <Check size={18} color={theme.colors.onAccent} />
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
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: {
    fontSize: 19,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
    letterSpacing: 0,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: {
    marginBottom: 4,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 10,
    fontFamily: fonts.sansBold,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.colors.primary,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
    marginTop: 3,
    letterSpacing: 0,
  },
  heroSub: {
    fontSize: 12,
    fontFamily: fonts.sans,
    color: theme.colors.dim,
    marginTop: 3,
  },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 14 },
  heroStat: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    padding: 10,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  heroStatValue: {
    fontSize: 17,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
  },
  heroStatLabel: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    letterSpacing: 1,
    color: theme.colors.faint,
    textTransform: "uppercase",
    marginTop: 3,
  },
  section: { marginTop: 22 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8, marginLeft: 2 },
  sectionIcon: {
    width: 28, height: 28, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  sectionHeaderLabel: { marginBottom: 0 },
  sectionCount: {
    fontSize: 11,
    fontFamily: fonts.monoMedium,
    color: theme.colors.primary,
    fontVariant: ["tabular-nums"],
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: fonts.sans,
    color: theme.colors.dim,
    lineHeight: 16,
    marginLeft: 2,
    marginBottom: 10,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: {
    fontSize: 15,
    fontFamily: fonts.sansMedium,
    color: theme.colors.text,
  },
  rowDesc: {
    fontSize: 12,
    fontFamily: fonts.sans,
    color: theme.colors.faint,
    marginTop: 2,
  },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    paddingVertical: 16, marginTop: 28,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: fonts.sansBold,
    color: theme.colors.onAccent,
  },
});
