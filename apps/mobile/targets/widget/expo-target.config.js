/**
 * UNVERIFIED — requires a native EAS build + device test; native rendering not
 * checked remotely.
 *
 * @bacons/apple-targets target config for the iOS WidgetKit extension.
 *
 * `npx expo prebuild --clean` reads this to generate + link the Xcode widget
 * target. The App Group is mirrored from app.json's
 * `ios.entitlements["com.apple.security.application-groups"]` automatically, but
 * we also declare it here explicitly so the extension's entitlements are
 * unambiguous. The Swift sources in this directory (MoveWidget.swift) read that
 * App Group's UserDefaults — written by the JS data layer on a native build via
 * the App Group bridge documented in WIDGET-SETUP.md.
 *
 * NONE of this is verifiable from this environment: Swift cannot be typechecked
 * here, and the widget only renders on a real iOS build + device.
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: "widget",
  name: "MoveWidget",
  displayName: "LocateFlow",
  // SwiftUI + WidgetKit are required for any WidgetKit extension.
  frameworks: ["SwiftUI", "WidgetKit"],
  // Mirror the main app's App Group so the extension can read the shared
  // UserDefaults the data layer writes. Must match WIDGET_APP_GROUP in
  // src/lib/widget-data.ts and app.json's ios.entitlements.
  entitlements: {
    "com.apple.security.application-groups": [
      "group.com.locateflow.mobile.widget",
    ],
  },
  // WidgetKit requires iOS 14+; 15.1 matches the app's floor comfortably.
  deploymentTarget: "15.1",
};
