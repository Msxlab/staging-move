import React, { useEffect, useState, useCallback } from "react";
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
import { useAuthStore } from "@/lib/auth-store";
import {
  ArrowLeft,
  User,
  Bell,
  Shield,
  Download,
  CreditCard,
  Palette,
  Info,
  ChevronRight,
  Moon,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const initials =
    ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() || "U";

  const items = [
    { icon: User, label: t("settings.profile"), route: "/settings/profile" },
    { icon: Bell, label: t("settings.notifications"), route: "/settings/notifications" },
    { icon: Shield, label: t("settings.privacy"), route: "/settings/privacy" },
    { icon: CreditCard, label: t("settings.subscription"), route: "/settings/subscription" },
    { icon: Download, label: t("settings.export"), route: "/settings/export" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.title")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => router.push("/settings/profile" as any)}
          activeOpacity={0.7}
        >
          <Avatar initials={initials} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.firstName || ""} {user?.lastName || ""}</Text>
            <Text style={styles.profileEmail}>{user?.email || ""}</Text>
          </View>
          <ChevronRight size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        {/* Settings Items */}
        <Card variant="default" style={{ marginTop: 20, padding: 0, overflow: "hidden" }}>
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.settingItem, i < items.length - 1 && styles.settingItemBorder]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.6}
              >
                <View style={styles.settingIcon}>
                  <Icon size={18} color={theme.colors.textSecondary} />
                </View>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <ChevronRight size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* Language picker — persists per-device + syncs to DB for
            logged-in users via /api/user/locale. */}
        <View style={{ marginTop: 20 }}>
          <LanguageSelector />
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>LocateFlow v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, padding: 16 },
  profileName: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  profileEmail: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  settingItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  settingItemBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  settingIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },
  settingLabel: { flex: 1, fontSize: 15, fontWeight: "500", color: theme.colors.text },
  appInfo: { alignItems: "center", marginTop: 32, gap: 4 },
  appInfoText: { fontSize: 12, color: theme.colors.textMuted },
});
