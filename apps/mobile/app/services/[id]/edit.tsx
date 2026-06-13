import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  DollarSign,
  FileText,
  Globe,
  Mail,
  Phone,
  StickyNote,
  type LucideIcon,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ServiceLogoMark } from "@/components/services/ServiceLogoMark";
import {
  getCategoryIcon,
  getCategoryLabel,
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryLabel,
} from "@/lib/recommendation-engine";

const BILLING_CYCLE_VALUES = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"] as const;

const catColors: Record<string, string> = {
  GOVERNMENT: "#F08C8E",
  UTILITY: "#F2C46C",
  FINANCIAL: "#87DDC0",
  HOUSING: "#7FB6E8",
  HEALTHCARE: "#F0A0B8",
  TRANSPORTATION: "#5C9DDC",
  KIDS: "#D99A4E",
  FITNESS: "#F2C46C",
  SHOPPING: "#F0A0B8",
  OTHER: "#6E7C92",
};

function getServiceCategoryGroup(category: string): string {
  return category?.split("_")[0] || "OTHER";
}

function getServiceCategoryColor(category: string): string {
  return catColors[category] || catColors[getServiceCategoryGroup(category)] || catColors.OTHER;
}

function getServiceCategoryLabel(category: string): string {
  return getMergedDisplayCategoryLabel(category) || getCategoryLabel(category) || category?.replace(/_/g, " ") || "Service";
}

function getServiceFallbackIcon(category: string): string {
  return getMergedDisplayCategoryIcon(category) || getCategoryIcon(category) || getCategoryIcon(getServiceCategoryGroup(category)) || "";
}

export default function EditServiceScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [service, setService] = useState<any>(null);
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
        setService(s);
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

  const category = service?.category || "OTHER";
  const categoryColor = getServiceCategoryColor(category);
  const categoryLabel = t(`categories.${category}`, { defaultValue: getServiceCategoryLabel(category) });
  const logoService = service ? { ...service, providerName: form.providerName } : { providerName: form.providerName, category };

  const Field = ({
    icon: Icon,
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType,
    autoCapitalize,
    multiline = false,
  }: {
    icon: LucideIcon;
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
    autoCapitalize?: React.ComponentProps<typeof TextInput>["autoCapitalize"];
    multiline?: boolean;
  }) => (
    <View style={styles.fieldShell}>
      <View style={styles.fieldIcon}>
        <Icon size={17} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[styles.input, multiline && styles.textArea]}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={theme.colors.textMuted}
          placeholder={placeholder}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
        />
      </View>
    </View>
  );

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <ServiceLogoMark
              service={logoService}
              fallbackIcon={getServiceFallbackIcon(category)}
              size={58}
              logoSize={42}
              borderRadius={18}
              fallbackFontSize={24}
              backgroundColor={categoryColor + "30"}
              borderColor={categoryColor + "55"}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroEyebrow}>{t("services.editTitle").toUpperCase()}</Text>
              <Text style={styles.heroName} numberOfLines={2}>
                {form.providerName || t("services.providerNamePlaceholder")}
              </Text>
              <Text style={styles.heroMeta} numberOfLines={1}>
                {categoryLabel}
              </Text>
            </View>
          </View>
          <View style={styles.heroBadges}>
            <Badge label={categoryLabel} variant="info" mono />
            {form.billingCycle ? <Badge label={t(`billingCycles.${form.billingCycle}`)} variant="neutral" mono /> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("services.provider", { defaultValue: "Provider" })}</Text>
          <Field
            icon={Building2}
            label={t("services.providerNameRequired")}
            value={form.providerName}
            onChangeText={(v) => update("providerName", v)}
            placeholder={t("services.providerNamePlaceholder")}
          />
          <Field
            icon={FileText}
            label={t("services.accountNumber")}
            value={form.accountNumber}
            onChangeText={(v) => update("accountNumber", v)}
            placeholder={t("services.accountNumberPlaceholder")}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("services.billingCycle")}</Text>
          <Field
            icon={DollarSign}
            label={`${t("services.monthlyCost")} ($)`}
            value={form.monthlyCost}
            onChangeText={(v) => update("monthlyCost", v)}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          <Field
            icon={CalendarClock}
            label={t("services.billingDayWithRange")}
            value={form.billingDay}
            onChangeText={(v) => update("billingDay", v)}
            placeholder="15"
            keyboardType="number-pad"
          />
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("services.contact", { defaultValue: "Contact" })}</Text>
          <Field icon={Phone} label={t("common.phone")} value={form.phone} onChangeText={(v) => update("phone", v)} placeholder="(555) 123-4567" keyboardType="phone-pad" />
          <Field icon={Globe} label={t("common.website")} value={form.website} onChangeText={(v) => update("website", v)} placeholder="https://..." keyboardType="url" autoCapitalize="none" />
          <Field icon={Mail} label={t("common.email")} value={form.email} onChangeText={(v) => update("email", v)} placeholder="support@..." keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("services.notes")}</Text>
          <Field
            icon={StickyNote}
            label={t("services.notes")}
            value={form.notes}
            onChangeText={(v) => update("notes", v)}
            placeholder={t("services.notesPlaceholder")}
            multiline
          />
        </View>

        <Button
          title={t("common.saveChanges")}
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          icon={<Check size={18} color="#fff" />}
          fullWidth
          style={styles.saveBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text, flex: 1, textAlign: "center" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 42, gap: 16 },
  hero: {
    padding: 16,
    borderRadius: theme.radius["2xl"],
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    ...theme.shadow.glow,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroEyebrow: { fontSize: 10, fontWeight: "800", color: theme.colors.textTertiary, letterSpacing: 0.8 },
  heroName: { marginTop: 4, fontSize: 20, fontWeight: "800", color: theme.colors.text, lineHeight: 25 },
  heroMeta: { marginTop: 3, fontSize: 13, color: theme.colors.textTertiary },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  section: {
    gap: 10,
    padding: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: theme.colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  fieldShell: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryFaded,
  },
  label: { fontSize: 11, fontWeight: "700", color: theme.colors.textTertiary, marginBottom: 6 },
  input: { minHeight: 22, padding: 0, fontSize: 15, color: theme.colors.text },
  textArea: { minHeight: 74, lineHeight: 20 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.full, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primaryFaded, borderColor: "rgba(127, 182, 232,0.4)" },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.colors.textTertiary },
  chipTextActive: { color: theme.colors.primary },
  saveBtn: { marginTop: 4 },
});
