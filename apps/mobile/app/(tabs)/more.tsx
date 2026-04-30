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
  User,
  DollarSign,
  Search,
  HelpCircle,
  Settings,
  ChevronRight,
  Shield,
  Bell,
  LogOut,
  Ticket,
  Building2,
  FileText,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/lib/auth-store";
import { theme } from "@/lib/theme";
import { Avatar } from "@/components/ui/Avatar";
import { hapticLight, hapticWarning } from "@/lib/haptics";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { api } from "@/lib/api";
import { unregisterPushNotifications } from "@/lib/push";

interface MenuItem {
  icon: any;
  label: string;
  route?: string;
  color?: string;
  onPress?: () => void;
}

export default function MoreScreen() {
  const router = useRouter();
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
        { icon: Bell, label: t("settings.notifications"), route: "/settings/notifications" },
        { icon: Shield, label: t("settings.privacy"), route: "/settings/privacy" },
        { icon: Settings, label: t("settings.title"), route: "/settings" },
      ],
    },
    {
      title: t("tabs.more"),
      items: [
        { icon: DollarSign, label: t("budget.title"), route: "/budget" },
        { icon: Search, label: t("providers.title"), route: "/providers" },
        { icon: Building2, label: "Custom Providers", route: "/custom-providers" },
        { icon: FileText, label: "Blog", route: "/blog" },
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
          onPress={() => router.push("/settings/profile" as any)}
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
                      else if (item.route) router.push(item.route as any);
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

        <Text style={styles.version}>LocateFlow v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    borderColor: "rgba(239,68,68,0.2)",
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
