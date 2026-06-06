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
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const FAMILY_STATUS_VALUES = ["SINGLE", "COUPLE", "FAMILY", "OTHER"] as const;
const MOVE_TYPES = ["PERSONAL", "BUSINESS", "VACATION", "MILITARY"] as const;
const IMMIGRATION_STATUSES = ["", "CITIZEN", "GREEN_CARD", "H1B", "L1", "F1", "OTHER_VISA"] as const;

export default function ProfileSettingsScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Family-status labels re-compute when the user flips language mid-session.
  const FAMILY_STATUSES: Array<{ value: (typeof FAMILY_STATUS_VALUES)[number]; label: string }> = [
    { value: "SINGLE", label: t("settings.familyStatus_SINGLE") },
    { value: "COUPLE", label: t("settings.familyStatus_COUPLE") },
    { value: "FAMILY", label: t("settings.familyStatus_FAMILY") },
    { value: "OTHER", label: t("settings.familyStatus_OTHER") },
  ];
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    ageRange: "",
    familyStatus: "SINGLE",
    hasChildren: false,
    childrenCount: 0,
    hasPets: false,
    petTypes: [] as string[],
    carCount: 0,
    hasMotorcycle: false,
    hasBoatRV: false,
    needsStorage: false,
    hasSenior: false,
    hasDisability: false,
    moveType: "PERSONAL",
    isBusinessOwner: false,
    isImmigrant: false,
    immigrationStatus: "",
  });

  useEffect(() => {
    (async () => {
      const res = await api.get<any>("/api/profile");
      if (res.error) {
        setLoadError(t("settings.profile_unavailable"));
        setPageLoading(false);
        return;
      }
      if (res.data) {
        const u = res.data.user || {};
        const p = res.data.profile || {};
        setForm({
          firstName: u.firstName || "",
          lastName: u.lastName || "",
          ageRange: p.ageRange || "",
          familyStatus: p.familyStatus || "SINGLE",
          hasChildren: p.hasChildren || false,
          childrenCount: p.childrenCount || 0,
          hasPets: p.hasPets || false,
          petTypes: Array.isArray(p.petTypes) ? p.petTypes : [],
          carCount: p.carCount || 0,
          hasMotorcycle: p.hasMotorcycle || false,
          hasBoatRV: p.hasBoatRV || false,
          needsStorage: p.needsStorage || false,
          hasSenior: p.hasSenior || false,
          hasDisability: p.hasDisability || false,
          moveType: p.moveType || "PERSONAL",
          isBusinessOwner: p.isBusinessOwner || false,
          isImmigrant: p.isImmigrant || false,
          immigrationStatus: p.immigrationStatus || "",
        });
      }
      setPageLoading(false);
    })();
  }, [t]);

  const update = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      Alert.alert(t("validation.required"), t("settings.profile_requiredNames"));
      return;
    }
    setSaving(true);
    if (form.hasDisability || form.isImmigrant || form.immigrationStatus) {
      const consentRes = await api.post("/api/consent", {
        grants: [{ category: "SENSITIVE", granted: true }],
      });
      if (consentRes.error) {
        setSaving(false);
        hapticError();
        Alert.alert(t("settings.profile_consentRequiredTitle"), t("settings.privacyLoadFailed"));
        return;
      }
    }
    const res = await api.post("/api/profile", form);
    setSaving(false);
    if (res.error) {
      hapticError();
      Alert.alert(t("common.errorTitle"), t("settings.profile_saveFailed"));
    } else {
      hapticSuccess();
      router.back();
    }
  };

  if (pageLoading) return <LoadingScreen />;

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("settings.profile_editTitle")}</Text>
          <View style={{ width: 44 }} />
        </View>
        <ErrorState
          title={t("settings.profile_unavailable")}
          message={loadError}
          onRetry={() => {
            setLoadError(null);
            setPageLoading(true);
            api.get<any>("/api/profile").then((res) => {
              if (res.error) {
                setLoadError(t("settings.profile_unavailable"));
              } else if (res.data) {
                const u = res.data.user || {};
                const p = res.data.profile || {};
                setForm({
                  firstName: u.firstName || "",
                  lastName: u.lastName || "",
                  ageRange: p.ageRange || "",
                  familyStatus: p.familyStatus || "SINGLE",
                  hasChildren: p.hasChildren || false,
                  childrenCount: p.childrenCount || 0,
                  hasPets: p.hasPets || false,
                  petTypes: Array.isArray(p.petTypes) ? p.petTypes : [],
                  carCount: p.carCount || 0,
                  hasMotorcycle: p.hasMotorcycle || false,
                  hasBoatRV: p.hasBoatRV || false,
                  needsStorage: p.needsStorage || false,
                  hasSenior: p.hasSenior || false,
                  hasDisability: p.hasDisability || false,
                  moveType: p.moveType || "PERSONAL",
                  isBusinessOwner: p.isBusinessOwner || false,
                  isImmigrant: p.isImmigrant || false,
                  immigrationStatus: p.immigrationStatus || "",
                });
              }
            }).finally(() => setPageLoading(false));
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.profile_editTitle")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>{t("auth.firstName")} *</Text>
        <TextInput
          style={styles.input}
          placeholder="John"
          placeholderTextColor={theme.colors.textMuted}
          value={form.firstName}
          onChangeText={(v) => update("firstName", v)}
        />

        <Text style={styles.label}>{t("auth.lastName")} *</Text>
        <TextInput
          style={styles.input}
          placeholder="Doe"
          placeholderTextColor={theme.colors.textMuted}
          value={form.lastName}
          onChangeText={(v) => update("lastName", v)}
        />

        <Text style={styles.sectionLabel}>{t("common.details")}</Text>
        <View style={styles.chipRow}>
          {AGE_RANGES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, form.ageRange === r && styles.chipActive]}
              onPress={() => update("ageRange", r)}
            >
              <Text style={[styles.chipText, form.ageRange === r && styles.chipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t("settings.profile")}</Text>
        <View style={styles.chipRow}>
          {FAMILY_STATUSES.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, form.familyStatus === f.value && styles.chipActive]}
              onPress={() => update("familyStatus", f.value)}
            >
              <Text style={[styles.chipText, form.familyStatus === f.value && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("settings.hasChildren")}</Text>
          <Switch
            value={form.hasChildren}
            onValueChange={(v) => update("hasChildren", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {form.hasChildren && (
          <>
            <Text style={styles.label}>{t("onboarding.childrenCount")}</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              value={String(form.childrenCount || "")}
              onChangeText={(v) => update("childrenCount", parseInt(v) || 0)}
              keyboardType="number-pad"
            />
          </>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("settings.hasPets")}</Text>
          <Switch
            value={form.hasPets}
            onValueChange={(v) => update("hasPets", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {form.hasPets ? (
          <>
            <Text style={styles.label}>{t("settings.petTypes")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("settings.petTypesPlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              value={form.petTypes.join(", ")}
              onChangeText={(value) => update("petTypes", value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20))}
              autoCapitalize="words"
            />
          </>
        ) : null}

        <Text style={styles.label}>{t("onboarding.carCount")}</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={theme.colors.textMuted}
          value={String(form.carCount || "")}
          onChangeText={(v) => update("carCount", parseInt(v) || 0)}
          keyboardType="number-pad"
        />

        <Text style={styles.sectionLabel}>{t("onboarding.moveType")}</Text>
        <View style={styles.chipRow}>
          {MOVE_TYPES.map((moveType) => (
            <TouchableOpacity
              key={moveType}
              style={[styles.chip, form.moveType === moveType && styles.chipActive]}
              onPress={() => update("moveType", moveType)}
            >
              <Text style={[styles.chipText, form.moveType === moveType && styles.chipTextActive]}>
                {t(`settings.moveType_${moveType}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("onboarding.businessOwner")}</Text>
          <Switch
            value={form.isBusinessOwner}
            onValueChange={(v) => update("isBusinessOwner", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <Text style={styles.sectionLabel}>{t("settings.movingNeeds")}</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("settings.motorcycle")}</Text>
          <Switch
            value={form.hasMotorcycle}
            onValueChange={(v) => update("hasMotorcycle", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("settings.boatRv")}</Text>
          <Switch
            value={form.hasBoatRV}
            onValueChange={(v) => update("hasBoatRV", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("settings.storageNeeded")}</Text>
          <Switch
            value={form.needsStorage}
            onValueChange={(v) => update("needsStorage", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("settings.seniorHousehold")}</Text>
          <Switch
            value={form.hasSenior}
            onValueChange={(v) => update("hasSenior", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <Text style={styles.sectionLabel}>{t("settings.sensitiveProfile")}</Text>
        <Text style={styles.helpText}>
          {t("settings.sensitiveProfileHelp")}
        </Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("settings.disabilityAccommodation")}</Text>
          <Switch
            value={form.hasDisability}
            onValueChange={(v) => update("hasDisability", v)}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t("settings.immigrationTasks")}</Text>
          <Switch
            value={form.isImmigrant}
            onValueChange={(v) => {
              update("isImmigrant", v);
              if (!v) update("immigrationStatus", "");
            }}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {form.isImmigrant ? (
          <>
            <Text style={styles.label}>{t("onboarding.immigrationStatus")}</Text>
            <View style={styles.chipRow}>
              {IMMIGRATION_STATUSES.map((status) => (
                <TouchableOpacity
                  key={status || "NONE"}
                  style={[styles.chip, form.immigrationStatus === status && styles.chipActive]}
                  onPress={() => update("immigrationStatus", status)}
                >
                  <Text style={[styles.chipText, form.immigrationStatus === status && styles.chipTextActive]}>
                    {status ? status.replace("_", " ") : t("settings.preferNotToSay")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

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
              <Text style={styles.saveBtnText}>{t("settings.profile_save", { defaultValue: "Save" })}</Text>
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
    marginTop: 16, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  switchLabel: { fontSize: 15, fontWeight: "500", color: theme.colors.text },
  helpText: { fontSize: 12, color: theme.colors.textTertiary, lineHeight: 18, marginBottom: 4 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    paddingVertical: 16, marginTop: 28, ...theme.shadow.glow,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
