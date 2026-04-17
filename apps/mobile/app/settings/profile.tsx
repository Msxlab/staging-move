import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Check } from "lucide-react-native";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const FAMILY_STATUSES = [
  { value: "SINGLE", label: "Single" },
  { value: "COUPLE", label: "Couple" },
  { value: "FAMILY", label: "Family" },
  { value: "ROOMMATES", label: "Roommates" },
];

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    ageRange: "",
    familyStatus: "SINGLE",
    hasChildren: false,
    childrenCount: 0,
    hasPets: false,
    carCount: 0,
  });

  useEffect(() => {
    (async () => {
      const res = await api.get<any>("/api/profile");
      if (res.data) {
        const u = res.data.user || {};
        const p = res.data.profile || {};
        setForm({
          firstName: u.firstName || "",
          lastName: u.lastName || "",
          ageRange: p.ageRange || "",
          familyStatus: p.familyStatus || "SINGLE",
          hasChildren: p.hasChildren || false,
          childrenCount: p.childrenCount || 0,
          hasPets: p.hasPets || false,
          carCount: p.carCount || 0,
        });
      }
      setPageLoading(false);
    })();
  }, []);

  const update = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.firstName) {
      Alert.alert("Required", "First name is required.");
      return;
    }
    setSaving(true);
    const res = await api.post("/api/profile", form);
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
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>First Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="John"
          placeholderTextColor={theme.colors.textMuted}
          value={form.firstName}
          onChangeText={(v) => update("firstName", v)}
        />

        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Doe"
          placeholderTextColor={theme.colors.textMuted}
          value={form.lastName}
          onChangeText={(v) => update("lastName", v)}
        />

        <Text style={styles.sectionLabel}>Age Range</Text>
        <View style={styles.chipRow}>
          {AGE_RANGES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, form.ageRange === r && styles.chipActive]}
              onPress={() => update("ageRange", r)}
            >
              <Text style={[styles.chipText, form.ageRange === r && styles.chipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Family Status</Text>
        <View style={styles.chipRow}>
          {FAMILY_STATUSES.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, form.familyStatus === f.value && styles.chipActive]}
              onPress={() => update("familyStatus", f.value)}
            >
              <Text style={[styles.chipText, form.familyStatus === f.value && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Has Children</Text>
          <Switch
            value={form.hasChildren}
            onValueChange={(v) => update("hasChildren", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {form.hasChildren && (
          <>
            <Text style={styles.label}>Number of Children</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              value={String(form.childrenCount || "")}
              onChangeText={(v) => update("childrenCount", parseInt(v) || 0)}
              keyboardType="number-pad"
            />
          </>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Has Pets</Text>
          <Switch
            value={form.hasPets}
            onValueChange={(v) => update("hasPets", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <Text style={styles.label}>Number of Cars</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={theme.colors.textMuted}
          value={String(form.carCount || "")}
          onChangeText={(v) => update("carCount", parseInt(v) || 0)}
          keyboardType="number-pad"
        />

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
              <Text style={styles.saveBtnText}>Save Profile</Text>
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
    marginTop: 16, paddingVertical: 14, paddingHorizontal: 16,
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
