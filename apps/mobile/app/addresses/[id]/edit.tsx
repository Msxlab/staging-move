import React, { useEffect, useState, useMemo } from "react";
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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Check, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AddressAutocompleteField } from "@/components/address/address-autocomplete-field";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/address-autocomplete";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { HeroCard, MoveCard, SectionHeader } from "@/components/move";

const ADDRESS_TYPES = ["HOME", "WORK", "VACATION", "TEMPORARY", "STORAGE", "OTHER"] as const;
const OWNERSHIP_TYPES = ["OWNER", "RENTER", "FAMILY", "OTHER"] as const;

const ADDRESS_TYPE_LABEL_KEYS: Record<(typeof ADDRESS_TYPES)[number], string> = {
  HOME: "addresses.type_primary",
  WORK: "addresses.type_secondary",
  VACATION: "addresses.type_vacation",
  TEMPORARY: "addresses.type_temporary",
  STORAGE: "addresses.type_storage",
  OTHER: "addresses.type_other",
};

const OWNERSHIP_LABEL_KEYS: Record<(typeof OWNERSHIP_TYPES)[number], string> = {
  OWNER: "addresses.ownership_owner",
  RENTER: "addresses.ownership_renter",
  FAMILY: "addresses.ownership_family",
  OTHER: "addresses.type_other",
};

export default function EditAddressScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    formattedAddress: null as string | null,
    placeId: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
  });

  useEffect(() => {
    (async () => {
      const res = await api.get<any>(`/api/addresses/${id}`);
      if (res.data) {
        const a = res.data.address || res.data;
        setForm({
          type: a.type || "HOME",
          nickname: a.nickname || "",
          street: a.street || "",
          street2: a.street2 || "",
          city: a.city || "",
          state: a.state || "",
          zip: a.zip || "",
          country: a.country || "USA",
          ownership: a.ownership || "RENTER",
          isPrimary: a.isPrimary || false,
          formattedAddress: a.formattedAddress || null,
          placeId: a.placeId || null,
          latitude: a.latitude ?? null,
          longitude: a.longitude ?? null,
        });
      }
      setPageLoading(false);
    })();
  }, [id]);

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
    setSaving(true);
    const res = await api.patch(`/api/addresses/${id}`, form);
    setSaving(false);
    if (res.error) {
      hapticError();
      Alert.alert(t("common.retry"), res.error);
    } else {
      hapticSuccess();
      router.back();
    }
  };

  const selectedTypeLabel = t(ADDRESS_TYPE_LABEL_KEYS[form.type as (typeof ADDRESS_TYPES)[number]] || "addresses.type_primary");
  const requiredComplete = [form.street, form.city, form.state, form.zip].filter(Boolean).length;
  const placeLine = [form.city, form.state, form.zip].filter(Boolean).join(", ");

  if (pageLoading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("addresses.editTitle")}</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.headerSaveBtn, saving && { opacity: 0.55 }]}
          accessibilityRole="button"
          accessibilityLabel={t("addresses.update")}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.primary} size="small" />
          ) : (
            <Check size={17} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MapPin size={20} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroTitle} numberOfLines={1}>{form.nickname || selectedTypeLabel}</Text>
              <Text style={styles.heroMeta} numberOfLines={2}>
                {placeLine || form.street || t("addresses.editTitle")}
              </Text>
            </View>
          </View>
        </HeroCard>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1}>{requiredComplete}/4</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{t("addresses.street")}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1}>{t(OWNERSHIP_LABEL_KEYS[form.ownership as (typeof OWNERSHIP_TYPES)[number]] || "addresses.ownership_renter")}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{t("addresses.ownership")}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1}>{form.isPrimary ? "Yes" : "No"}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{t("addresses.primary")}</Text>
          </View>
        </View>

        <SectionHeader label={t("addresses.type")} style={styles.sectionHeader} />
        <View style={styles.chipRow}>
          {ADDRESS_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.chip, form.type === type && styles.chipActive]}
              onPress={() => update("type", type)}
            >
              <Text style={[styles.chipText, form.type === type && styles.chipTextActive]}>
                {t(ADDRESS_TYPE_LABEL_KEYS[type])}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <MoveCard style={styles.formCard} padding={14} radius={theme.radius.xl}>
          <Text style={styles.label}>{t("addresses.nickname")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("addresses.nicknameHint")}
            placeholderTextColor={theme.colors.faint}
            value={form.nickname}
            onChangeText={(v) => update("nickname", v)}
          />

          <AddressAutocompleteField
            label={t("addresses.street") + " *"}
            value={form.street}
            placeholder="123 Main Street"
            onValueChange={(value) => update("street", value)}
            onSelect={handleAutocompleteSelect}
          />

          <Text style={styles.label}>{t("addresses.street2")}</Text>
          <TextInput
            style={styles.input}
            placeholder="Apt 4B"
            placeholderTextColor={theme.colors.faint}
            value={form.street2}
            onChangeText={(v) => update("street2", v)}
          />

          <Text style={styles.label}>{t("addresses.city")} *</Text>
          <TextInput
            style={styles.input}
            placeholder="New York"
            placeholderTextColor={theme.colors.faint}
            value={form.city}
            onChangeText={(v) => update("city", v)}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t("addresses.state")} *</Text>
              <TextInput
                style={styles.input}
                placeholder="NY"
                placeholderTextColor={theme.colors.faint}
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
                placeholderTextColor={theme.colors.faint}
                value={form.zip}
                onChangeText={(v) => update("zip", v)}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>
        </MoveCard>

        <SectionHeader label={t("addresses.ownership")} style={styles.sectionHeader} />
        <View style={styles.chipRow}>
          {OWNERSHIP_TYPES.map((ownership) => (
            <TouchableOpacity
              key={ownership}
              style={[styles.chip, form.ownership === ownership && styles.chipActive]}
              onPress={() => update("ownership", ownership)}
            >
              <Text style={[styles.chipText, form.ownership === ownership && styles.chipTextActive]}>
                {t(OWNERSHIP_LABEL_KEYS[ownership])}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("addresses.primary")}</Text>
          <Switch
            value={form.isPrimary}
            onValueChange={(v) => update("isPrimary", v)}
            trackColor={{ false: theme.colors.track, true: theme.colors.primary }}
            thumbColor={theme.colors.text}
          />
        </View>

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
                <Text style={styles.saveBtnText}>{t("addresses.update")}</Text>
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
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
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
    marginBottom: 14,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
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
  heroTitle: { fontSize: 18, fontFamily: fonts.serifBold, color: theme.colors.text },
  heroMeta: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 3, lineHeight: 17 },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  statValue: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.text },
  statLabel: { marginTop: 3, fontSize: 9, fontFamily: fonts.sansBold, letterSpacing: 0.6, color: theme.colors.faint, textTransform: "uppercase" },
  sectionHeader: { marginTop: 20, marginBottom: 10, marginLeft: 2 },
  formCard: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14, fontFamily: fonts.sansMedium, color: theme.colors.dim, marginTop: 16, marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.bg2, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.sans, color: theme.colors.text,
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
    marginTop: 12, paddingVertical: 13, paddingHorizontal: 15,
    backgroundColor: theme.colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  switchLabel: { flex: 1, paddingRight: 12, fontSize: 15, fontFamily: fonts.sansSemibold, color: theme.colors.text },
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
