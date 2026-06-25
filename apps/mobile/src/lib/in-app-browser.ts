import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";
import { APP_WEB_URL } from "@/lib/api";

/**
 * Open a URL in a chromeless in-app browser (SFSafariViewController on iOS,
 * Custom Tabs on Android) instead of a full system browser jump.
 *
 * Why this exists: when the mobile app opens an APP_WEB_URL page via
 * `Linking.openURL`, the OS hands the user to Safari/Chrome with a visible
 * address bar, history, and tab switcher. The user feels like they left the
 * app even though they're looking at the same logged-in session. An in-app
 * browser keeps the native chrome compact (a single "Done" button), shares
 * cookies with the user's last browser session (so they stay signed in), and
 * returns to the app on close with no app-switcher round-trip.
 *
 * We append `?embed=mobile` to APP_WEB_URL pages so the web app knows to
 * suppress its global header/sidebar and render a screen that visually
 * matches the surrounding mobile UI.
 *
 * For non-owned URLs (tel:, mailto:, third-party websites) we fall through
 * to `Linking.openURL` — those don't share our session and don't benefit
 * from chromeless mode.
 */

const OWNED_HOST_PREFIX = APP_WEB_URL.replace(/\/$/, "");

export type OpenWebUrlOptions = {
  /**
   * Append `?embed=mobile` so the web app renders without its global
   * header/sidebar. Defaults to true for APP_WEB_URL targets and is
   * ignored for non-owned URLs.
   */
  embed?: boolean;
};

function isOwnedWebUrl(url: string): boolean {
  return url.startsWith(OWNED_HOST_PREFIX);
}

function appendEmbedParam(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("embed")) {
      parsed.searchParams.set("embed", "mobile");
    }
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}embed=mobile`;
  }
}

/**
 * Open a web URL. Use in-app browser for APP_WEB_URL targets, system
 * browser for everything else (tel:, mailto:, external sites).
 *
 * Returns `true` if the browser opened, `false` if the OS refused (e.g.
 * malformed URL or no handler available).
 */
export async function openWebUrl(
  url: string,
  options: OpenWebUrlOptions = {},
): Promise<boolean> {
  if (!url) return false;

  const isOwned = isOwnedWebUrl(url);
  const shouldEmbed = options.embed ?? isOwned;
  const finalUrl = isOwned && shouldEmbed ? appendEmbedParam(url) : url;

  if (isOwned) {
    try {
      const result = await WebBrowser.openBrowserAsync(finalUrl, {
        // iOS: dismiss button on top-left, no address bar visible.
        dismissButtonStyle: "done",
        // Android Custom Tabs: hide URL once page loads.
        showTitle: false,
        toolbarColor: Platform.OS === "android" ? "#0A0F18" : undefined,
        controlsColor: Platform.OS === "ios" ? "#5B8DEF" : undefined,
        // Always reuse the existing session cookies — this is the whole
        // point of an in-app browser for owned URLs.
        showInRecents: false,
      });
      if (result.type === "cancel" || result.type === "dismiss" || result.type === "opened") {
        return true;
      }
      return false;
    } catch {
      // Native module unavailable (Expo Go, simulator quirks) — fall back.
    }
  }

  try {
    const canOpen = await Linking.canOpenURL(finalUrl);
    if (!canOpen) return false;
    await Linking.openURL(finalUrl);
    return true;
  } catch {
    return false;
  }
}
