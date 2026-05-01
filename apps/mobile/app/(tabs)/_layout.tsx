import React from "react";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  LayoutDashboard,
  MapPin,
  Truck,
  Zap,
  Menu,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";

function GlassTabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          // Warm umber #0E0A07 at 65% — matches `--bg` on web.
          { backgroundColor: "rgba(14, 10, 7, 0.65)" },
        ]}
      />
      {/* Top glow line — rose, matches the brand pin glow. */}
      <LinearGradient
        colors={["rgba(212,132,106,0.18)", "rgba(212,132,106,0.04)", "transparent"]}
        style={styles.topGlow}
      />
      {/* Glass top border — warm cream alpha. */}
      <View style={styles.glassBorder} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <GlassTabBarBackground />,
        tabBarActiveTintColor: theme.colors.primary,
        // Inactive cream-on-warm to match Edition VI text alphas.
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.dashboard"),
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="addresses"
        options={{
          title: t("tabs.addresses"),
          tabBarIcon: ({ color, size }) => (
            <MapPin size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="moving"
        options={{
          title: t("tabs.moving"),
          tabBarIcon: ({ color, size }) => (
            <Truck size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: t("tabs.services"),
          tabBarIcon: ({ color, size }) => (
            <Zap size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("tabs.more"),
          tabBarIcon: ({ color, size }) => (
            <Menu size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    backgroundColor: "transparent",
    borderTopWidth: 0,
    height: Platform.OS === "ios" ? 88 : 64,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 8,
    elevation: 0,
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  glassBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(245, 241, 234, 0.08)",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  tabItem: {
    gap: 4,
  },
});
