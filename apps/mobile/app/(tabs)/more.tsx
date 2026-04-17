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
} from "lucide-react-native";
import { useAuthStore } from "@/lib/auth-store";
import { theme } from "@/lib/theme";
import { Avatar } from "@/components/ui/Avatar";
import { hapticLight, hapticWarning } from "@/lib/haptics";

interface MenuItem {
  icon: any;
  label: string;
  route?: string;
  color?: string;
  onPress?: () => void;
}

export default function MoreScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const initials =
    ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() ||
    "U";

  const handleSignOut = () => {
    hapticWarning();
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await clearSession();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Profile", route: "/settings/profile" },
        { icon: Bell, label: "Notifications", route: "/settings/notifications" },
        { icon: Shield, label: "Privacy & Security", route: "/settings/privacy" },
        { icon: Settings, label: "Settings", route: "/settings" },
      ],
    },
    {
      title: "Features",
      items: [
        { icon: DollarSign, label: "Budget", route: "/budget" },
        { icon: Search, label: "Find Providers", route: "/providers" },
        { icon: HelpCircle, label: "Help Center", route: "/help" },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
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
              {user?.firstName || "User"} {user?.lastName || ""}
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

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={18} color={theme.colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
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
