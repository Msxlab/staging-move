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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, MapPin, Check, Calendar, Sparkles } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { AddressAutocompleteField } from "@/components/address/address-autocomplete-field";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/address-autocomplete";
import { useAppTheme, useThemePreference, fonts, type Theme } from "@/lib/theme";
import { HeroCard, MoveCard, SectionHeader } from "@/components/move";
import { api } from "@/lib/api";
import { formatLocalDateKey } from "@/lib/date-only";
import { hapticError } from "@/lib/haptics";
import { UPSELL_GATE_CODES } from "@/lib/subscription-gate";
import { addressLimitForPlan, isHighestConsumerPlan } from "@/lib/plan-comparison";
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
  const insets = useSafeAreaInsets();
  // Drive the native date-picker wheel's text/background colors from the
  // active color scheme. A hardcoded "dark" themeVariant rendered near-white
  // wheel text that was invisible against the light-mode background.
  const { resolvedScheme } = useThemePreference();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [addressGate, setAddressGate] = useState<{ current: number; limit: number; plan: string | null } | null>(null);
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
    startDate: formatLocalDateKey(new Date()),
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
        plan,
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
      // Plan-limit / inactive-subscription gates carry a code. Turn those into
      // a clear access-review path instead of a generic "Try again" dead end.
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
  const addressAtTopTierLimit = addressLimitReached && isHighestConsumerPlan(addressGate?.plan);
  const addressLimitBody = () =>
    addressAtTopTierLimit
      ? t("addresses.safetyLimitWithCount", {
          current: addressGate?.current ?? 0,
          limit: addressGate?.limit ?? 0,
          defaultValue: `You've reached the safety limit of ${addressGate?.limit ?? 0} addresses for this account. Archive an old address or contact support if you need more.`,
        })
      : t("addresses.limitReachedWithCount", {
          current: addressGate?.current ?? 0,
          limit: addressGate?.limit ?? 0,
          defaultValue: `Your plan includes ${addressGate?.limit ?? 0} addresses. Upgrade to add more.`,
        });
  const showAddressLimitAlert = (message?: string) => {
    hapticError();
    Alert.alert(
      t("addresses.limitReachedTitle", { defaultValue: "Address limit reached" }),
      message || addressLimitBody(),
      addressAtTopTierLimit
        ? [{ text: t("common.ok", { defaultValue: "OK" }) }]
        : [
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
      <View style={styles.formShell}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          !addressLimitReached && styles.scrollContentWithFooter,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <EmailVerificationBanner context={t("addresses.title")} />

        {addressLimitReached ? (
          <MoveCard style={styles.limitCard} accent padding={16} radius={theme.radius.xl}>
            <View style={styles.limitRow}>
              <View style={styles.limitIcon}>
                <Sparkles size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.limitTitle}>
                  {t("addresses.limitReachedTitle", { defaultValue: "Address limit reached" })}
                </Text>
                <Text style={styles.limitBody}>
                  {addressLimitBody()}
                </Text>
                <TouchableOpacity
                  style={styles.limitCta}
                  onPress={() => addressAtTopTierLimit ? router.back() : router.push("/settings/subscription")}
                  activeOpacity={0.72}
                >
                  <Text style={styles.limitCtaText}>
                    {addressAtTopTierLimit
                      ? t("addresses.backToAddresses", { defaultValue: "Back to addresses" })
                      : t("subscription.upgrade", { defaultValue: "Upgrade" })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </MoveCard>
        ) : (
          <>
        <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <MapPin size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>ADDRESS COMMAND</Text>
              <Text style={styles.heroTitle} numberOfLines={1}>{form.nickname || selectedTypeLabel}</Text>
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
              <Text style={styles.heroStatValue} numberOfLines={1}>{form.ownership}</Text>
              <Text style={styles.heroStatLabel}>ownership</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{form.isPrimary ? "Yes" : "No"}</Text>
              <Text style={styles.heroStatLabel}>primary</Text>
            </View>
          </View>
        </HeroCard>

        {/* Type Selector */}
        <SectionHeader label={t("addresses.type")} style={styles.sectionHeader} />
        <MoveCard style={styles.formSection} padding={14} radius={theme.radius.xl}>
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
        </MoveCard>

        {/* Street */}
        <SectionHeader label={t("addresses.street", { defaultValue: "Location" })} style={styles.sectionHeader} />
        <MoveCard style={styles.formSection} padding={14} radius={theme.radius.xl}>
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
        </MoveCard>

        {/* Ownership */}
        <SectionHeader label={t("addresses.ownership")} style={styles.sectionHeader} />
        <MoveCard style={styles.formSection} padding={14} radius={theme.radius.xl}>
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
                  update("startDate", formatLocalDateKey(date));
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
              <Text style={{ fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.primary }}>{t("common.done")}</Text>
            </TouchableOpacity>
          )}

          {/* Primary Toggle */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("addresses.primary")}</Text>
            <Switch
              value={form.isPrimary}
              onValueChange={(v) => update("isPrimary", v)}
              trackColor={{ false: theme.colors.track, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
          </View>
        </MoveCard>
        </>
        )}
      </ScrollView>
      {!addressLimitReached && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={theme.colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnGrad}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.onAccent} />
            ) : (
              <>
                <Check size={18} color={theme.colors.onAccent} />
                <Text style={styles.saveBtnText}>{t("addresses.save")}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        </View>
      )}
      </View>
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
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
  formShell: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  scrollContentWithFooter: { paddingBottom: 136 },
  hero: {
    marginBottom: 16,
  },
  limitCard: {
    marginTop: 4,
  },
  limitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  limitIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  limitTitle: { fontSize: 16, fontFamily: fonts.serifBold, color: theme.colors.text },
  limitBody: { fontSize: 13, fontFamily: fonts.sans, color: theme.colors.dim, lineHeight: 19, marginTop: 4 },
  limitCta: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  limitCtaText: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.primary },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 10,
    fontFamily: fonts.sansBold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: theme.colors.primary,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
    marginTop: 3,
  },
  heroSub: {
    fontSize: 12,
    fontFamily: fonts.sans,
    color: theme.colors.dim,
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
    borderRadius: 14,
    padding: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  heroStatValue: {
    fontSize: 14,
    fontFamily: fonts.sansBold,
    color: theme.colors.text,
  },
  heroStatLabel: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.9,
    color: theme.colors.faint,
    textTransform: "uppercase",
    marginTop: 3,
  },
  formSection: {
    marginBottom: 6,
  },
  sectionHeader: { marginTop: 18, marginBottom: 10, marginLeft: 2 },
  label: {
    fontSize: 14, fontFamily: fonts.sansMedium, color: theme.colors.dim, marginTop: 16, marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.bg2, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.sans, color: theme.colors.text,
  },
  dateButton: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.colors.bg2, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
  },
  dateButtonText: {
    fontSize: 15, fontFamily: fonts.sans, color: theme.colors.text, flex: 1,
  },
  row: { flexDirection: "row", gap: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 38,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accentBorder,
  },
  chipText: { fontSize: 13, fontFamily: fonts.sansSemibold, color: theme.colors.dim },
  chipTextActive: { color: theme.colors.primary },
  switchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 16, paddingVertical: 13, paddingHorizontal: 15,
    backgroundColor: theme.colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  switchLabel: { flex: 1, paddingRight: 12, fontSize: 15, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  saveBtn: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  saveBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 16,
  },
  saveBtnText: { fontSize: 16, fontFamily: fonts.sansBold, color: theme.colors.onAccent },
});
