import React, { useState } from "react";
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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, MapPin, Check, Calendar } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { AddressAutocompleteField } from "@/components/address/address-autocomplete-field";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/address-autocomplete";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
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

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

export default function NewAddressScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<Date>(new Date());
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
    startDate: new Date().toISOString().slice(0, 10),
    formattedAddress: null as string | null,
    placeId: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
  });

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
    if (form.state.length !== 2) {
      Alert.alert("Invalid State", "Please enter a 2-letter state code (e.g. NY, CA).");
      return;
    }
    if (!/^\d{5}(-\d{4})?$/.test(form.zip)) {
      Alert.alert("Invalid ZIP", "Please enter a valid 5-digit ZIP code.");
      return;
    }
    setLoading(true);
    const res = await api.post("/api/addresses", form);
    setLoading(false);
    if (res.error) {
      hapticError();
      Alert.alert("Error", res.error);
    } else {
      hapticSuccess();
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Address</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type Selector */}
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

        {/* Nickname */}
        <Text style={styles.label}>Nickname</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., "Main Residence"'
          placeholderTextColor={theme.colors.textMuted}
          value={form.nickname}
          onChangeText={(v) => update("nickname", v)}
        />

        {/* Street */}
        <AddressAutocompleteField
          label="Street Address *"
          value={form.street}
          placeholder="123 Main Street"
          onValueChange={(value) => update("street", value)}
          onSelect={handleAutocompleteSelect}
        />

        {/* Street 2 */}
        <Text style={styles.label}>Apt / Suite</Text>
        <TextInput
          style={styles.input}
          placeholder="Apt 4B"
          placeholderTextColor={theme.colors.textMuted}
          value={form.street2}
          onChangeText={(v) => update("street2", v)}
        />

        {/* City */}
        <Text style={styles.label}>City *</Text>
        <TextInput
          style={styles.input}
          placeholder="New York"
          placeholderTextColor={theme.colors.textMuted}
          value={form.city}
          onChangeText={(v) => update("city", v)}
        />

        {/* State + ZIP row */}
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

        {/* Ownership */}
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

        {/* Move-in Date */}
        <Text style={styles.label}>Move-in Date</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Calendar size={16} color={theme.colors.primary} />
          <Text style={[styles.dateButtonText, { color: theme.colors.text }]}>
            {selectedStartDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={selectedStartDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event: any, date?: Date) => {
              setShowDatePicker(Platform.OS === "ios");
              if (date) {
                setSelectedStartDate(date);
                update("startDate", date.toISOString().slice(0, 10));
              }
            }}
            themeVariant="dark"
          />
        )}
        {Platform.OS === "ios" && showDatePicker && (
          <TouchableOpacity
            style={{ alignSelf: "flex-end", marginTop: 4 }}
            onPress={() => setShowDatePicker(false)}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.colors.primary }}>Done</Text>
          </TouchableOpacity>
        )}

        {/* Primary Toggle */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Primary Address</Text>
          <Switch
            value={form.isPrimary}
            onValueChange={(v) => update("isPrimary", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Save Address</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 160 },
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
  dateButton: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: 14,
  },
  dateButtonText: {
    fontSize: 15, color: theme.colors.textMuted, flex: 1,
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
