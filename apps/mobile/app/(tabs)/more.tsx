import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  User,
  CreditCard,
  DollarSign,
  Search,
  HelpCircle,
  ChevronRight,
  Shield,
  Bell,
  LogOut,
  Ticket,
  Building2,
  FileText,
  Zap,
  Activity,
  Users,
  Download,
  CalendarClock,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import { useAuthStore } from "@/lib/auth-store";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Avatar } from "@/components/ui/Avatar";
import { hapticLight, hapticWarning } from "@/lib/haptics";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { ThemeSelector } from "@/components/ui/ThemeSelector";
import { api } from "@/lib/api";
import { unregisterPushNotifications } from "@/lib/push";
import { clearSensitiveLocalState } from "@/lib/local-cleanup";

/** Tonal tile colors for a row's icon chip (Aurora `.pf-row .ti` idiom). */
interface RowTone {
  bg: string;
  border: string;
  text: string;
}

interface MenuItem {
  icon: any;
  label: string;
  route?: Href;
  tone?: RowTone;
  onPress?: () => void;
}

export default function MoreScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const planTier = useAuthStore((s) => s.planTier);
  const clearSession = useAuthStore((s) => s.clearSession);

  const initials =
    ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() ||
    "U";

  // Plan pill label — planTier is FAMILY | PRO | INDIVIDUAL | FREE | FREE_TRIAL
  // | null; FREE* and null (not-yet-resolved entitlement) render as Free, matching the
  // dashboard's resolution default. The pill itself tints via
  // theme.colors.primary, so Family/Pro plan accents flow automatically.
  const planLabel =
    planTier === "FAMILY"
      ? t("more.planFamily", { defaultValue: "Family" })
      : planTier === "PRO"
        ? t("more.planPro", { defaultValue: "Pro" })
        : planTier === "INDIVIDUAL"
          ? t("more.planIndividual", { defaultValue: "Individual" })
          : t("more.planFree", { defaultValue: "Free" });

  const handleSignOut = () => {
    hapticWarning();
    Alert.alert(t("common.signOut"), t("common.signOut") + "?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.signOut"),
        style: "destructive",
        onPress: async () => {
          await unregisterPushNotifications().catch(() => {});
          await api.post("/api/auth/logout").catch(() => {});
          await clearSession();
          await clearSensitiveLocalState(queryClient);
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  // Tonal tiles per row (Aurora idiom: every menu row gets an icon chip in a
  // tonal tile). All values come from theme tone objects — plan-accent rows
  // (Profile) use the primary set so Family/Pro tints flow through.
  const tonePrimary: RowTone = {
    bg: theme.colors.primaryFaded,
    border: theme.colors.primary + "33",
    text: theme.colors.primary,
  };
  const toneCool = theme.colors.rose; // Aurora cool (info)
  const toneSage = theme.colors.emerald; // sage / money
  const toneHoney = theme.colors.amber; // honey / foil
  const toneSlate = theme.colors.sky; // muted slate

  // Regrouped into four task-oriented sections (was a flat 16-row junk drawer).
  // Every row reuses an EXISTING route — no new screens — except "Search" which
  // now points at the real universal search screen instead of misleadingly
  // routing to /providers.
  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: t("more.sectionTools", { defaultValue: "Tools" }),
      items: [
        // Typed-routes generation is stale for the newly-added screen; the file
        // exists at app/search.tsx so the route is valid.
        { icon: Search, label: t("search.title"), route: "/search" as Href, tone: toneCool },
        { icon: DollarSign, label: t("budget.title"), route: "/budget", tone: toneSage },
        { icon: Building2, label: t("providers.title"), route: "/providers", tone: toneHoney },
        { icon: Building2, label: t("customProviders.title"), route: "/custom-providers", tone: toneSlate },
        { icon: CalendarClock, label: t("reminders.title", { defaultValue: "Reminders" }), route: "/reminders" as Href, tone: toneCool },
      ],
    },
    {
      title: t("more.sectionAccount", { defaultValue: "Account" }),
      items: [
        { icon: User, label: t("settings.profile"), route: "/settings/profile", tone: tonePrimary },
        { icon: CreditCard, label: t("settings.subscription"), route: "/settings/subscription", tone: toneHoney },
        // Workspace + Export were only reachable via a second, redundant
        // "Settings" screen (the confusing "settings inside settings"). Surface
        // them here directly and drop that duplicate menu entry.
        { icon: Users, label: t("settings.workspace", { defaultValue: "Workspace" }), route: "/settings/workspace" as Href, tone: toneSage },
        { icon: Zap, label: t("connections.title", "Connections"), route: "/settings/connections", tone: toneCool },
        // Distinct from the notifications FEED in the Support group below — this
        // is the preferences screen, so label it as settings to avoid two
        // identical "Notifications" rows.
        { icon: Bell, label: t("settings.notificationSettings", { defaultValue: "Notification settings" }), route: "/settings/notifications", tone: toneSlate },
      ],
    },
    {
      title: t("more.sectionPrivacy", { defaultValue: "Privacy & data" }),
      items: [
        { icon: Shield, label: t("settings.privacy"), route: "/settings/privacy", tone: toneCool },
        { icon: Download, label: t("settings.export"), route: "/settings/export", tone: toneSage },
        // Typed-routes generation is stale for this recently-added screen; the
        // file exists at app/settings/address-changes.tsx so the route is valid.
        { icon: Activity, label: t("addressChanges.title", "Address changes"), route: "/settings/address-changes" as Href, tone: toneHoney },
      ],
    },
    {
      title: t("more.sectionSupport", { defaultValue: "Support" }),
      items: [
        { icon: HelpCircle, label: t("settings.help"), route: "/help", tone: toneCool },
        { icon: Ticket, label: t("settings.support"), route: "/help/tickets", tone: toneHoney },
        // The notifications FEED (distinct from "Notification settings" above).
        { icon: Bell, label: t("settings.notifications"), route: "/notifications", tone: toneSlate },
        { icon: FileText, label: t("blog.title"), route: "/blog", tone: toneSage },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("tabs.more")}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card — Aurora `.sv-profilecard`: avatar disc + name/email +
            mono-uppercase plan pill tinted by the plan accent. */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => router.push("/settings/profile")}
          activeOpacity={0.7}
        >
          <Avatar initials={initials} size={50} />
          <View style={styles.profileBody}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.firstName || t("common.unknown", { defaultValue: "User" })} {user?.lastName || ""}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {user?.email || ""}
            </Text>
          </View>
          <View style={styles.planPill}>
            <Text style={styles.planPillText}>{planLabel.toUpperCase()}</Text>
          </View>
          <ChevronRight size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        {/* Menu Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, i) => {
                const Icon = item.icon;
                const tone = item.tone ?? toneCool;
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[
                      styles.menuItem,
                      i < section.items.length - 1 && styles.menuItemBorder,
                    ]}
                    onPress={() => {
                      hapticLight();
                      if (item.onPress) item.onPress();
                      else if (item.route) router.push(item.route);
                    }}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[
                        styles.menuIconBox,
                        { backgroundColor: tone.bg, borderColor: tone.border },
                      ]}
                    >
                      <Icon size={17} color={tone.text} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <ChevronRight size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Appearance (theme) — was only on the now-removed second Settings
            screen; surfaced here so the More tab is the single settings hub. */}
        <View style={{ marginBottom: 16 }}>
          <ThemeSelector />
        </View>

        {/* Language selector — mirrored to User.preferredLocale via
            /api/user/locale so the choice follows the user. */}
        <View style={{ marginBottom: 16 }}>
          <LanguageSelector />
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={18} color={theme.colors.error} />
          <Text style={styles.signOutText}>{t("common.signOut")}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>LocateFlow v{Constants.expoConfig?.version ?? "0.0.0"}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 15,
    marginBottom: 24,
    ...theme.shadow.sm,
  },
  profileBody: { flex: 1, minWidth: 0 },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  profileEmail: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  planPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.primary + "42",
    flexShrink: 0,
  },
  planPillText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    color: theme.colors.primary,
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 9,
    marginLeft: 2,
  },
  sectionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.errorFaded,
    borderWidth: 1,
    // Aurora coral (#F08C8E) at 20% — matches `theme.colors.error`.
    borderColor: "rgba(240, 140, 142, 0.20)",
    marginTop: 8,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.error,
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 24,
  },
});
