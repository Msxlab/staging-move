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
import { ArrowLeft, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { AddressAutocompleteField } from "@/components/address/address-autocomplete-field";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/address-autocomplete";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";

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

  if (pageLoading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("addresses.editTitle")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.sectionLabel}>{t("addresses.type")}</Text>
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

        <Text style={styles.label}>{t("addresses.nickname")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("addresses.nicknameHint")}
          placeholderTextColor={theme.colors.textMuted}
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
          placeholderTextColor={theme.colors.textMuted}
          value={form.street2}
          onChangeText={(v) => update("street2", v)}
        />

        <Text style={styles.label}>{t("addresses.city")} *</Text>
        <TextInput
          style={styles.input}
          placeholder="New York"
          placeholderTextColor={theme.colors.textMuted}
          value={form.city}
          onChangeText={(v) => update("city", v)}
        />

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

        <Text style={styles.sectionLabel}>{t("addresses.ownership")}</Text>
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
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

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
              <Text style={styles.saveBtnText}>{t("addresses.update")}</Text>
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
