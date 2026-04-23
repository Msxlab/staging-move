import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Check } from "lucide-react-native";
import { AddressAutocompleteField } from "@/components/address/address-autocomplete-field";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/address-autocomplete";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";

const ADDRESS_TYPES = [
  { value: "HOME", label: "Home" },
  { value: "WORK", label: "Work" },
  { value: "VACATION", label: "Vacation" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "STORAGE", label: "Storage" },
  { value: "OTHER", label: "Other" },
];

const OWNERSHIP_TYPES = [
  { value: "OWNER", label: "Owner" },
  { value: "RENTER", label: "Renter" },
  { value: "FAMILY", label: "Family" },
  { value: "OTHER", label: "Other" },
];

export default function EditAddressScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "HOME",
    nickname: "",
    street: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "USA",
    ownership: "RENTER",
    isPrimary: false,
    formattedAddress: null as string | null,
    placeId: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
  });

  useEffect(() => {
    (async () => {
      const res = await api.get<any>(`/api/addresses/${id}`);
      if (res.data) {
        const a = res.data.address || res.data;
        setForm({
          type: a.type || "HOME",
          nickname: a.nickname || "",
          street: a.street || "",
          street2: a.street2 || "",
          city: a.city || "",
          state: a.state || "",
          zip: a.zip || "",
          country: a.country || "USA",
          ownership: a.ownership || "RENTER",
          isPrimary: a.isPrimary || false,
          formattedAddress: a.formattedAddress || null,
          placeId: a.placeId || null,
          latitude: a.latitude ?? null,
          longitude: a.longitude ?? null,
        });
      }
      setPageLoading(false);
    })();
  }, [id]);

  const update = (field: string, value: string | boolean | number | null) =>
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "street" || field === "city" || field === "state" || field === "zip") {
        return clearAddressAutocompleteMetadata(next);
      }
      return next;
    });

  const handleAutocompleteSelect = (result: AddressAutocompleteResult) => {
    setForm((prev) => applyAddressAutocompleteResult(prev, result));
  };

  const handleSave = async () => {
    if (!form.street || !form.city || !form.state || !form.zip) {
      Alert.alert("Missing Fields", "Please fill in street, city, state, and ZIP.");
      return;
    }
    setSaving(true);
    const res = await api.patch(`/api/addresses/${id}`, form);
    setSaving(false);
    if (res.error) {
      hapticError();
      Alert.alert("Error", res.error);
    } else {
      hapticSuccess();
      router.back();
    }
  };

  if (pageLoading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Address</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>Type</Text>
        <View style={styles.chipRow}>
          {ADDRESS_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.chip, form.type === t.value && styles.chipActive]}
              onPress={() => update("type", t.value)}
            >
              <Text style={[styles.chipText, form.type === t.value && styles.chipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Nickname</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., "Main Residence"'
          placeholderTextColor={theme.colors.textMuted}
          value={form.nickname}
          onChangeText={(v) => update("nickname", v)}
        />

        <AddressAutocompleteField
          label="Street Address *"
          value={form.street}
          placeholder="123 Main Street"
          onValueChange={(value) => update("street", value)}
          onSelect={handleAutocompleteSelect}
        />

        <Text style={styles.label}>Apt / Suite</Text>
        <TextInput
          style={styles.input}
          placeholder="Apt 4B"
          placeholderTextColor={theme.colors.textMuted}
          value={form.street2}
          onChangeText={(v) => update("street2", v)}
        />

        <Text style={styles.label}>City *</Text>
        <TextInput
          style={styles.input}
          placeholder="New York"
          placeholderTextColor={theme.colors.textMuted}
          value={form.city}
          onChangeText={(v) => update("city", v)}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>State *</Text>
            <TextInput
              style={styles.input}
              placeholder="NY"
              placeholderTextColor={theme.colors.textMuted}
              value={form.state}
              onChangeText={(v) => update("state", v.toUpperCase().slice(0, 2))}
              maxLength={2}
              autoCapitalize="characters"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>ZIP *</Text>
            <TextInput
              style={styles.input}
              placeholder="10001"
              placeholderTextColor={theme.colors.textMuted}
              value={form.zip}
              onChangeText={(v) => update("zip", v)}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Ownership</Text>
        <View style={styles.chipRow}>
          {OWNERSHIP_TYPES.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[styles.chip, form.ownership === o.value && styles.chipActive]}
              onPress={() => update("ownership", o.value)}
            >
              <Text style={[styles.chipText, form.ownership === o.value && styles.chipTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Primary Address</Text>
          <Switch
            value={form.isPrimary}
            onValueChange={(v) => update("isPrimary", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Update Address</Text>
            </>
          )}
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
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 10,
  },
  label: {
    fontSize: 14, fontWeight: "500", color: theme.colors.textSecondary, marginTop: 16, marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: theme.colors.text,
  },
  row: { flexDirection: "row", gap: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primaryFaded, borderColor: "rgba(249,115,22,0.4)",
  },
  chipText: { fontSize: 13, fontWeight: "500", color: theme.colors.textTertiary },
  chipTextActive: { color: theme.colors.primary },
  switchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 20, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  switchLabel: { fontSize: 15, fontWeight: "500", color: theme.colors.text },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    paddingVertical: 16, marginTop: 28, ...theme.shadow.glow,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
