import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

/**
 * Blog stack — sits outside the tabs so we don't crowd the tab bar.
 * Reachable from More → Blog and from deep links (locateflow://blog,
 * https://locateflow.com/blog) once universal-link plumbing is in.
 */
export default function BlogLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#0A0F18" },
        headerTintColor: "#fff",
      }}
    >
      <Stack.Screen name="index" options={{ title: t("blog.title") }} />
      <Stack.Screen name="[slug]" options={{ title: t("blog.title") }} />
    </Stack>
  );
}
