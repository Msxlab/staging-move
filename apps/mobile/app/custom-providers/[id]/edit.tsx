import React, { useEffect, useState, useMemo } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Check, Building2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORY_META } from "@/lib/recommendation-engine";
import { getCategoryIcon } from "@/lib/recommendation-engine";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { HeroCard, MoveCard, SectionHeader } from "@/components/move";

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

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
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
      Alert.alert(t("customProviders.requiredTitle"), t("customProviders.requiredNameCategory"));
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
      Alert.alert(t("tickets.errorTitle"), res.error);
      return;
    }
    hapticSuccess();
    router.back();
  };

  if (loading) return <LoadingScreen />;
  const selectedCategory = CATEGORIES.find((category) => category.value === form.category);
  const contactCount = [form.website, form.phone, form.email].filter(Boolean).length;
  const locationCount = [form.addressLine1, form.city, form.state, form.zipCode].filter(Boolean).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("customProviders.editTitle")}</Text>
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          style={[styles.headerSaveBtn, saving && { opacity: 0.55 }]}
          accessibilityRole="button"
          accessibilityLabel={t("customProviders.saveChanges")}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.primary} size="small" />
          ) : (
            <Check size={17} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                {form.category ? (
                  <CategoryIcon emoji={getCategoryIcon(form.category)} size={22} color={theme.colors.primary} />
                ) : (
                  <Building2 size={22} color={theme.colors.primary} />
                )}
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroKicker}>{t("customProviders.editTitle")}</Text>
                <Text style={styles.heroTitle} numberOfLines={1}>{form.name || t("customProviders.editTitle")}</Text>
                <Text style={styles.heroSub} numberOfLines={1}>
                  {selectedCategory ? t(`categories.${selectedCategory.value}`, { defaultValue: selectedCategory.label }) : t("customProviders.categoryRequired")}
                </Text>
              </View>
            </View>
          </HeroCard>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue} numberOfLines={1}>{form.category ? "Yes" : "No"}</Text>
              <Text style={styles.heroStatLabel} numberOfLines={1}>category</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue} numberOfLines={1}>{contactCount}/3</Text>
              <Text style={styles.heroStatLabel} numberOfLines={1}>contact</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue} numberOfLines={1}>{locationCount}/4</Text>
              <Text style={styles.heroStatLabel} numberOfLines={1}>location</Text>
            </View>
          </View>

          <MoveCard style={styles.formCard} padding={14} radius={theme.radius.xl}>
            <Text style={styles.notice}>{t("customProviders.editNotice")}</Text>

            <Field label={t("customProviders.nameRequired")} value={form.name} onChangeText={(v) => update("name", v)} placeholder={t("customProviders.namePlaceholder")} />
          </MoveCard>

          <SectionHeader label={t("customProviders.categoryRequired")} style={styles.sectionHeader} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.value}
                onPress={() => update("category", category.value)}
                style={[styles.chip, form.category === category.value && styles.chipActive]}
              >
                <CategoryIcon
                  emoji={getCategoryIcon(category.value)}
                  size={13}
                  color={form.category === category.value ? theme.colors.primary : theme.colors.textTertiary}
                />
                <Text style={[styles.chipText, form.category === category.value && styles.chipTextActive]}>
                  {t(`categories.${category.value}`, { defaultValue: category.label })}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <SectionHeader label={t("customProviders.providerType")} style={styles.sectionHeader} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {PROVIDER_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => update("providerType", type)}
                style={[styles.chip, form.providerType === type && styles.chipActive]}
              >
                <Text style={[styles.chipText, form.providerType === type && styles.chipTextActive]}>
                  {t(`customProviders.type_${type}`, { defaultValue: type.replace(/_/g, " ") })}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <SectionHeader label={t("common.description")} style={styles.sectionHeader} />
          <MoveCard style={styles.formCard} padding={14} radius={theme.radius.xl}>
            <Field label={t("common.description")} value={form.description} onChangeText={(v) => update("description", v)} multiline />
          </MoveCard>

          <SectionHeader label={t("common.contact")} style={styles.sectionHeader} />
          <MoveCard style={styles.formCard} padding={14} radius={theme.radius.xl}>
            <Field label={t("common.website")} value={form.website} onChangeText={(v) => update("website", v)} placeholder="https://..." keyboardType="url" autoCapitalize="none" />
            <Field label={t("common.phone")} value={form.phone} onChangeText={(v) => update("phone", v)} keyboardType="phone-pad" />
            <Field label={t("common.email")} value={form.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" />
          </MoveCard>

          <SectionHeader label="Location" style={styles.sectionHeader} />
          <MoveCard style={styles.formCard} padding={14} radius={theme.radius.xl}>
            <Field label={t("customProviders.addressLine1")} value={form.addressLine1} onChangeText={(v) => update("addressLine1", v)} />
            <Field label={t("customProviders.addressLine2")} value={form.addressLine2} onChangeText={(v) => update("addressLine2", v)} />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label={t("addresses.city")} value={form.city} onChangeText={(v) => update("city", v)} />
              </View>
              <View style={{ width: 88 }}>
                <Field label={t("addresses.state")} value={form.state} onChangeText={(v) => update("state", v)} autoCapitalize="characters" maxLength={2} />
              </View>
            </View>

            <Field label={t("addresses.zip")} value={form.zipCode} onChangeText={(v) => update("zipCode", v)} keyboardType="number-pad" maxLength={10} />
          </MoveCard>

          <SectionHeader label={t("customProviders.notes")} style={styles.sectionHeader} />
          <MoveCard style={styles.formCard} padding={14} radius={theme.radius.xl}>
            <Field label={t("customProviders.notes")} value={form.notes} onChangeText={(v) => update("notes", v)} multiline />
          </MoveCard>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={save}
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
                  <Text style={styles.saveText}>{t("customProviders.saveChanges")}</Text>
                </>
              )}
            </LinearGradient>
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
  // Field is rendered as a leaf inside EditCustomProviderScreen, so it
  // resolves the active theme and styles via the same provider rather
  // than reaching for the static dark `theme` import.
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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


const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  headerSaveBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentBorder,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 52 },
  hero: { marginBottom: 14 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 13 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.colors.faint,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
    marginTop: 3,
  },
  heroSub: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 3 },
  heroStats: { flexDirection: "row", gap: 8, marginBottom: 14 },
  heroStat: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  heroStatValue: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.text },
  heroStatLabel: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.6,
    color: theme.colors.faint,
    textTransform: "uppercase",
    marginTop: 3,
  },
  formCard: { marginBottom: 4 },
  sectionHeader: { marginTop: 20, marginBottom: 10, marginLeft: 2 },
  notice: {
    color: theme.colors.dim, fontSize: 13, fontFamily: fonts.sans, lineHeight: 20,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, padding: 12, marginBottom: 4,
  },
  label: { fontSize: 14, fontFamily: fonts.sansMedium, color: theme.colors.dim, marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.bg2, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.sans, color: theme.colors.text,
  },
  textArea: { minHeight: 86, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  chipRow: { gap: 8, paddingRight: 20 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    minHeight: 38, paddingHorizontal: 13, paddingVertical: 8, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
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
  saveText: { fontSize: 16, fontFamily: fonts.sansBold, color: theme.colors.onAccent },
});
