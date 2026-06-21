import React, { useMemo } from "react";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import {
  LayoutDashboard,
  MapPin,
  Truck,
  Zap,
  Menu,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";

function TabBarBackground() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  // Move nav surface: a slightly-elevated navy (bg2) with a single hairline
  // top border — matches the design's flat bottom-nav treatment.
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.tabBarFill} />
      <View style={styles.tabBarBorder} />
    </View>
  );
}

export default function TabsLayout() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <TabBarBackground />,
        // Active tint = Sapphire (the design's gold maps to colors.primary).
        tabBarActiveTintColor: theme.colors.primary,
        // Inactive tint = Move faint ink (colors.faint).
        tabBarInactiveTintColor: theme.colors.faint,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.dashboard"),
          tabBarIcon: ({ color }) => (
            <LayoutDashboard size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="addresses"
        options={{
          title: t("tabs.addresses"),
          tabBarIcon: ({ color }) => (
            <MapPin size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="moving"
        options={{
          title: t("tabs.moving"),
          tabBarIcon: ({ color }) => (
            <Truck size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: t("tabs.services"),
          tabBarIcon: ({ color }) => (
            <Zap size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("tabs.more"),
          tabBarIcon: ({ color }) => (
            <Menu size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  tabBar: {
    backgroundColor: theme.colors.bg2,
    borderTopWidth: 0,
    height: Platform.OS === "ios" ? 84 : 66,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 26 : 8,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
  },
  tabBarFill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // Move bottom-nav fill: bg2 (slightly elevated navy).
    backgroundColor: theme.colors.bg2,
  },
  tabBarBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  tabLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  tabItem: {
    gap: 4,
  },
});
