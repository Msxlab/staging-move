/**
 * APP ENTRY — registers the Android home-screen widget task handler, then hands
 * off to the normal expo-router entry.
 *
 * react-native-android-widget needs its task handler registered at the JS app
 * entry point (it runs in a headless background context when the OS updates the
 * widget, with no React tree mounted), so registration must happen BEFORE the
 * router boots and outside any component. We register inside a guarded import so
 * a missing native module (e.g. running on web / a build without the widget) is
 * a no-op instead of a crash.
 *
 * `main` in package.json points here (was "expo-router/entry"); this file simply
 * adds the registration and re-exports the router entry so all existing routing
 * behavior is preserved.
 *
 * NOTE: The headless widget render is validated by the native EAS build + an
 * on-device test — it cannot be verified remotely. See WIDGET-SETUP.md.
 */

try {
  // Guarded: absent on web / in builds without the native widget module.
  const { registerWidgetTaskHandler } = require("react-native-android-widget");
  const { widgetTaskHandler } = require("./src/widgets/MoveWidget");
  if (typeof registerWidgetTaskHandler === "function" && widgetTaskHandler) {
    registerWidgetTaskHandler(widgetTaskHandler);
  }
} catch {
  // Non-blocking: the app boots normally even if widget registration is
  // unavailable (web, or a native build without the widget module).
}

// Hand off to the standard expo-router entry so routing is unchanged.
require("expo-router/entry");
