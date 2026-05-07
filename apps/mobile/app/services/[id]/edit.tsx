import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

const BILLING_CYCLE_VALUES = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"] as const;

export default function EditServiceScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    providerName: "",
    accountNumber: "",
    website: "",
    phone: "",
    email: "",
    monthlyCost: "",
    billingDay: "",
    billingCycle: "MONTHLY",
    notes: "",
  });

  useEffect(() => {
    (async () => {
      const res = await api.get<any>(`/api/services/${id}`);
      if (res.data) {
        const s = res.data.service || res.data;
        setForm({
          providerName: s.providerName || "",
          accountNumber: s.accountNumber || "",
          website: s.website || "",
          phone: s.phone || "",
          email: s.email || "",
          monthlyCost: s.monthlyCost != null ? String(s.monthlyCost) : "",
          billingDay: s.billingDay != null ? String(s.billingDay) : "",
          billingCycle: s.billingCycle || "MONTHLY",
          notes: s.notes || "",
        });
      }
      setLoading(false);
    })();
  }, [id]);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.providerName.trim()) {
      Alert.alert(t("tickets.errorTitle"), t("services.providerNameRequiredError"));
      return;
    }
    setSaving(true);
    const payload: any = {
      providerName: form.providerName,
      billingCycle: form.billingCycle,
      accountNumber: form.accountNumber,
      phone: form.phone,
      website: form.website,
      email: form.email,
      notes: form.notes,
    };
    if (form.monthlyCost) payload.monthlyCost = parseFloat(form.monthlyCost) || 0;
    if (form.billingDay) payload.billingDay = parseInt(form.billingDay) || undefined;

    const res = await api.patch(`/api/services/${id}`, payload);
    setSaving(false);
    if (res.error) {
      hapticError();
      Alert.alert(t("tickets.errorTitle"), res.error);
    } else {
      hapticSuccess();
      router.back();
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("services.editTitle")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t("services.providerNameRequired")}</Text>
        <TextInput style={styles.input} value={form.providerName} onChangeText={(v) => update("providerName", v)} placeholderTextColor={theme.colors.textMuted} placeholder={t("services.providerNamePlaceholder")} />

        <Text style={styles.label}>{t("services.accountNumber")}</Text>
        <TextInput style={styles.input} value={form.accountNumber} onChangeText={(v) => update("accountNumber", v)} placeholderTextColor={theme.colors.textMuted} placeholder={t("services.accountNumberPlaceholder")} />

        <Text style={styles.label}>{t("services.monthlyCost")} ($)</Text>
        <TextInput style={styles.input} value={form.monthlyCost} onChangeText={(v) => update("monthlyCost", v)} placeholderTextColor={theme.colors.textMuted} placeholder="0.00" keyboardType="decimal-pad" />

        <Text style={styles.label}>{t("services.billingDayWithRange")}</Text>
        <TextInput style={styles.input} value={form.billingDay} onChangeText={(v) => update("billingDay", v)} placeholderTextColor={theme.colors.textMuted} placeholder="15" keyboardType="number-pad" />

        <Text style={styles.sectionLabel}>{t("services.billingCycle")}</Text>
        <View style={styles.chipRow}>
          {BILLING_CYCLE_VALUES.map((value) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, form.billingCycle === value && styles.chipActive]}
              onPress={() => update("billingCycle", value)}
            >
              <Text style={[styles.chipText, form.billingCycle === value && styles.chipTextActive]}>
                {t(`billingCycles.${value}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{t("common.phone")}</Text>
        <TextInput style={styles.input} value={form.phone} onChangeText={(v) => update("phone", v)} placeholderTextColor={theme.colors.textMuted} placeholder="(555) 123-4567" keyboardType="phone-pad" />

        <Text style={styles.label}>{t("common.website")}</Text>
        <TextInput style={styles.input} value={form.website} onChangeText={(v) => update("website", v)} placeholderTextColor={theme.colors.textMuted} placeholder="https://..." keyboardType="url" autoCapitalize="none" />

        <Text style={styles.label}>{t("common.email")}</Text>
        <TextInput style={styles.input} value={form.email} onChangeText={(v) => update("email", v)} placeholderTextColor={theme.colors.textMuted} placeholder="support@..." keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>{t("services.notes")}</Text>
        <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} value={form.notes} onChangeText={(v) => update("notes", v)} placeholderTextColor={theme.colors.textMuted} placeholder={t("services.notesPlaceholder")} multiline />

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.7}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Check size={18} color="#fff" />
              <Text style={styles.saveBtnText}>{t("common.saveChanges")}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: "500", color: theme.colors.textSecondary, marginTop: 16, marginBottom: 6 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 10 },
  input: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primaryFaded, borderColor: "rgba(127, 182, 232,0.4)" },
  chipText: { fontSize: 13, fontWeight: "500", color: theme.colors.textTertiary },
  chipTextActive: { color: theme.colors.primary },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg, paddingVertical: 16, marginTop: 28, ...theme.shadow.glow },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
