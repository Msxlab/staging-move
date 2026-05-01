import { Stack } from "expo-router";

/**
 * Blog stack — sits outside the tabs so we don't crowd the tab bar.
 * Reachable from More → Blog and from deep links (locateflow://blog,
 * https://locateflow.com/blog) once universal-link plumbing is in.
 */
export default function BlogLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#0a0a0f" },
        headerTintColor: "#fff",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Blog" }} />
      <Stack.Screen name="[slug]" options={{ title: "Blog" }} />
    </Stack>
  );
}
