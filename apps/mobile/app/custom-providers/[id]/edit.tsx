import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Check } from "lucide-react-native";
import { api } from "@/lib/api";
import { theme } from "@/lib/theme";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { CATEGORY_META } from "@/lib/recommendation-engine";
import { hapticError, hapticSuccess } from "@/lib/haptics";

const PROVIDER_TYPES = [
  "LOCAL_BUSINESS",
  "PROFESSIONAL_SERVICE",
  "HEALTHCARE",
  "LEGAL",
  "DENTAL",
  "PHYSICAL_THERAPY",
  "GYM",
  "OTHER",
];

const CATEGORY_PREFIXES = [
  "GOVERNMENT_",
  "UTILITY_",
  "FINANCIAL_",
  "HOUSING_",
  "HEALTHCARE_",
  "TRANSPORTATION_",
  "KIDS_",
  "FITNESS_",
  "SHOPPING_",
  "GROCERY_",
  "PET_",
  "LEGAL_",
] as const;

const CATEGORIES = Object.entries(CATEGORY_META)
  .filter(([value]) => CATEGORY_PREFIXES.some((prefix) => value.startsWith(prefix)))
  .map(([value, meta]) => ({ value, label: meta.label, order: meta.order }))
  .sort((a, b) => a.order - b.order);

export default function EditCustomProviderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    providerType: "OTHER",
    description: "",
    website: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    notes: "",
  });

  useEffect(() => {
    (async () => {
      const res = await api.get<any>(`/api/custom-providers/${id}`);
      const provider = res.data?.provider;
      if (provider) {
        setForm({
          name: provider.name || "",
          category: provider.category || "",
          providerType: provider.providerType || "OTHER",
          description: provider.description || "",
          website: provider.website || "",
          phone: provider.phone || "",
          email: provider.email || "",
          addressLine1: provider.addressLine1 || "",
          addressLine2: provider.addressLine2 || "",
          city: provider.city || "",
          state: provider.state || "",
          zipCode: provider.zipCode || "",
          notes: provider.notes || "",
        });
      }
      setLoading(false);
    })();
  }, [id]);

  const update = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === "state" ? value.toUpperCase().slice(0, 2) : value,
    }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.category.trim()) {
      Alert.alert("Required", "Name and category are required.");
      return;
    }
    setSaving(true);
    const res = await api.patch(`/api/custom-providers/${id}`, {
      ...form,
      state: form.state.trim(),
    });
    setSaving(false);
    if (res.error) {
      hapticError();
      Alert.alert("Error", res.error);
      return;
    }
    hapticSuccess();
    router.back();
  };

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Provider</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.notice}>
            This is your private provider record. Editing it updates LocateFlow only and does not contact the provider.
          </Text>

          <Field label="Name *" value={form.name} onChangeText={(v) => update("name", v)} placeholder="Local dentist, gym, utility..." />

          <Text style={styles.sectionLabel}>Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.value}
                onPress={() => update("category", category.value)}
                style={[styles.chip, form.category === category.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, form.category === category.value && styles.chipTextActive]}>{category.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>Provider Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {PROVIDER_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => update("providerType", type)}
                style={[styles.chip, form.providerType === type && styles.chipActive]}
              >
                <Text style={[styles.chipText, form.providerType === type && styles.chipTextActive]}>{type.replace(/_/g, " ")}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Field label="Description" value={form.description} onChangeText={(v) => update("description", v)} multiline />
          <Field label="Website" value={form.website} onChangeText={(v) => update("website", v)} placeholder="https://..." keyboardType="url" autoCapitalize="none" />
          <Field label="Phone" value={form.phone} onChangeText={(v) => update("phone", v)} keyboardType="phone-pad" />
          <Field label="Email" value={form.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Address Line 1" value={form.addressLine1} onChangeText={(v) => update("addressLine1", v)} />
          <Field label="Address Line 2" value={form.addressLine2} onChangeText={(v) => update("addressLine2", v)} />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="City" value={form.city} onChangeText={(v) => update("city", v)} />
            </View>
            <View style={{ width: 88 }}>
              <Field label="State" value={form.state} onChangeText={(v) => update("state", v)} autoCapitalize="characters" maxLength={2} />
            </View>
          </View>

          <Field label="ZIP" value={form.zipCode} onChangeText={(v) => update("zipCode", v)} keyboardType="number-pad" maxLength={10} />
          <Field label="Notes" value={form.notes} onChangeText={(v) => update("notes", v)} multiline />

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Check size={18} color="#fff" />
                <Text style={styles.saveText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "url" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
}) {
  return (
    <>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.textArea]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={theme.colors.textMuted}
        multiline={props.multiline}
        keyboardType={props.keyboardType || "default"}
        autoCapitalize={props.autoCapitalize}
        maxLength={props.maxLength}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  notice: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.xl, padding: 14, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: "500", color: theme.colors.textSecondary, marginTop: 16, marginBottom: 6 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 10 },
  input: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
  textArea: { minHeight: 86, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  chipRow: { gap: 8, paddingRight: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primaryFaded, borderColor: "rgba(249,115,22,0.4)" },
  chipText: { fontSize: 13, fontWeight: "500", color: theme.colors.textTertiary },
  chipTextActive: { color: theme.colors.primary },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg, paddingVertical: 16, marginTop: 28 },
  saveText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
