import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { hapticSuccess, hapticError } from "@/lib/haptics";

function getCurrentMonthValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-01`;
}

export default function NewBudgetScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    month: getCurrentMonthValue(),
    year: String(new Date().getFullYear()),
    plannedIncome: "",
    actualIncome: "",
    plannedExpenses: "",
    actualExpenses: "",
    notes: "",
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.month.trim() || !form.year.trim() || !form.actualExpenses.trim()) {
      Alert.alert(t("common.retry"), t("validation.required"));
      return;
    }

    const parsedYear = Number.parseInt(form.year, 10);
    const parsedActualExpenses = Number.parseFloat(form.actualExpenses);

    if (Number.isNaN(parsedYear) || Number.isNaN(parsedActualExpenses)) {
      Alert.alert(t("common.retry"), t("validation.invalidNumber"));
      return;
    }

    const payload: Record<string, unknown> = {
      month: form.month,
      year: parsedYear,
      actualExpenses: parsedActualExpenses,
    };

    if (form.plannedIncome.trim()) payload.plannedIncome = Number.parseFloat(form.plannedIncome);
    if (form.actualIncome.trim()) payload.actualIncome = Number.parseFloat(form.actualIncome);
    if (form.plannedExpenses.trim()) payload.plannedExpenses = Number.parseFloat(form.plannedExpenses);
    if (form.notes.trim()) payload.notes = form.notes.trim();

    setSaving(true);
    const res = await api.post<any>("/api/budget", payload);
    setSaving(false);

    if (res.error) {
      hapticError();
      Alert.alert(t("common.retry"), res.error);
      return;
    }

    hapticSuccess();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("budget.newBudget")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t("budget.month")} *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-01"
          placeholderTextColor={theme.colors.textMuted}
          value={form.month}
          onChangeText={(value) => update("month", value)}
          autoCapitalize="none"
        />

        <Text style={styles.label}>{t("budget.year")} *</Text>
        <TextInput
          style={styles.input}
          placeholder="2026"
          placeholderTextColor={theme.colors.textMuted}
          value={form.year}
          onChangeText={(value) => update("year", value.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          maxLength={4}
        />

        <Text style={styles.sectionLabel}>{t("budget.actualIncome")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("budget.plannedIncome")}
          placeholderTextColor={theme.colors.textMuted}
          value={form.plannedIncome}
          onChangeText={(value) => update("plannedIncome", value.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={[styles.input, styles.inputSpacing]}
          placeholder={t("budget.actualIncome")}
          placeholderTextColor={theme.colors.textMuted}
          value={form.actualIncome}
          onChangeText={(value) => update("actualIncome", value.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
        />

        <Text style={styles.sectionLabel}>{t("budget.actualExpenses")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("budget.plannedExpenses")}
          placeholderTextColor={theme.colors.textMuted}
          value={form.plannedExpenses}
          onChangeText={(value) => update("plannedExpenses", value.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={[styles.input, styles.inputSpacing]}
          placeholder={`${t("budget.actualExpenses")} *`}
          placeholderTextColor={theme.colors.textMuted}
          value={form.actualExpenses}
          onChangeText={(value) => update("actualExpenses", value.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
        />

        <Text style={styles.sectionLabel}>{t("budget.notes")}</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder={t("budget.notes")}
          placeholderTextColor={theme.colors.textMuted}
          value={form.notes}
          onChangeText={(value) => update("notes", value)}
          multiline
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
              <Text style={styles.saveBtnText}>{t("common.save")}</Text>
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
  label: { fontSize: 14, fontWeight: "500", color: theme.colors.textSecondary, marginTop: 16, marginBottom: 6 },
  sectionLabel: {
    fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 24, marginBottom: 10,
  },
  input: {
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: theme.colors.text,
  },
  inputSpacing: { marginTop: 10 },
  notesInput: { minHeight: 100, textAlignVertical: "top" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    paddingVertical: 16, marginTop: 28, ...theme.shadow.glow,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
