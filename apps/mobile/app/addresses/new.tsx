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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, MapPin, Check, Calendar } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { AddressAutocompleteField } from "@/components/address/address-autocomplete-field";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/address-autocomplete";
import { useAppTheme, useThemePreference, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { UPSELL_GATE_CODES } from "@/lib/subscription-gate";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";

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
        Alert.alert(
          t("subscription.upgradeTitle", { defaultValue: "Upgrade needed" }),
          res.error,
          [
            { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
            { text: t("subscription.upgrade", { defaultValue: "Upgrade" }), onPress: () => router.push("/settings/subscription") },
          ],
        );
      } else {
        Alert.alert(t("common.retry"), res.error);
      }
    } else {
      hapticSuccess();
      router.back();
    }
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

        {/* Type Selector */}
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

        {/* Street */}
        <AddressAutocompleteField
          label={t("addresses.street") + " *"}
          value={form.street}
          placeholder="123 Main Street"
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
          placeholder="New York"
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
              placeholder="NY"
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
              placeholder="10001"
              placeholderTextColor={theme.colors.textMuted}
              value={form.zip}
              onChangeText={(v) => update("zip", v)}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
        </View>

        {/* Ownership */}
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
      </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: theme.colors.primaryFaded, borderColor: "rgba(127, 182, 232,0.4)",
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
