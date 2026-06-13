import React, { useState, useMemo } from "react";
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
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, MapPin, Check, Calendar, Sparkles } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { AddressAutocompleteField } from "@/components/address/address-autocomplete-field";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/address-autocomplete";
import { useAppTheme, useThemePreference, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { hapticError } from "@/lib/haptics";
import { UPSELL_GATE_CODES } from "@/lib/subscription-gate";
import { addressLimitForPlan } from "@/lib/plan-comparison";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { SuccessToast } from "@/components/ui/SuccessToast";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

export default function NewAddressScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();
  // Drive the native date-picker wheel's text/background colors from the
  // active color scheme. A hardcoded "dark" themeVariant rendered near-white
  // wheel text that was invisible against the light-mode background.
  const { resolvedScheme } = useThemePreference();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [addressGate, setAddressGate] = useState<{ current: number; limit: number } | null>(null);
  // Success micro-moment: fire the raccoon toast on save, then go back when it
  // finishes so the user actually sees the loop close.
  const [showSuccess, setShowSuccess] = useState(false);

  // Address type + ownership option labels — built inside the component
  // so they re-compute when the user switches language mid-session.
  const ADDRESS_TYPES = [
    { value: "HOME", label: t("addresses.type_primary") },
    { value: "WORK", label: t("addresses.type_secondary") },
    { value: "VACATION", label: t("addresses.type_vacation") },
    { value: "TEMPORARY", label: t("addresses.type_temporary") },
    { value: "STORAGE", label: t("addresses.type_storage") },
    { value: "OTHER", label: t("addresses.type_other") },
  ];

  const OWNERSHIP_TYPES = [
    { value: "OWNER", label: t("addresses.ownership_owner") },
    { value: "RENTER", label: t("addresses.ownership_renter") },
    { value: "FAMILY", label: t("addresses.ownership_family") },
    { value: "OTHER", label: t("addresses.type_other") },
  ];
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [addressesRes, profileRes] = await Promise.all([
        api.get<any>("/api/addresses", { limit: "200" }),
        api.get<any>("/api/profile"),
      ]);
      if (cancelled) return;
      const plan =
        profileRes.data?.entitlement?.plan ||
        profileRes.data?.subscription?.plan ||
        "FREE_TRIAL";
      setAddressGate({
        current: addressesRes.data?.addresses?.length || 0,
        limit: addressLimitForPlan(plan),
      });
    })().catch(() => {
      if (!cancelled) setAddressGate(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (addressLimitReached) {
      showAddressLimitAlert();
      return;
    }
    if (!form.street || !form.city || !form.state || !form.zip) {
      Alert.alert(t("validation.missingFields"), t("addresses.errorRequiredFields"));
      return;
    }
    if (form.state.length !== 2) {
      Alert.alert(t("validation.invalidState"), t("addresses.errorStateFormat"));
      return;
    }
    if (!/^\d{5}(-\d{4})?$/.test(form.zip)) {
      Alert.alert(t("validation.invalidZip"), t("addresses.errorZipFormat"));
      return;
    }
    setLoading(true);
    // USPS address validation (Tier 2) — silently skipped unless the account is
    // entitled AND USPS is configured. A standardized correction is offered as a
    // choice; it NEVER blocks the save (fail-open).
    let payload: typeof form = form;
    try {
      const v = await api.post<any>("/api/addresses/validate", {
        street1: form.street,
        street2: form.street2 || null,
        city: form.city,
        state: form.state,
        zip: form.zip,
      });
      const s = v.data;
      if (s?.enabled && s.status === "CORRECTED" && s.suggestion) {
        const sug = s.suggestion;
        const line = `${sug.street1}${sug.street2 ? ", " + sug.street2 : ""}\n${sug.city}, ${sug.state} ${sug.zipPlus4 ? `${sug.zip}-${sug.zipPlus4}` : sug.zip}`;
        const useIt = await new Promise<boolean>((resolve) => {
          Alert.alert(
            t("addresses.uspsSuggestTitle", { defaultValue: "USPS standardized your address" }),
            line,
            [
              { text: t("addresses.uspsKeepMine", { defaultValue: "Keep mine" }), style: "cancel", onPress: () => resolve(false) },
              { text: t("addresses.uspsUseIt", { defaultValue: "Use USPS version" }), onPress: () => resolve(true) },
            ],
            { cancelable: false },
          );
        });
        if (useIt) {
          payload = {
            ...form,
            street: sug.street1,
            street2: sug.street2 || form.street2,
            city: sug.city,
            state: sug.state,
            zip: sug.zipPlus4 ? `${sug.zip}-${sug.zipPlus4}` : sug.zip,
          };
          setForm(payload);
        }
      }
    } catch {
      // fail open — address validation must never block saving
    }
    const res = await api.post("/api/addresses", payload);
    setLoading(false);
    if (res.error) {
      hapticError();
      // Plan-limit / inactive-subscription gates carry a code + an upgrade
      // message — turn those into an upsell with an Upgrade button instead of a
      // generic "Try again" that dead-ends the user.
      if (res.code && UPSELL_GATE_CODES.includes(res.code)) {
        showAddressLimitAlert(res.error);
      } else {
        Alert.alert(t("common.retry"), res.error);
      }
    } else {
      // SuccessToast fires hapticSuccess itself; navigate back when it hides.
      setShowSuccess(true);
    }
  };

  const selectedTypeLabel =
    ADDRESS_TYPES.find((type) => type.value === form.type)?.label || t("addresses.type_primary");
  const requiredComplete = [form.street, form.city, form.state, form.zip].filter(Boolean).length;
  const placeLine = [form.city, form.state, form.zip].filter(Boolean).join(", ");
  const heroSubline = placeLine || t("addresses.newDescription", {
    defaultValue: "Add a real address so providers, reminders, and local details match the right place.",
  });
  const addressLimitReached = addressGate != null && addressGate.current >= addressGate.limit;
  const showAddressLimitAlert = (message?: string) => {
    hapticError();
    Alert.alert(
      t("addresses.limitReachedTitle", { defaultValue: "Address limit reached" }),
      message ||
        t("addresses.limitReachedWithCount", {
          current: addressGate?.current ?? 0,
          limit: addressGate?.limit ?? 0,
          defaultValue: `Your plan includes ${addressGate?.limit ?? 0} addresses. Upgrade to add more.`,
        }),
      [
        { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
        { text: t("subscription.upgrade", { defaultValue: "Upgrade" }), onPress: () => router.push("/settings/subscription") },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("addresses.newTitle")}</Text>
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
        <EmailVerificationBanner context={t("addresses.title")} />

        {addressLimitReached ? (
          <View style={styles.limitCard}>
            <View style={styles.limitIcon}>
              <Sparkles size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.limitTitle}>
                {t("addresses.limitReachedTitle", { defaultValue: "Address limit reached" })}
              </Text>
              <Text style={styles.limitBody}>
                {t("addresses.limitReachedWithCount", {
                  current: addressGate?.current ?? 0,
                  limit: addressGate?.limit ?? 0,
                  defaultValue: `Your plan includes ${addressGate?.limit ?? 0} addresses. Upgrade to add more.`,
                })}
              </Text>
              <TouchableOpacity
                style={styles.limitCta}
                onPress={() => router.push("/settings/subscription")}
                activeOpacity={0.72}
              >
                <Text style={styles.limitCtaText}>{t("subscription.upgrade", { defaultValue: "Upgrade" })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <MapPin size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>ADDRESS COMMAND</Text>
              <Text style={styles.heroTitle}>{form.nickname || selectedTypeLabel}</Text>
              <Text style={styles.heroSub} numberOfLines={2}>
                {heroSubline}
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{requiredComplete}/4</Text>
              <Text style={styles.heroStatLabel}>fields</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{form.ownership}</Text>
              <Text style={styles.heroStatLabel}>ownership</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{form.isPrimary ? "Yes" : "No"}</Text>
              <Text style={styles.heroStatLabel}>primary</Text>
            </View>
          </View>
        </View>

        {/* Type Selector */}
        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>{t("addresses.type")}</Text>
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
          <Text style={styles.label}>{t("addresses.nickname")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("addresses.nicknameHint")}
            placeholderTextColor={theme.colors.textMuted}
            value={form.nickname}
            onChangeText={(v) => update("nickname", v)}
          />
        </View>

        {/* Street */}
        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Location</Text>
          <AddressAutocompleteField
            label={t("addresses.street") + " *"}
            value={form.street}
            placeholder={t("addresses.streetPlaceholder", { defaultValue: "Street address" })}
            onValueChange={(value) => update("street", value)}
            onSelect={handleAutocompleteSelect}
          />

          {/* Street 2 */}
          <Text style={styles.label}>{t("addresses.street2")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("addresses.street2")}
            placeholderTextColor={theme.colors.textMuted}
            value={form.street2}
            onChangeText={(v) => update("street2", v)}
          />

          {/* City */}
          <Text style={styles.label}>{t("addresses.city")} *</Text>
          <TextInput
            style={styles.input}
            placeholder={t("addresses.cityPlaceholder", { defaultValue: "City" })}
            placeholderTextColor={theme.colors.textMuted}
            value={form.city}
            onChangeText={(v) => update("city", v)}
          />

          {/* State + ZIP row */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t("addresses.state")} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t("addresses.statePlaceholder", { defaultValue: "ST" })}
                placeholderTextColor={theme.colors.textMuted}
                value={form.state}
                onChangeText={(v) => update("state", v.toUpperCase().slice(0, 2))}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t("addresses.zip")} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t("addresses.zipPlaceholder", { defaultValue: "ZIP code" })}
                placeholderTextColor={theme.colors.textMuted}
                value={form.zip}
                onChangeText={(v) => update("zip", v)}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>
        </View>

        {/* Ownership */}
        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>{t("addresses.ownership")}</Text>
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
          <Text style={styles.label}>{t("addresses.startDate")}</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Calendar size={16} color={theme.colors.primary} />
            <Text style={[styles.dateButtonText, { color: theme.colors.text }]}>
              {selectedStartDate.toLocaleDateString(i18n.language || "en", { month: "long", day: "numeric", year: "numeric" })}
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
              themeVariant={resolvedScheme}
              textColor={theme.colors.text}
            />
          )}
          {Platform.OS === "ios" && showDatePicker && (
            <TouchableOpacity
              style={{ alignSelf: "flex-end", marginTop: 4 }}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: theme.colors.primary }}>{t("common.done")}</Text>
            </TouchableOpacity>
          )}

          {/* Primary Toggle */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("addresses.primary")}</Text>
            <Switch
              value={form.isPrimary}
              onValueChange={(v) => update("isPrimary", v)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>
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
              <Text style={styles.saveBtnText}>{t("addresses.save")}</Text>
            </>
          )}
        </TouchableOpacity>
        </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
      <SuccessToast
        visible={showSuccess}
        message={t("addresses.savedToast", { defaultValue: "Address added" })}
        detail={t("addresses.savedToastDetail", { defaultValue: "Nice — that's one more place set up." })}
        onHide={() => {
          setShowSuccess(false);
          router.back();
        }}
      />
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 160 },
  hero: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
    ...theme.shadow.sm,
  },
  limitCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 20,
    padding: 16,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  limitIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.primary + "33",
  },
  limitTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  limitBody: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginTop: 4 },
  limitCta: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
  },
  limitCtaText: { fontSize: 13, fontWeight: "800", color: "#fff" },
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
    lineHeight: 17,
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
  heroStatLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.9,
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
  sectionLabel: {
    fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.8, marginTop: 0, marginBottom: 10,
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
    backgroundColor: theme.colors.primaryFaded, borderColor: theme.colors.borderFocus,
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
