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
import { LinearGradient } from "expo-linear-gradient";
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
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ServiceLogoMark } from "@/components/services/ServiceLogoMark";
import { HeroCard, MoveCard, SectionHeader, Pill } from "@/components/move";
import {
  getCategoryIcon,
  getCategoryLabel,
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryLabel,
} from "@/lib/recommendation-engine";

const BILLING_CYCLE_VALUES = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"] as const;

const catColors: Record<string, string> = {
  GOVERNMENT: "#E25C5C",
  UTILITY: "#5B8DEF",
  FINANCIAL: "#54CB7E",
  HOUSING: "#5B8DEF",
  HEALTHCARE: "#F0A0B8",
  TRANSPORTATION: "#3D6FD6",
  KIDS: "#3D6FD6",
  FITNESS: "#5B8DEF",
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
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.headerSaveBtn, saving && { opacity: 0.55 }]}
          accessibilityRole="button"
          accessibilityLabel={t("common.saveChanges")}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.primary} size="small" />
          ) : (
            <Check size={17} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
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
            <Pill label={categoryLabel} tone="info" />
            {form.billingCycle ? <Pill label={t(`billingCycles.${form.billingCycle}`)} tone="muted" /> : null}
          </View>
        </HeroCard>

        <SectionHeader label={t("services.provider", { defaultValue: "Provider" })} style={styles.sectionHeader} />
        <MoveCard style={styles.section} padding={14} radius={theme.radius.xl}>
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
        </MoveCard>

        <SectionHeader label={t("services.billingCycle")} style={styles.sectionHeader} />
        <MoveCard style={styles.section} padding={14} radius={theme.radius.xl}>
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
        </MoveCard>

        <SectionHeader label={t("services.contact", { defaultValue: "Contact" })} style={styles.sectionHeader} />
        <MoveCard style={styles.section} padding={14} radius={theme.radius.xl}>
          <Field icon={Phone} label={t("common.phone")} value={form.phone} onChangeText={(v) => update("phone", v)} placeholder="(555) 123-4567" keyboardType="phone-pad" />
          <Field icon={Globe} label={t("common.website")} value={form.website} onChangeText={(v) => update("website", v)} placeholder="https://..." keyboardType="url" autoCapitalize="none" />
          <Field icon={Mail} label={t("common.email")} value={form.email} onChangeText={(v) => update("email", v)} placeholder="support@..." keyboardType="email-address" autoCapitalize="none" />
        </MoveCard>

        <SectionHeader label={t("services.notes")} style={styles.sectionHeader} />
        <MoveCard style={styles.section} padding={14} radius={theme.radius.xl}>
          <Field
            icon={StickyNote}
            label={t("services.notes")}
            value={form.notes}
            onChangeText={(v) => update("notes", v)}
            placeholder={t("services.notesPlaceholder")}
            multiline
          />
        </MoveCard>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={theme.colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnGrad}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.onAccent} />
            ) : (
              <>
                <Check size={18} color={theme.colors.onAccent} />
                <Text style={styles.saveBtnText}>{t("common.saveChanges")}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  headerSaveBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 52 },
  hero: {
    marginBottom: 4,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroEyebrow: { fontSize: 10, fontFamily: fonts.sansBold, color: theme.colors.faint, letterSpacing: 1.2, textTransform: "uppercase" },
  heroName: { marginTop: 4, fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text, lineHeight: 25 },
  heroMeta: { marginTop: 3, fontSize: 13, fontFamily: fonts.sans, color: theme.colors.dim },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  sectionHeader: { marginTop: 20, marginBottom: 10, marginLeft: 2 },
  section: {
    gap: 10,
  },
  fieldShell: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bg2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  label: { fontSize: 11, fontFamily: fonts.sansSemibold, color: theme.colors.faint, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  input: { minHeight: 22, padding: 0, fontSize: 15, fontFamily: fonts.sans, color: theme.colors.text },
  textArea: { minHeight: 74, lineHeight: 20 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  chip: {
    minHeight: 38,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accentBorder },
  chipText: { fontSize: 13, fontFamily: fonts.sansSemibold, color: theme.colors.dim },
  chipTextActive: { color: theme.colors.primary },
  saveBtn: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    marginTop: 28,
  },
  saveBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 16,
  },
  saveBtnText: { fontSize: 16, fontFamily: fonts.sansBold, color: theme.colors.onAccent },
});
