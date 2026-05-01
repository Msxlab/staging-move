import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  MapPin,
  Home,
  Briefcase,
  Palmtree,
  Package,
  Clock,
  Edit,
  Trash2,
  Star,
  Zap,
  Plus,
} from "lucide-react-native";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError, hapticWarning } from "@/lib/haptics";

const typeIcons: Record<string, any> = {
  HOME: Home, WORK: Briefcase, VACATION: Palmtree, STORAGE: Package, TEMPORARY: Clock,
};

export default function AddressDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [address, setAddress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch_ = useCallback(async () => {
    const res = await api.get<any>(`/api/addresses/${id}`);
    if (res.data) setAddress(res.data.address || res.data);
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    await fetch_();
    setLoading(false);
  }, [fetch_]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetch_();
    setRefreshing(false);
  }, [fetch_]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = () => {
    hapticWarning();
    Alert.alert("Delete Address", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await api.delete(`/api/addresses/${id}`);
          if (!res.error) {
            hapticSuccess();
            router.back();
          } else {
            hapticError();
            Alert.alert("Error", "Failed to delete address.");
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;
  if (!address) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Not Found</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: theme.colors.textTertiary }}>Address not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const TypeIcon = typeIcons[address.type] || MapPin;
  const services = address.services || [];
  const totalMonthlyCost = services.reduce((sum: number, s: any) => sum + (s.monthlyCost || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {address.nickname || "Address"}
        </Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/addresses/[id]/edit", params: { id: String(id) } })}
          style={styles.backBtn}
        >
          <Edit size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Address Info Card */}
        <Card variant="default">
          <View style={styles.infoRow}>
            <View style={styles.typeIcon}>
              <TypeIcon size={22} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressStreet}>{address.street}</Text>
              {address.street2 ? <Text style={styles.addressSub}>{address.street2}</Text> : null}
              <Text style={styles.addressSub}>
                {address.city}, {address.state} {address.zip}
              </Text>
            </View>
          </View>
          <View style={styles.badges}>
            <UiBadge label={address.type} variant="info" />
            <UiBadge
              label={address.ownership === "OWNER" ? "Owner" : address.ownership === "RENTER" ? "Renter" : address.ownership}
              variant={address.ownership === "OWNER" ? "success" : "neutral"}
            />
            {address.isPrimary && <UiBadge label="Primary" variant="warning" />}
          </View>
        </Card>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{services.length}</Text>
            <Text style={styles.statLabel}>Services</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: theme.colors.emerald.text }]}>
              ${totalMonthlyCost.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Monthly</Text>
          </View>
        </View>

        <Card variant="default" style={{ marginTop: 14 }}>
          <Text style={styles.budgetLabel}>Monthly budget snapshot</Text>
          <Text style={styles.budgetValue}>${totalMonthlyCost.toLocaleString()}/mo</Text>
          <Text style={styles.budgetHint}>
            This total is calculated from all services linked to this address.
          </Text>
        </Card>

        {/* Services List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Services</Text>
          <TouchableOpacity
            style={styles.addSmall}
            onPress={() => router.push({ pathname: "/services/new", params: { addressId: String(id) } })}
          >
            <Plus size={16} color={theme.colors.primary} />
            <Text style={styles.addSmallText}>Add</Text>
          </TouchableOpacity>
        </View>

        {services.length === 0 ? (
          <Card variant="default">
            <Text style={{ color: theme.colors.textTertiary, textAlign: "center", paddingVertical: 20 }}>
              No services linked to this address yet.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {services.map((s: any) => (
              <Card
                key={s.id}
                variant="default"
                onPress={() => router.push({ pathname: "/services/[id]", params: { id: s.id } })}
              >
                <View style={styles.serviceRow}>
                  <Zap size={16} color={theme.colors.cyan.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{s.providerName || s.provider?.name || "Service"}</Text>
                    <Text style={styles.serviceCat}>{s.category}</Text>
                  </View>
                  {s.monthlyCost > 0 && (
                    <Text style={styles.serviceCost}>${s.monthlyCost}/mo</Text>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Delete */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete address"
          accessibilityHint="Permanently removes this address"
        >
          <Trash2 size={16} color={theme.colors.error} />
          <Text style={styles.deleteText}>Delete Address</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text, flex: 1, textAlign: "center" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  typeIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: theme.colors.primaryFaded, alignItems: "center", justifyContent: "center",
  },
  addressStreet: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  addressSub: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  badges: { flexDirection: "row", gap: 6, marginTop: 14 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  statBox: {
    flex: 1, alignItems: "center", paddingVertical: 16,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  statLabel: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 4 },
  budgetLabel: { fontSize: 12, fontWeight: "600", color: theme.colors.textSecondary },
  budgetValue: { fontSize: 26, fontWeight: "800", color: theme.colors.emerald.text, marginTop: 6 },
  budgetHint: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 8, lineHeight: 18 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 24, marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
  addSmall: { flexDirection: "row", alignItems: "center", gap: 4 },
  addSmallText: { fontSize: 13, fontWeight: "600", color: theme.colors.primary },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  serviceName: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  serviceCat: { fontSize: 11, color: theme.colors.textTertiary },
  serviceCost: { fontSize: 14, fontWeight: "700", color: theme.colors.emerald.text },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 32, paddingVertical: 14, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
  },
  deleteText: { fontSize: 14, fontWeight: "600", color: theme.colors.error },
});
