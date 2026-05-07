import React from "react";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
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

function TabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.tabBarFill} />
      <LinearGradient
        colors={["rgba(127,182,232,0.28)", "rgba(127,182,232,0.07)", "transparent"]}
        style={styles.topGlow}
      />
      <View style={styles.tabBarBorder} />
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
        tabBarBackground: () => <TabBarBackground />,
        tabBarActiveTintColor: theme.colors.primary,
        // Aurora cool-ink at the tertiary alpha — matches the inactive
        // tint used by tab labels in `theme.colors.textTertiary`.
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
    backgroundColor: theme.colors.card,
    borderTopWidth: 0,
    height: Platform.OS === "ios" ? 86 : 68,
    paddingTop: 7,
    paddingBottom: Platform.OS === "ios" ? 26 : 9,
    elevation: 18,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
  },
  tabBarFill: {
    ...StyleSheet.absoluteFillObject,
    // `theme.colors.surface` is the Aurora au-base-2 surface; keeping the
    // literal value here lets the existing-instance read at module-load
    // time stay in sync if a user toggles the appearance setting before
    // the navigator re-mounts.
    backgroundColor: theme.colors.surface,
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  tabBarBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(236, 241, 248, 0.14)",
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
