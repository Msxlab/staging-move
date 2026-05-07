import React, { useMemo } from "react";
import { Stack } from "expo-router";
import { useAppTheme, type Theme } from "@/lib/theme";

export default function AuthLayout() {

  // theme: hook-injected styles

  const theme = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: "fade",
      }}
    />
  );
}
