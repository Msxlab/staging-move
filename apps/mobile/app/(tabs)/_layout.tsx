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
import { theme } from "@/lib/theme";

function GlassTabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(10, 10, 15, 0.65)" },
        ]}
      />
      {/* Top glow line */}
      <LinearGradient
        colors={["rgba(249,115,22,0.15)", "rgba(249,115,22,0.03)", "transparent"]}
        style={styles.topGlow}
      />
      {/* Glass top border */}
      <View style={styles.glassBorder} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <GlassTabBarBackground />,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: "rgba(255,255,255,0.3)",
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="addresses"
        options={{
          title: "Addresses",
          tabBarIcon: ({ color, size }) => (
            <MapPin size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="moving"
        options={{
          title: "Moving",
          tabBarIcon: ({ color, size }) => (
            <Truck size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Services",
          tabBarIcon: ({ color, size }) => (
            <Zap size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
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
    backgroundColor: "rgba(255, 255, 255, 0.08)",
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
