import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MapPin, ChevronRight, Plus, Minus } from "lucide-react-native";
import { useAppTheme, type Theme } from "@/lib/theme";
import { getMergedDisplayCategoryIcon } from "@/lib/recommendation-engine";
import type { Address } from "@locateflow/shared";

/**
 * "Map-first" addresses view — recreation of the Aurora design's Direction B.
 *
 * A stylized dark canvas (decorative grid + roads, no real basemap) with one
 * status-colored teardrop pin per address, positioned by the address's real
 * latitude/longitude normalized to the canvas. Tapping a pin surfaces that
 * address's card + the services tied to it. Addresses without coordinates are
 * surfaced as a count rather than guessed onto the map.
 */

type StatusKind = "active" | "seasonal" | "past";

function addressStatus(a: Address): { kind: StatusKind; label: string } {
  if (a.type === "VACATION") return { kind: "seasonal", label: "Seasonal" };
  if (a.endDate && new Date(a.endDate).getTime() < Date.now()) return { kind: "past", label: "Past" };
  return { kind: "active", label: "Active" };
}

function tone(kind: StatusKind, theme: Theme) {
  return kind === "seasonal" ? theme.colors.rose : kind === "past" ? theme.colors.amber : theme.colors.emerald;
}

const lat = (a: Address) => (a as any).latitude as number | null | undefined;
const lng = (a: Address) => (a as any).longitude as number | null | undefined;
const hasGeo = (a: Address) => Number.isFinite(lat(a)) && Number.isFinite(lng(a));

export function AddressesMap({ addresses, onOpen }: { addresses: Address[]; onOpen: (id: string) => void }) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const geo = useMemo(() => addresses.filter(hasGeo), [addresses]);
  const noGeoCount = addresses.length - geo.length;

  // Bounding box → normalized canvas positions (with edge padding).
  const positions = useMemo(() => {
    if (geo.length === 0) return new Map<string, { x: number; y: number }>();
    const lats = geo.map((a) => lat(a) as number);
    const lngs = geo.map((a) => lng(a) as number);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const norm = (v: number, min: number, max: number) => (max > min ? (v - min) / (max - min) : 0.5);
    const m = new Map<string, { x: number; y: number }>();
    for (const a of geo) {
      m.set(a.id, {
        x: 10 + norm(lng(a) as number, minLng, maxLng) * 80, // % across (W→E)
        y: 12 + (1 - norm(lat(a) as number, minLat, maxLat)) * 74, // % down (N→S)
      });
    }
    return m;
  }, [geo]);

  const [selId, setSelId] = useState<string | null>(geo[0]?.id ?? null);
  const selected = geo.find((a) => a.id === selId) ?? geo[0] ?? null;
  // Stylized zoom (1×–2×) — scales the decorative canvas + pin positions in
  // place; there's no real basemap to pan, so this just spreads clustered pins.
  const [zoom, setZoom] = useState(1);

  if (geo.length === 0) {
    return (
      <View style={styles.empty}>
        <MapPin size={28} color={theme.colors.textTertiary} />
        <Text style={styles.emptyText}>None of your addresses have a saved location yet.</Text>
      </View>
    );
  }

  const grid = "rgba(236,241,248,0.045)";
  const selStatus = selected ? addressStatus(selected) : null;
  const selTone = selected && selStatus ? tone(selStatus.kind, theme) : theme.colors.emerald;
  const services: any[] = (selected?.services as any[]) || [];

  return (
    <View>
      {/* Stylized canvas */}
      <View style={styles.canvas}>
        <View style={[StyleSheet.absoluteFill, { transform: [{ scale: zoom }] }]}>
          {[0.25, 0.5, 0.75].map((p) => (
            <View key={`h${p}`} style={{ position: "absolute", left: 0, right: 0, top: `${p * 100}%`, height: 1, backgroundColor: grid }} />
          ))}
          {[0.3, 0.6, 0.85].map((p) => (
            <View key={`v${p}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${p * 100}%`, width: 1, backgroundColor: grid }} />
          ))}
          <View style={{ position: "absolute", left: "-5%", right: "-5%", top: "46%", height: 2, backgroundColor: "rgba(236,241,248,0.06)", transform: [{ rotate: "-6deg" }] }} />
          <View style={{ position: "absolute", top: 0, bottom: 0, left: "44%", width: 2, backgroundColor: "rgba(236,241,248,0.06)", transform: [{ rotate: "8deg" }] }} />

          {geo.map((a) => {
            const pos = positions.get(a.id)!;
            const tk = tone(addressStatus(a).kind, theme);
            const sel = a.id === selId;
            return (
              <TouchableOpacity
                key={a.id}
                style={{ position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, marginLeft: -15, marginTop: -30 }}
                onPress={() => setSelId(a.id)}
                accessibilityLabel={a.nickname || a.city}
              >
                <View
                  style={[
                    styles.pin,
                    { borderColor: tk.text, backgroundColor: tk.text + "33", transform: [{ rotate: "-45deg" }, { scale: sel ? 1.18 : 1 }] },
                  ]}
                >
                  <MapPin size={13} color={tk.text} style={{ transform: [{ rotate: "45deg" }] }} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Zoom controls (Aurora ad-mapui) — pinned, not part of the scaled canvas */}
        <View style={styles.zoomCtl}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom((z) => Math.min(2, +(z + 0.4).toFixed(2)))}
            disabled={zoom >= 2}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
          >
            <Plus size={16} color={zoom >= 2 ? theme.colors.textMuted : theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.zoomDiv} />
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom((z) => Math.max(1, +(z - 0.4).toFixed(2)))}
            disabled={zoom <= 1}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
          >
            <Minus size={16} color={zoom <= 1 ? theme.colors.textMuted : theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {noGeoCount > 0 && (
        <Text style={styles.noGeo}>
          {noGeoCount} address{noGeoCount === 1 ? "" : "es"} without a saved location {noGeoCount === 1 ? "isn't" : "aren't"} shown on the map.
        </Text>
      )}

      {/* Selected address card */}
      {selected && (
        <TouchableOpacity style={styles.selCard} onPress={() => onOpen(selected.id)}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.selRow}>
              <Text style={styles.selLbl} numberOfLines={1}>
                {selected.nickname || (selected.isPrimary ? "Current home" : selected.street)}
              </Text>
              {selStatus && (
                <View style={[styles.chip, { backgroundColor: selTone.bg, borderColor: selTone.border }]}>
                  <Text style={[styles.chipText, { color: selTone.text }]}>{selStatus.label}</Text>
                </View>
              )}
            </View>
            <Text style={styles.selAddr} numberOfLines={1}>
              {selected.street}, {selected.city}, {selected.state}
            </Text>
          </View>
          <ChevronRight size={18} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      )}

      {/* Tied services */}
      <Text style={styles.lbl}>Tied to this address · {services.length}</Text>
      {services.length === 0 ? (
        <Text style={styles.noGeo}>No services tracked at this address yet.</Text>
      ) : (
        services.slice(0, 8).map((s) => (
          <View key={s.id} style={styles.svcRow}>
            <Text style={styles.svcEmoji}>{getMergedDisplayCategoryIcon(s.category) || "•"}</Text>
            <Text style={styles.svcName} numberOfLines={1}>
              {s.providerName || s.provider?.name || "Service"}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    canvas: {
      height: 340,
      borderRadius: 18,
      overflow: "hidden",
      // Intentionally dark-fixed (Aurora navy au-base): the map canvas is a
      // dark-styled map per design, so its backdrop stays dark even in the
      // Light theme — map tiles do not retheme.
      backgroundColor: "#0A0F18",
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 14,
      position: "relative",
    },
    pin: {
      width: 30,
      height: 30,
      borderWidth: 2,
      borderTopLeftRadius: 15,
      borderTopRightRadius: 15,
      borderBottomRightRadius: 15,
      borderBottomLeftRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    zoomCtl: {
      position: "absolute",
      top: 10,
      right: 10,
      borderRadius: 12,
      backgroundColor: "rgba(10,15,24,0.72)",
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    zoomBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    zoomDiv: { height: 1, backgroundColor: theme.colors.border },
    noGeo: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 2, marginBottom: 4 },
    selCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: 18,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 4,
    },
    selRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    selLbl: { flexShrink: 1, fontSize: 15, fontWeight: "700", color: theme.colors.text },
    selAddr: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
    chip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
    chipText: { fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "800" },
    lbl: {
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      fontWeight: "700",
      color: theme.colors.textTertiary,
      marginTop: 16,
      marginBottom: 9,
      marginLeft: 2,
    },
    svcRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 8,
    },
    svcEmoji: { fontSize: 16, width: 24, textAlign: "center" },
    svcName: { flex: 1, fontSize: 13, fontWeight: "600", color: theme.colors.text },
    empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 },
    emptyText: { fontSize: 13, color: theme.colors.textTertiary, textAlign: "center", paddingHorizontal: 40 },
  });
