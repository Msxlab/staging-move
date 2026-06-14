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
  Switch,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  InputAccessoryView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Check, MapPin, ArrowRight, Calendar } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { AddressAutocompleteField } from "@/components/address/address-autocomplete-field";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/address-autocomplete";
import { useTranslation } from "react-i18next";
import { useAppTheme, useThemePreference, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { formatLocalDateKey } from "@/lib/date-only";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { UPSELL_GATE_CODES } from "@/lib/subscription-gate";

type DestinationMode = "existing" | "new";
const MOVING_KEYBOARD_ACCESSORY_ID = "moving-plan-keyboard-done";

type AddressOption = {
  id: string;
  nickname?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isPrimary?: boolean;
};

export default function NewMovingPlanScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useThemePreference();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const params = useLocalSearchParams<{ fromAddressId?: string }>();
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [form, setForm] = useState({
    // Seeded when arriving from an address's "Move out" CTA so the origin is
    // pre-selected; the loader effect falls back to the primary address.
    fromAddressId: typeof params.fromAddressId === "string" ? params.fromAddressId : "",
    destinationMode: "new" as DestinationMode,
    toAddressId: "",
    destinationNickname: "",
    destinationStreet: "",
    destinationCity: "",
    destinationState: "",
    destinationZip: "",
    destinationCountry: "USA",
    destinationFormattedAddress: null as string | null,
    destinationPlaceId: null as string | null,
    destinationLatitude: null as number | null,
    destinationLongitude: null as number | null,
    moveDate: "",
    isTemporary: false,
    estimatedDuration: "",
  });

  useEffect(() => {
    (async () => {
      const res = await api.get<any>("/api/addresses");
      if (!res.data) return;

      const addrs = res.data.addresses || [];
      setAddresses(addrs);
      setForm((prev) => {
        const defaultFromAddress = addrs.find((addr: AddressOption) => addr.isPrimary) || addrs[0];
        const fromAddressId = prev.fromAddressId || defaultFromAddress?.id || "";
        const availableDestinations = addrs.filter((addr: AddressOption) => addr.id !== fromAddressId);
        const destinationMode = availableDestinations.length > 0 ? "existing" : "new";
        return {
          ...prev,
          fromAddressId,
          destinationMode,
          toAddressId: destinationMode === "existing" ? availableDestinations[0]?.id || "" : "",
        };
      });
    })();
  }, []);

  useEffect(() => {
    const availableDestinations = addresses.filter((addr) => addr.id !== form.fromAddressId);
    if (form.destinationMode === "existing" && availableDestinations.length === 0) {
      setForm((prev) => ({ ...prev, destinationMode: "new", toAddressId: "" }));
      return;
    }

    if (
      form.destinationMode === "existing"
      && (!form.toAddressId || form.toAddressId === form.fromAddressId || !availableDestinations.some((addr) => addr.id === form.toAddressId))
    ) {
      setForm((prev) => ({ ...prev, toAddressId: availableDestinations[0]?.id || "" }));
    }
  }, [addresses, form.destinationMode, form.fromAddressId, form.toAddressId]);

  const availableDestinationAddresses = addresses.filter((addr) => addr.id !== form.fromAddressId);

  const clearDestinationAutocompleteState = (value: typeof form) => {
    const normalized = clearAddressAutocompleteMetadata({
      street: value.destinationStreet,
      city: value.destinationCity,
      state: value.destinationState,
      zip: value.destinationZip,
      country: value.destinationCountry,
      formattedAddress: value.destinationFormattedAddress,
      placeId: value.destinationPlaceId,
      latitude: value.destinationLatitude,
      longitude: value.destinationLongitude,
    });

    return {
      ...value,
      destinationStreet: normalized.street,
      destinationCity: normalized.city,
      destinationState: normalized.state,
      destinationZip: normalized.zip,
      destinationCountry: normalized.country || "USA",
      destinationFormattedAddress: normalized.formattedAddress,
      destinationPlaceId: normalized.placeId,
      destinationLatitude: normalized.latitude,
      destinationLongitude: normalized.longitude,
    };
  };

  const update = (field: string, value: string | boolean | number | null) =>
    setForm((prev) => {
      if (field === "fromAddressId") {
        const nextFromAddressId = value as string;
        const nextDestinations = addresses.filter((addr) => addr.id !== nextFromAddressId);
        return {
          ...prev,
          fromAddressId: nextFromAddressId,
          toAddressId: prev.destinationMode === "existing"
            ? nextDestinations.find((addr) => addr.id === prev.toAddressId)?.id || nextDestinations[0]?.id || ""
            : "",
          destinationMode: nextDestinations.length === 0 ? "new" : prev.destinationMode,
        };
      }

      if (field === "destinationStreet" || field === "destinationCity" || field === "destinationState" || field === "destinationZip") {
        return clearDestinationAutocompleteState({ ...prev, [field]: value });
      }

      return { ...prev, [field]: value };
    });

  const openDatePicker = () => {
    Keyboard.dismiss();
    if (Platform.OS === "ios") {
      setTimeout(() => setShowDatePicker(true), 80);
    } else {
      setShowDatePicker(true);
    }
  };

  const handleDestinationAutocompleteSelect = (result: AddressAutocompleteResult) => {
    setForm((prev) => {
      const next = applyAddressAutocompleteResult({
        street: prev.destinationStreet,
        city: prev.destinationCity,
        state: prev.destinationState,
        zip: prev.destinationZip,
        country: prev.destinationCountry,
        formattedAddress: prev.destinationFormattedAddress,
        placeId: prev.destinationPlaceId,
        latitude: prev.destinationLatitude,
        longitude: prev.destinationLongitude,
      }, result);

      return {
        ...prev,
        destinationStreet: next.street,
        destinationCity: next.city,
        destinationState: next.state,
        destinationZip: next.zip,
        destinationCountry: next.country || "USA",
        destinationFormattedAddress: next.formattedAddress,
        destinationPlaceId: next.placeId,
        destinationLatitude: next.latitude,
        destinationLongitude: next.longitude,
      };
    });
  };

  const getLabel = (id: string) => {
    const a = addresses.find((addr) => addr.id === id);
    if (!a) return t("common.select");
    return a.nickname || `${a.city}, ${a.state}`;
  };

  const getDestinationPreview = () => {
    if (form.destinationMode === "existing") {
      return getLabel(form.toAddressId);
    }
    if (!form.destinationCity && !form.destinationState) return t("moving.newDestination");
    return `${form.destinationCity || t("moving.destination")}${form.destinationState ? `, ${form.destinationState}` : ""}`;
  };
  const originPreview = form.fromAddressId ? getLabel(form.fromAddressId) : t("moving.fromAddress");
  const destinationPreview = getDestinationPreview();
  const moveDatePreview = selectedDate
    ? selectedDate.toLocaleDateString(i18n.language || "en", { month: "short", day: "numeric" })
    : t("moving.moveDate");
  const routeReady =
    Boolean(form.fromAddressId) &&
    Boolean(form.moveDate) &&
    (form.destinationMode === "existing" ? Boolean(form.toAddressId) : Boolean(form.destinationCity && form.destinationState && form.destinationZip));

  const handleSave = async () => {
    if (!form.fromAddressId || !form.moveDate) {
      Alert.alert(t("validation.missingFields"), t("moving.errorOriginAndDateRequired"));
      return;
    }
    if (form.destinationMode === "existing" && !form.toAddressId) {
      Alert.alert(t("validation.missingFields"), t("moving.errorDestinationSelectRequired"));
      return;
    }
    if (form.destinationMode === "new") {
      if (!form.destinationCity.trim() || !form.destinationState.trim() || !form.destinationZip.trim()) {
        Alert.alert(t("validation.missingFields"), t("moving.errorDestinationRequired"));
        return;
      }
      if (form.destinationState.trim().length !== 2) {
        Alert.alert(t("validation.invalidState"), t("moving.errorDestinationStateFormat"));
        return;
      }
    }

    setSaving(true);
    const payload: any = {
      fromAddressId: form.fromAddressId,
      moveDate: form.moveDate,
      isTemporary: form.isTemporary,
    };

    if (form.estimatedDuration) {
      payload.estimatedDuration = parseInt(form.estimatedDuration) || undefined;
    }

    if (form.destinationMode === "existing") {
      payload.toAddressId = form.toAddressId;
    } else {
      const destinationCity = form.destinationCity.trim();
      const destinationState = form.destinationState.trim().toUpperCase();
      payload.destinationAddress = {
        nickname: form.destinationNickname.trim() || `${destinationCity}, ${destinationState}`,
        street: form.destinationStreet.trim() || `${destinationCity}, ${destinationState}`,
        city: destinationCity,
        state: destinationState,
        zip: form.destinationZip.trim(),
        country: form.destinationCountry || "USA",
        type: "HOME",
        ownership: "RENTER",
        isPrimary: false,
        startDate: form.moveDate,
        formattedAddress: form.destinationFormattedAddress,
        placeId: form.destinationPlaceId,
        latitude: form.destinationLatitude,
        longitude: form.destinationLongitude,
      };
    }

    const res = await api.post<any>("/api/moving", payload);
    setSaving(false);
    if (res.error) {
      hapticError();
      // FREEMIUM: the moving plan is a paid unlock. A FREE user reaching this
      // screen (e.g. via Quick Actions) gets MOVING_PLAN_UPGRADE_REQUIRED - show
      // the Upgrade affordance instead of a confusing generic "Retry" alert.
      if (res.code && UPSELL_GATE_CODES.includes(res.code)) {
        Alert.alert(
          t("subscription.upgradeTitle", { defaultValue: "Unlock your move plan" }),
          t("moving.upgradeRequiredBody", {
            defaultValue:
              "The full moving plan - personalized checklist, countdown, and tracking - unlocks with Individual.",
          }),
          [
            { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
            { text: t("subscription.upgrade", { defaultValue: "Upgrade" }), onPress: () => router.push("/settings/subscription") },
          ],
        );
        return;
      }
      Alert.alert(t("common.retry"), res.error);
      return;
    }

    const planId = res.data?.plan?.id;
    if (!planId) {
      hapticError();
      Alert.alert(t("common.retry"), t("moving.errorPlanCreateFailed"));
      return;
    }

    hapticSuccess();
    router.replace({ pathname: "/moving/[id]", params: { id: planId } });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("moving.newPlan")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <View style={styles.formShell}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            addresses.length > 0 && styles.scrollContentWithFooter,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <MapPin size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroKicker}>MOVE COMMAND</Text>
                <Text style={styles.heroTitle} numberOfLines={1}>{t("moving.newPlan")}</Text>
                <Text style={styles.heroSub} numberOfLines={1}>
                  {originPreview} to {destinationPreview}
                </Text>
              </View>
            </View>
            <View style={styles.heroRoute}>
              <Text style={styles.heroRouteText} numberOfLines={1}>{originPreview}</Text>
              <ArrowRight size={16} color={theme.colors.primary} />
              <Text style={styles.heroRouteText} numberOfLines={1}>{destinationPreview}</Text>
            </View>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{addresses.length}</Text>
                <Text style={styles.heroStatLabel}>addresses</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{moveDatePreview}</Text>
                <Text style={styles.heroStatLabel}>date</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, routeReady && styles.heroStatReady]}>
                  {routeReady ? "Ready" : "Draft"}
                </Text>
                <Text style={styles.heroStatLabel}>status</Text>
              </View>
            </View>
          </View>

          {addresses.length === 0 ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                {t("addresses.emptyDescription")}
              </Text>
              <TouchableOpacity
                style={styles.warningBtn}
                onPress={() => router.push("/addresses/new")}
              >
                <Text style={styles.warningBtnText}>{t("addresses.newTitle")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.formSection}>
              {/* From Address */}
              <Text style={styles.sectionLabel}>{t("moving.fromAddress")} *</Text>
              <View style={styles.chipRow}>
                {addresses.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.chip, form.fromAddressId === a.id && styles.chipActive]}
                    onPress={() => update("fromAddressId", a.id)}
                  >
                    <MapPin size={14} color={form.fromAddressId === a.id ? theme.colors.primary : theme.colors.textMuted} />
                    <Text style={[styles.chipText, form.fromAddressId === a.id && styles.chipTextActive]}>
                      {a.nickname || `${a.city}, ${a.state}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Arrow */}
              {form.fromAddressId && (form.destinationMode === "existing" ? form.toAddressId : form.destinationCity || form.destinationState) ? (
                <View style={styles.arrowRow}>
                  <Text style={styles.arrowLabel} numberOfLines={1}>{getLabel(form.fromAddressId)}</Text>
                  <ArrowRight size={18} color={theme.colors.primary} />
                  <Text style={styles.arrowLabel} numberOfLines={1}>{getDestinationPreview()}</Text>
                </View>
              ) : null}

              {/* To Address */}
              <Text style={styles.sectionLabel}>{t("moving.toAddress")} *</Text>
              {availableDestinationAddresses.length > 0 ? (
                <View style={styles.modeRow}>
                  <TouchableOpacity
                    style={[styles.modeButton, form.destinationMode === "existing" && styles.modeButtonActive]}
                    onPress={() => update("destinationMode", "existing")}
                  >
                    <Text style={[styles.modeButtonText, form.destinationMode === "existing" && styles.modeButtonTextActive]}>{t("addresses.title")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeButton, form.destinationMode === "new" && styles.modeButtonActive]}
                    onPress={() => update("destinationMode", "new")}
                  >
                    <Text style={[styles.modeButtonText, form.destinationMode === "new" && styles.modeButtonTextActive]}>{t("addresses.newTitle")}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.helperText}>{t("addresses.newTitle")}</Text>
              )}

              {form.destinationMode === "existing" && availableDestinationAddresses.length > 0 ? (
                <View style={styles.chipRow}>
                  {availableDestinationAddresses.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.chip, form.toAddressId === a.id && styles.chipActive]}
                      onPress={() => update("toAddressId", a.id)}
                    >
                      <MapPin size={14} color={form.toAddressId === a.id ? theme.colors.primary : theme.colors.textMuted} />
                      <Text style={[styles.chipText, form.toAddressId === a.id && styles.chipTextActive]}>
                        {a.nickname || `${a.city}, ${a.state}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.inlineDestinationCard}>
                  <Text style={styles.label}>{t("addresses.nickname")}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t("addresses.nicknameHint")}
                    placeholderTextColor={theme.colors.textMuted}
                    value={form.destinationNickname}
                    onChangeText={(v) => update("destinationNickname", v)}
                    inputAccessoryViewID={MOVING_KEYBOARD_ACCESSORY_ID}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />

                  <AddressAutocompleteField
                    label={t("addresses.street")}
                    value={form.destinationStreet}
                    placeholder={t("addresses.street")}
                    onValueChange={(value) => update("destinationStreet", value)}
                    onSelect={handleDestinationAutocompleteSelect}
                  />

                  <Text style={styles.label}>{t("addresses.city")} *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t("addresses.city")}
                    placeholderTextColor={theme.colors.textMuted}
                    value={form.destinationCity}
                    onChangeText={(v) => update("destinationCity", v)}
                    inputAccessoryViewID={MOVING_KEYBOARD_ACCESSORY_ID}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />

                  <View style={styles.rowFields}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>{t("addresses.state")} *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder={t("addresses.state")}
                        placeholderTextColor={theme.colors.textMuted}
                        value={form.destinationState}
                        onChangeText={(v) => update("destinationState", v.toUpperCase().slice(0, 2))}
                        maxLength={2}
                        autoCapitalize="characters"
                        inputAccessoryViewID={MOVING_KEYBOARD_ACCESSORY_ID}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={() => Keyboard.dismiss()}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>{t("addresses.zip")} *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder={t("addresses.zip")}
                        placeholderTextColor={theme.colors.textMuted}
                        value={form.destinationZip}
                        onChangeText={(v) => update("destinationZip", v)}
                        keyboardType="number-pad"
                        inputAccessoryViewID={MOVING_KEYBOARD_ACCESSORY_ID}
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={() => Keyboard.dismiss()}
                      />
                    </View>
                  </View>
                </View>
              )}
              </View>

              <View style={styles.formSection}>
              {/* Move Date */}
              <Text style={styles.label}>{t("moving.moveDate")} *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={openDatePicker}
                activeOpacity={0.7}
              >
                <Calendar size={16} color={selectedDate ? theme.colors.primary : theme.colors.textMuted} />
                <Text style={[styles.dateButtonText, selectedDate && { color: theme.colors.text }]}> 
                  {selectedDate
                    ? selectedDate.toLocaleDateString(i18n.language || "en", { weekday: "short", month: "long", day: "numeric", year: "numeric" })
                    : t("moving.datePlaceholder")}
                </Text>
              </TouchableOpacity>
              {showDatePicker && Platform.OS === "ios" ? (
                <View style={styles.datePickerPanel}>
                  <View style={styles.datePickerToolbar}>
                    <Text style={styles.datePickerTitle}>{t("moving.moveDate")}</Text>
                    <TouchableOpacity
                      style={styles.datePickerDone}
                      onPress={() => setShowDatePicker(false)}
                      accessibilityRole="button"
                      accessibilityLabel={t("common.done")}
                    >
                      <Text style={styles.datePickerDoneText}>{t("common.done")}</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={selectedDate || new Date()}
                    mode="date"
                    display="spinner"
                    minimumDate={new Date()}
                    onChange={(_event: any, date?: Date) => {
                      if (date) {
                        setSelectedDate(date);
                        update("moveDate", formatLocalDateKey(date));
                      }
                    }}
                    themeVariant={resolvedScheme}
                    textColor={theme.colors.text}
                  />
                </View>
              ) : showDatePicker ? (
                <DateTimePicker
                  value={selectedDate || new Date()}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(_event: any, date?: Date) => {
                    setShowDatePicker(false);
                    if (date) {
                      setSelectedDate(date);
                      update("moveDate", formatLocalDateKey(date));
                    }
                  }}
                  themeVariant={resolvedScheme}
                  textColor={theme.colors.text}
                />
              ) : null}

              {/* Temporary Toggle */}
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("moving.temporaryMove")}</Text>
                <Switch
                  value={form.isTemporary}
                  onValueChange={(v) => update("isTemporary", v)}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              {form.isTemporary && (
                <>
                  <Text style={styles.label}>{t("moving.estimatedDurationDays")}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t("moving.estimatedDurationPlaceholder")}
                    placeholderTextColor={theme.colors.textMuted}
                    value={form.estimatedDuration}
                    onChangeText={(v) => update("estimatedDuration", v)}
                    keyboardType="number-pad"
                    inputAccessoryViewID={MOVING_KEYBOARD_ACCESSORY_ID}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                </>
              )}
              </View>
            </>
          )}
        </ScrollView>
        {addresses.length > 0 && (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            {/* Save */}
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
                  <Text style={styles.saveBtnText}>{t("moving.createPlan")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
        </View>
      </KeyboardAvoidingView>
      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={MOVING_KEYBOARD_ACCESSORY_ID}>
          <View style={styles.keyboardAccessory}>
            <TouchableOpacity
              onPress={() => Keyboard.dismiss()}
              style={styles.keyboardDoneButton}
              accessibilityRole="button"
              accessibilityLabel={t("common.done")}
            >
              <Text style={styles.keyboardDoneText}>{t("common.done")}</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
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
  formShell: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  scrollContentWithFooter: { paddingBottom: 136 },
  hero: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
    ...theme.shadow.sm,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
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
    letterSpacing: 0,
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
  heroSub: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 3 },
  heroRoute: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heroRouteText: { flex: 1, fontSize: 12, fontWeight: "700", color: theme.colors.text, textAlign: "center" },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 10 },
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
  heroStatValue: { fontSize: 13, fontWeight: "800", color: theme.colors.text },
  heroStatReady: { color: theme.colors.emerald.text },
  heroStatLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0,
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
    textTransform: "uppercase", letterSpacing: 0, marginTop: 0, marginBottom: 10,
  },
  helperText: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 10 },
  label: {
    fontSize: 14, fontWeight: "500", color: theme.colors.textSecondary, marginTop: 16, marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: theme.colors.text,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  keyboardAccessory: {
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  keyboardDoneButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.primaryFaded,
  },
  keyboardDoneText: { fontSize: 14, fontWeight: "800", color: theme.colors.primary },
  dateButton: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: 14,
  },
  dateButtonText: {
    fontSize: 15, color: theme.colors.textMuted, flex: 1,
  },
  datePickerPanel: {
    marginTop: 10,
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  datePickerToolbar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  datePickerTitle: { fontSize: 13, fontWeight: "800", color: theme.colors.textSecondary },
  datePickerDone: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
  },
  datePickerDoneText: { fontSize: 13, fontWeight: "800", color: theme.colors.primary },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primaryFaded, borderColor: theme.colors.borderFocus,
  },
  chipText: { fontSize: 13, fontWeight: "500", color: theme.colors.textTertiary },
  chipTextActive: { color: theme.colors.primary },
  arrowRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  arrowLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: theme.colors.text, textAlign: "center" },
  modeRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: theme.colors.primaryFaded,
    borderColor: theme.colors.borderFocus,
  },
  modeButtonText: { fontSize: 12, fontWeight: "600", color: theme.colors.textTertiary, textAlign: "center" },
  modeButtonTextActive: { color: theme.colors.primary },
  inlineDestinationCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowFields: { flexDirection: "row", gap: 12 },
  switchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 20, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  switchLabel: { fontSize: 15, fontWeight: "500", color: theme.colors.text },
  warningBox: {
    alignItems: "center", padding: 24,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: theme.colors.border, marginTop: 20,
  },
  warningText: { fontSize: 14, color: theme.colors.textTertiary, textAlign: "center", marginBottom: 16 },
  warningBtn: {
    backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
  },
  warningBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    paddingVertical: 16, ...theme.shadow.glow,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
