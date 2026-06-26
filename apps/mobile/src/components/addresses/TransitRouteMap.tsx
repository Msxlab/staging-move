import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth-store";
import { buildMobileAuthHeaders } from "@/lib/client-identity";
import { useThemePreference } from "@/lib/theme";
import {
  buildTransitRouteMapPath,
  resolveTransitRouteCoords,
} from "@/components/addresses/transit-route-map-url";

/**
 * Real route map for the move-in-transit banner (Addresses tab) — the chosen
 * mobile surface for the Geoapify static map upgrade. Replaces nothing
 * destructively: it renders ABOVE the banner's existing stylized
 * origin→destination dashed route, which remains as the graceful fallback.
 *
 * The PNG comes from the web app's authenticated proxy (/api/maps/static —
 * GEOAPIFY_API_KEY never ships to the client) via the app's API base URL
 * with the same Bearer token the ApiClient uses. Old home pin is sage, new
 * home pin + geodesic route use the plan accent (theme.colors.primary is
 * already Sapphire via applyPlanPalette), and the basemap follows the
 * resolved app theme (Aurora dark/light style sets server-side).
 *
 * Failure posture: missing coordinates, missing auth token, or ANY image /
 * proxy error (key unconfigured → 503, upstream error → 502) renders null —
 * the banner simply keeps its stylized route row. Never a broken image.
 * The image is static (no pan/zoom) and fadeDuration is 0, so reduced-motion
 * preferences are inherently respected.
 */

const MAP_HEIGHT = 112;
// The banner sits inside the tab's horizontal padding + its own padding;
// requesting slightly wide and letting resizeMode="cover" crop keeps a
// single cache entry per route instead of one per device width.
const MAP_MAX_WIDTH = 640;
const routeKeyCoord = (value: number) => Math.round(value * 1e5) / 1e5;

export function TransitRouteMap({
  activeMove,
  addresses,
  fromCity,
  toCity,
}: {
  activeMove: unknown;
  addresses: unknown[];
  fromCity: string;
  toCity: string;
}) {
  const { theme, resolvedScheme } = useThemePreference();
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const previousUriRef = useRef<string | null>(null);
  const webObjectUrlRef = useRef<string | null>(null);
  // Tier ladder: try the full Geoapify route map first; on ANY failure (incl. the
  // realMap 403 for Free/Individual) fall back to the free OSM "preview" map,
  // and only then to the stylized banner. Both tiers are served by Geoapify —
  // no client-side entitlement check needed.
  const [tier, setTier] = useState<"full" | "preview">("full");

  const coords = useMemo(
    () => resolveTransitRouteCoords(activeMove, addresses),
    [activeMove, addresses],
  );
  const routeKey = coords
    ? `${routeKeyCoord(coords.from.lat)},${routeKeyCoord(coords.from.lng)}->${routeKeyCoord(coords.to.lat)},${routeKeyCoord(coords.to.lng)}`
    : null;

  const revokeWebObjectUrl = () => {
    if (webObjectUrlRef.current && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(webObjectUrlRef.current);
      webObjectUrlRef.current = null;
    }
  };

  // A new route resets the ladder so it re-tries the full map first.
  useEffect(() => {
    revokeWebObjectUrl();
    setTier("full");
    setFailed(false);
    setLoaded(false);
    setLoadedUri(null);
    previousUriRef.current = null;
  }, [routeKey]);

  useEffect(() => () => revokeWebObjectUrl(), []);

  useEffect(() => {
    let alive = true;
    getToken()
      .then((value) => {
        if (alive) setToken(value);
      })
      .catch(() => {
        if (alive) setToken(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const uri = useMemo(() => {
    if (!coords) return null;
    const width = Math.min(MAP_MAX_WIDTH, Math.max(80, Math.round(windowWidth - 64)));
    const path = buildTransitRouteMapPath(coords.from, coords.to, {
      width,
      height: MAP_HEIGHT,
      theme: resolvedScheme,
      accent: theme.colors.primary,
      preview: tier === "preview",
    });
    return `${API_URL}${path}`;
  }, [coords, windowWidth, resolvedScheme, theme.colors.primary, tier]);

  useEffect(() => {
    if (!uri) {
      previousUriRef.current = null;
      revokeWebObjectUrl();
      setLoaded(false);
      setLoadedUri(null);
      return;
    }
    if (previousUriRef.current !== uri) {
      previousUriRef.current = uri;
      if (!loadedUri) setLoaded(false);
    }
  }, [loadedUri, uri]);

  useEffect(() => {
    if (Platform.OS !== "web" || !uri || !token) return;

    let alive = true;
    fetch(uri, { headers: buildMobileAuthHeaders(token) })
      .then(async (response) => {
        if (!alive) return;
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.startsWith("image/")) {
          if (!webObjectUrlRef.current) setLoaded(false);
          if (tier === "full") setTier("preview");
          else setFailed(true);
          return;
        }
        const blobUrl = URL.createObjectURL(await response.blob());
        if (!alive) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        revokeWebObjectUrl();
        webObjectUrlRef.current = blobUrl;
        setLoaded(true);
        setLoadedUri(blobUrl);
        setFailed(false);
      })
      .catch(() => {
        if (!alive) return;
        if (!webObjectUrlRef.current) setLoaded(false);
        if (tier === "full") setTier("preview");
        else setFailed(true);
      });

    return () => {
      alive = false;
    };
  }, [tier, token, uri]);

  // Graceful fallback: the banner's stylized dashed route stays as-is.
  if (!coords || !uri || !token || (failed && !loadedUri)) return null;

  const visibleUri = Platform.OS === "web" ? loadedUri : loadedUri ?? uri;
  if (!visibleUri) return null;
  const showPreloadFrame = !loadedUri && !loaded;
  const isLoadingReplacement = Platform.OS !== "web" && Boolean(loadedUri && uri !== loadedUri && !failed);

  return (
    <View
      style={[styles.frame, showPreloadFrame && styles.preloadFrame, { borderColor: theme.colors.border }]}
      accessibilityRole="image"
      accessibilityLabel={t("addresses.transit.mapAlt", { from: fromCity, to: toCity })}
      accessibilityElementsHidden={!loadedUri}
      importantForAccessibility={loadedUri ? "auto" : "no-hide-descendants"}
    >
      <Image
        source={{ uri: visibleUri, headers: buildMobileAuthHeaders(token) }}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        fadeDuration={0}
        accessibilityIgnoresInvertColors
        onLoad={() => {
          setLoaded(true);
          setLoadedUri(visibleUri);
          setFailed(false);
        }}
        onError={() => {
          // Full map failed (realMap 403 for free, 502/503, etc.) → drop to
          // the free OSM preview; if that also fails, the stylized banner stays.
          if (!loadedUri) setLoaded(false);
          if (tier === "full") setTier("preview");
          else setFailed(true);
        }}
      />
      {isLoadingReplacement && (
        <Image
          source={{ uri, headers: buildMobileAuthHeaders(token) }}
          resizeMode="cover"
          style={styles.preloadImage}
          fadeDuration={0}
          accessibilityIgnoresInvertColors
          onLoad={() => {
            setLoaded(true);
            setLoadedUri(uri);
            setFailed(false);
          }}
          onError={() => {
            if (tier === "full") setTier("preview");
            else setFailed(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: MAP_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 12,
    // Dark-fixed placeholder behind the tile while it streams in — matches
    // the AddressesMap canvas decision (map tiles read dark in both themes;
    // the real tile then follows the resolved theme once painted).
    backgroundColor: "#0A0F18",
  },
  preloadFrame: {
    height: 1,
    marginBottom: 0,
    borderWidth: 0,
    opacity: 0,
  },
  preloadImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
});
