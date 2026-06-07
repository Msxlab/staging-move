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

interface MenuItem {
  icon: any;
  label: string;
  route?: Href;
  color?: string;
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
  const clearSession = useAuthStore((s) => s.clearSession);

  const initials =
    ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() ||
    "U";

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

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: t("settings.title"),
      items: [
        { icon: User, label: t("settings.profile"), route: "/settings/profile" },
        // Distinct from the notifications FEED in the More group below — this is
        // the preferences screen, so label it as settings to avoid two identical
        // "Notifications" rows.
        { icon: Bell, label: t("settings.notificationSettings", { defaultValue: "Notification settings" }), route: "/settings/notifications" },
        { icon: CreditCard, label: t("settings.subscription"), route: "/settings/subscription" },
        { icon: Zap, label: t("connections.title", "Connections"), route: "/settings/connections" },
        // Typed-routes generation is stale for this recently-added screen; the
        // file exists at app/settings/address-changes.tsx so the route is valid.
        { icon: Activity, label: t("addressChanges.title", "Address changes"), route: "/settings/address-changes" as Href },
        { icon: Shield, label: t("settings.privacy"), route: "/settings/privacy" },
        // Workspace + Export were only reachable via a second, redundant
        // "Settings" screen (the confusing "settings inside settings"). Surface
        // them here directly and drop that duplicate menu entry.
        { icon: Users, label: t("settings.workspace", { defaultValue: "Workspace" }), route: "/settings/workspace" as Href },
        { icon: Download, label: t("settings.export"), route: "/settings/export" },
      ],
    },
    {
      title: t("tabs.more"),
      items: [
        { icon: DollarSign, label: t("budget.title"), route: "/budget" },
        { icon: Search, label: t("providers.title"), route: "/providers" },
        { icon: Building2, label: t("customProviders.title"), route: "/custom-providers" },
        { icon: FileText, label: t("blog.title"), route: "/blog" },
        { icon: CalendarClock, label: t("reminders.title", { defaultValue: "Reminders" }), route: "/reminders" as Href },
        { icon: Bell, label: t("settings.notifications"), route: "/notifications" },
        { icon: Ticket, label: t("settings.support"), route: "/help/tickets" },
        { icon: HelpCircle, label: t("settings.help"), route: "/help" },
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
        {/* Profile Card */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => router.push("/settings/profile")}
          activeOpacity={0.7}
        >
          <Avatar initials={initials} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>
              {user?.firstName || t("common.unknown", { defaultValue: "User" })} {user?.lastName || ""}
            </Text>
            <Text style={styles.profileEmail}>
              {user?.email || ""}
            </Text>
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
                    <View style={styles.menuIconBox}>
                      <Icon
                        size={18}
                        color={item.color || theme.colors.textSecondary}
                      />
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
    gap: 14,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 24,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.text,
  },
  profileEmail: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
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
