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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Check, Crown, DollarSign } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { isMobileStorePurchasesEnabledForPlatform } from "@/lib/billing-flags";
import { hapticSuccess, hapticError } from "@/lib/haptics";

function getCurrentMonthValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-01`;
}

// Server-side gate code returned by /api/budget POST when the caller has no
// active entitlement. We pre-flight from /api/profile so the UI can explain
// the gate inline instead of bouncing the user off a generic 403 error after
// they fill out the form.
const SUBSCRIPTION_GATE_CODE = "SUBSCRIPTION_REQUIRED";

export default function NewBudgetScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [subscriptionRequired, setSubscriptionRequired] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    month: getCurrentMonthValue(),
    year: String(new Date().getFullYear()),
    plannedIncome: "",
    actualIncome: "",
    plannedExpenses: "",
    actualExpenses: "",
    notes: "",
  });

  // Pre-flight subscription check. The backend rejects POST /api/budget with
  // SUBSCRIPTION_REQUIRED unless the user has an active paid plan, so we read
  // the same shape from /api/profile.subscription and surface it inline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api.get<any>("/api/profile");
      if (cancelled) return;
      if (res.error) {
        // Don't block the form on a profile read error — the POST will still
        // surface SUBSCRIPTION_REQUIRED if the user genuinely lacks a plan.
        setSubscriptionRequired(false);
        return;
      }
      const entitlement = res.data?.entitlement;
      if (entitlement && typeof entitlement.isActive === "boolean") {
        const hasPremiumAccess =
          entitlement.accessType === "PAID" ||
          entitlement.isTrial === true ||
          (["INDIVIDUAL", "FAMILY", "PRO"].includes(entitlement.plan) && entitlement.isActive === true && entitlement.accessType !== "FREE_ACCESS");
        setSubscriptionRequired(!hasPremiumAccess);
        return;
      }
      const sub = res.data?.subscription || {};
      const plan = typeof sub.plan === "string" ? sub.plan : null;
      const status = typeof sub.status === "string" ? sub.status : null;
      const premiumUntil = sub.premiumUntil ? new Date(sub.premiumUntil) : null;
      const currentPeriodEndsAt = sub.currentPeriodEndsAt ? new Date(sub.currentPeriodEndsAt) : null;
      const hasPremiumAccess =
        Boolean(plan && plan !== "FREE_TRIAL") &&
        (status === "ACTIVE" ||
          status === "TRIALING" ||
          (premiumUntil && premiumUntil.getTime() > Date.now()) ||
          (currentPeriodEndsAt && currentPeriodEndsAt.getTime() > Date.now()));
      setSubscriptionRequired(!hasPremiumAccess);
    })().catch(() => {
      if (!cancelled) setSubscriptionRequired(false);
    });
    return () => { cancelled = true; };
  }, []);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.month.trim() || !form.year.trim()) {
      Alert.alert(t("common.retry"), t("validation.required"));
      return;
    }

    const parsedYear = Number.parseInt(form.year, 10);

    if (Number.isNaN(parsedYear)) {
      Alert.alert(t("common.retry"), t("validation.invalidNumber"));
      return;
    }

    const payload: Record<string, unknown> = {
      month: form.month,
      year: parsedYear,
    };

    if (form.plannedIncome.trim()) payload.plannedIncome = Number.parseFloat(form.plannedIncome);
    if (form.actualIncome.trim()) payload.actualIncome = Number.parseFloat(form.actualIncome);
    if (form.plannedExpenses.trim()) payload.plannedExpenses = Number.parseFloat(form.plannedExpenses);
    if (form.actualExpenses.trim()) payload.actualExpenses = Number.parseFloat(form.actualExpenses);
    if (form.notes.trim()) payload.notes = form.notes.trim();

    setSaving(true);
    const res = await api.post<any>("/api/budget", payload);
    setSaving(false);

    if (res.error) {
      hapticError();
      // Translate the backend gate into the same inline upsell so a user who
      // signed up for paid mid-flow doesn't get a generic alert.
      if (res.code === SUBSCRIPTION_GATE_CODE) {
        setSubscriptionRequired(true);
        return;
      }
      Alert.alert(t("common.retry"), res.error);
      return;
    }

    hapticSuccess();
    router.back();
  };

  const formDisabled = saving || subscriptionRequired === true;
  const plannedIncomeAmount = Number.parseFloat(form.plannedIncome || "0") || 0;
  const plannedExpensesAmount = Number.parseFloat(form.plannedExpenses || "0") || 0;
  const plannedBalance = plannedIncomeAmount - plannedExpensesAmount;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("budget.newBudget")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <DollarSign size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>BUDGET COMMAND</Text>
              <Text style={styles.heroTitle}>{t("budget.newBudget")}</Text>
              <Text style={styles.heroSub} numberOfLines={1}>{form.month}</Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>${Math.round(plannedIncomeAmount)}</Text>
              <Text style={styles.heroStatLabel}>income</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>${Math.round(plannedExpensesAmount)}</Text>
              <Text style={styles.heroStatLabel}>expenses</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, plannedBalance < 0 && styles.heroStatWarn]}>
                ${Math.round(plannedBalance)}
              </Text>
              <Text style={styles.heroStatLabel}>balance</Text>
            </View>
          </View>
        </View>

        {subscriptionRequired === true ? (
          <View style={styles.gateCard}>
            <View style={styles.gateIcon}>
              <Crown size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.gateTitle}>{t("budget.gate_subscriptionRequired_title")}</Text>
              <Text style={styles.gateBody}>{t("budget.gate_subscriptionRequired_body")}</Text>
              {isMobileStorePurchasesEnabledForPlatform() ? (
                <TouchableOpacity
                  style={styles.gateCta}
                  onPress={() => router.push("/settings/subscription")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.gateCtaText}>{t("budget.gate_subscriptionRequired_cta")}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.gateBody}>{t("settings.subscription_mobilePurchasesUnavailable")}</Text>
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Period</Text>
          <Text style={styles.label}>{t("budget.month")} *</Text>
          <TextInput
            style={[styles.input, formDisabled && styles.inputDisabled]}
            placeholder="YYYY-MM-01"
            placeholderTextColor={theme.colors.textMuted}
            value={form.month}
            onChangeText={(value) => update("month", value)}
            autoCapitalize="none"
            editable={!formDisabled}
          />

          <Text style={styles.label}>{t("budget.year")} *</Text>
          <TextInput
            style={[styles.input, formDisabled && styles.inputDisabled]}
            placeholder="2026"
            placeholderTextColor={theme.colors.textMuted}
            value={form.year}
            onChangeText={(value) => update("year", value.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            maxLength={4}
            editable={!formDisabled}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>{t("budget.actualIncome")}</Text>
          <TextInput
            style={[styles.input, formDisabled && styles.inputDisabled]}
            placeholder={t("budget.plannedIncome")}
            placeholderTextColor={theme.colors.textMuted}
            value={form.plannedIncome}
            onChangeText={(value) => update("plannedIncome", value.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            editable={!formDisabled}
          />
          <TextInput
            style={[styles.input, styles.inputSpacing, formDisabled && styles.inputDisabled]}
            placeholder={t("budget.actualIncome")}
            placeholderTextColor={theme.colors.textMuted}
            value={form.actualIncome}
            onChangeText={(value) => update("actualIncome", value.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            editable={!formDisabled}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>{t("budget.actualExpenses")}</Text>
          <TextInput
            style={[styles.input, formDisabled && styles.inputDisabled]}
            placeholder={t("budget.plannedExpenses")}
            placeholderTextColor={theme.colors.textMuted}
            value={form.plannedExpenses}
            onChangeText={(value) => update("plannedExpenses", value.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            editable={!formDisabled}
          />
          <TextInput
            style={[styles.input, styles.inputSpacing, formDisabled && styles.inputDisabled]}
            placeholder={t("budget.actualExpenses")}
            placeholderTextColor={theme.colors.textMuted}
            value={form.actualExpenses}
            onChangeText={(value) => update("actualExpenses", value.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            editable={!formDisabled}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>{t("budget.notes")}</Text>
          <TextInput
            style={[styles.input, styles.notesInput, formDisabled && styles.inputDisabled]}
            placeholder={t("budget.notes")}
            placeholderTextColor={theme.colors.textMuted}
            value={form.notes}
            onChangeText={(value) => update("notes", value)}
            multiline
            editable={!formDisabled}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, formDisabled && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={formDisabled}
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

const makeStyles = (theme: Theme) => StyleSheet.create({
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
  hero: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
    ...theme.shadow.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.primary + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: theme.colors.accent,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 3,
    letterSpacing: 0,
  },
  heroSub: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginTop: 3,
  },
  heroStats: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  heroStat: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    padding: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  heroStatValue: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },
  heroStatWarn: {
    color: theme.colors.error,
  },
  heroStatLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: theme.colors.textTertiary,
    textTransform: "uppercase",
    marginTop: 3,
  },
  formSection: {
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: { fontSize: 14, fontWeight: "500", color: theme.colors.textSecondary, marginTop: 16, marginBottom: 6 },
  sectionLabel: {
    fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.8, marginTop: 0, marginBottom: 10,
  },
  input: {
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: theme.colors.text,
  },
  inputDisabled: { opacity: 0.55 },
  inputSpacing: { marginTop: 10 },
  notesInput: { minHeight: 100, textAlignVertical: "top" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    paddingVertical: 16, marginTop: 28, ...theme.shadow.glow,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  gateCard: {
    flexDirection: "row", gap: 12, padding: 14, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: theme.colors.rose.border,
    backgroundColor: theme.colors.primaryFaded, marginBottom: 16,
  },
  gateIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: theme.colors.primaryFaded,
    alignItems: "center", justifyContent: "center",
  },
  gateTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  gateBody: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 17 },
  gateCta: {
    alignSelf: "flex-start", marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
  },
  gateCtaText: { fontSize: 12, fontWeight: "700", color: "#fff" },
});
