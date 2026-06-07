import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  User,
  MapPin,
  Zap,
  Truck,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  Calendar,
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  getRecommendedProviders,
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryLabel,
  getMergedDisplayCategoryOrder,
  groupByMergedDisplayCategory,
} from "@/lib/recommendation-engine";
import type { ScoredProvider } from "@/lib/recommendation-engine";
import { getLocalizedProviderDescription, getLocalizedProviderReason } from "@/lib/provider-localization";
import { useTranslation } from "react-i18next";
import { useAppTheme, useThemePreference, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { AddressAutocompleteField } from "@/components/address/address-autocomplete-field";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LegalConsentPanel } from "@/components/legal/LegalConsentPanel";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/address-autocomplete";
import { hapticLight, hapticSuccess, hapticError } from "@/lib/haptics";
import {
  getPushSoftPromptDecision,
  registerForPushNotifications,
  setPushSoftPromptDecision,
} from "@/lib/push";
import { useAuthStore } from "@/lib/auth-store";
import {
  createAcceptedLegalConsents,
  getDefaultLegalConsents,
  getPendingLegalConsents,
  hydratePendingLegalConsents,
  hasRequiredLegalConsents,
  setPendingLegalConsents,
} from "@/lib/legal";
import { detectStateZipMismatch } from "@locateflow/shared";

const STEP_KEYS = [
  "onboarding.step_profile",
  "onboarding.step_address",
  "onboarding.step_services",
  "onboarding.step_moving",
] as const;

const FAMILY_STATUSES = [
  { value: "SINGLE", label: "Single" },
  { value: "COUPLE", label: "Couple" },
  { value: "FAMILY", label: "Family" },
  { value: "OTHER", label: "Other" },
];

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];

const ADDRESS_TYPES = [
  { value: "HOME", label: "Home" },
  { value: "WORK", label: "Work" },
  { value: "VACATION", label: "Vacation" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "STORAGE", label: "Storage" },
  { value: "OTHER", label: "Other" },
];

const OWNERSHIP_TYPES = [
  { value: "OWNER", label: "Owner" },
  { value: "RENTER", label: "Renter" },
  { value: "FAMILY", label: "Family" },
  { value: "OTHER", label: "Other" },
];

// Household details that carry no legal-sensitivity weight. Users can toggle
// these without any opt-in — they help the checklist generator tailor tasks
// (e.g. "pack pet supplies", "book a U-Haul").
const COMMON_PROFILE_TOGGLES = [
  { key: "hasChildren", label: "Children" },
  { key: "hasPets", label: "Pets" },
  { key: "hasSenior", label: "Senior household member" },
  { key: "needsStorage", label: "Storage" },
  { key: "hasMotorcycle", label: "Motorcycle" },
  { key: "hasBoatRV", label: "Boat / RV" },
];

// GDPR Art. 9 special-category / CCPA sensitive PI. Collected only when the
// user explicitly opts in and can always be skipped. Kept separate so the UI
// can surface the extra consent + "why we ask" copy next to the controls.
const SENSITIVE_PROFILE_TOGGLES = [
  {
    key: "hasDisability",
    label: "Someone at home has a disability",
    why: "So we can suggest accessibility-friendly movers and flag state-level DMV accommodations when you relocate.",
  },
];

const MOVE_TYPES = [
  { value: "PERSONAL", label: "Personal Move" },
  { value: "BUSINESS", label: "Business" },
  { value: "VACATION", label: "Vacation Home" },
  { value: "MILITARY", label: "Military / PCS" },
];

const IMMIGRATION_STATUSES = [
  { value: "CITIZEN", label: "US Citizen" },
  { value: "GREEN_CARD", label: "Green Card" },
  { value: "H1B", label: "H-1B" },
  { value: "L1", label: "L-1" },
  { value: "F1", label: "F-1 Student" },
  { value: "OTHER_VISA", label: "Other Visa" },
];

type OnboardingProgressEvent = "SERVICES_SKIPPED" | "MOVING_SKIPPED" | "COMPLETED";

export default function OnboardingScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();
  const { resolvedScheme } = useThemePreference();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [legalConsents, setLegalConsents] = useState(() => getPendingLegalConsents() || getDefaultLegalConsents());

  // Step 0 – Profile
  const [profile, setProfile] = useState({
    firstName: "", lastName: "", ageRange: "", familyStatus: "SINGLE",
    hasChildren: false, childrenCount: 0, hasPets: false,
    carCount: 0, hasSenior: false, hasDisability: false,
    needsStorage: false, hasMotorcycle: false, hasBoatRV: false,
    moveType: "PERSONAL", isBusinessOwner: false, isImmigrant: false,
    immigrationStatus: "",
  });

  // Step 1 – Address
  const [address, setAddress] = useState({
    nickname: "", street: "", city: "", state: "", zip: "",
    country: "USA", type: "HOME", ownership: "RENTER",
    startDate: new Date().toISOString().slice(0, 10),
    formattedAddress: null as string | null,
    placeId: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [createdAddressId, setCreatedAddressId] = useState<string | null>(null);

  // Step 2 – Providers
  const [providers, setProviders] = useState<ScoredProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<Map<string, ScoredProvider>>(new Map());
  const [createdServiceIds, setCreatedServiceIds] = useState<Record<string, string>>({});
  const [providerSearch, setProviderSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [billingData, setBillingData] = useState<Record<string, { monthlyCost: string; billingCycle: string }>>({});

  // Consent gate for sensitive fields (disability, immigration). Default off;
  // user must explicitly opt in before the sensitive toggles do anything.
  const [sensitiveOptIn, setSensitiveOptIn] = useState(false);

  // Step 3 – Moving plan
  const [wantsToMove, setWantsToMove] = useState<boolean | null>(null);
  const [movingForm, setMovingForm] = useState({
    street: "", city: "", state: "", zip: "", country: "USA", moveDate: "",
    formattedAddress: null as string | null,
    placeId: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [showMoveDatePicker, setShowMoveDatePicker] = useState(false);
  const [createdDestinationAddressId, setCreatedDestinationAddressId] = useState<string | null>(null);
  const [createdMovingPlanId, setCreatedMovingPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        ...prev,
        firstName: prev.firstName || user.firstName || "",
        lastName: prev.lastName || user.lastName || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const loadOnboardingState = async () => {
      await hydratePendingLegalConsents();
      const pending = getPendingLegalConsents();
      if (pending) {
        if (cancelled) return;
        setLegalConsents(pending);
        return;
      }
      const res = await api.get<any>("/api/profile");
      if (cancelled) return;
      if (res.data?.legalConsents) {
        setLegalConsents(getDefaultLegalConsents(res.data.legalConsents));
      }
      if (res.data?.onboardingCompleted === true) {
        router.replace("/(tabs)");
        return;
      }
      const nextStep = typeof res.data?.onboardingStepIndex === "number"
        ? Math.max(0, Math.min(3, res.data.onboardingStepIndex))
        : 0;
      setStep(nextStep);

      if (res.data?.user || res.data?.profile) {
        setProfile((prev) => ({
          ...prev,
          firstName: res.data?.user?.firstName || prev.firstName,
          lastName: res.data?.user?.lastName || prev.lastName,
          ageRange: res.data?.profile?.ageRange || prev.ageRange,
          familyStatus: res.data?.profile?.familyStatus || prev.familyStatus,
          hasChildren: res.data?.profile?.hasChildren ?? prev.hasChildren,
          childrenCount: res.data?.profile?.childrenCount ?? prev.childrenCount,
          hasPets: res.data?.profile?.hasPets ?? prev.hasPets,
          carCount: res.data?.profile?.carCount ?? prev.carCount,
          hasSenior: res.data?.profile?.hasSenior ?? prev.hasSenior,
          hasDisability: res.data?.profile?.hasDisability ?? prev.hasDisability,
          needsStorage: res.data?.profile?.needsStorage ?? prev.needsStorage,
          hasMotorcycle: res.data?.profile?.hasMotorcycle ?? prev.hasMotorcycle,
          hasBoatRV: res.data?.profile?.hasBoatRV ?? prev.hasBoatRV,
          moveType: res.data?.profile?.moveType || prev.moveType,
          isBusinessOwner: res.data?.profile?.isBusinessOwner ?? prev.isBusinessOwner,
          isImmigrant: res.data?.profile?.isImmigrant ?? prev.isImmigrant,
          immigrationStatus: res.data?.profile?.immigrationStatus || prev.immigrationStatus,
        }));
      }

      if (nextStep >= 1) {
        const addressRes = await api.get<any>("/api/addresses").catch(() => ({ data: null }));
        if (cancelled) return;
        const addresses = addressRes.data?.addresses || [];
        const primary = addresses.find((item: any) => item.isPrimary) || addresses[0];
        if (primary) {
          setCreatedAddressId(primary.id);
          setAddress((prev) => ({
            ...prev,
            nickname: primary.nickname || prev.nickname,
            street: primary.street || prev.street,
            city: primary.city || prev.city,
            state: primary.state || prev.state,
            zip: primary.zip || prev.zip,
            country: primary.country || prev.country,
            type: primary.type || prev.type,
            ownership: primary.ownership || prev.ownership,
            startDate: primary.startDate ? String(primary.startDate).slice(0, 10) : prev.startDate,
            formattedAddress: primary.formattedAddress ?? prev.formattedAddress,
            placeId: primary.placeId ?? prev.placeId,
            latitude: primary.latitude ?? prev.latitude,
            longitude: primary.longitude ?? prev.longitude,
          }));
        }
      }
    };
    loadOnboardingState().catch(() => {});
    return () => { cancelled = true; };
  }, [router]);

  // Fetch providers when entering step 2
  const fetchProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const params: Record<string, string> = {};
      if (createdAddressId) params.addressId = createdAddressId;
      if (address.state) params.state = address.state;
      if (address.zip) params.zip = address.zip;
      if (address.latitude != null) params.lat = String(address.latitude);
      if (address.longitude != null) params.lng = String(address.longitude);
      const res = await api.get<any>("/api/providers/recommendations", params);
      setProviders(res.data?.allProviders || []);
    } catch {
      setProviders([]);
    } finally {
      setLoadingProviders(false);
    }
  }, [address.latitude, address.longitude, address.state, address.zip, createdAddressId]);

  useEffect(() => {
    if (step === 2) fetchProviders();
  }, [step, fetchProviders]);

  const updateProfile = (key: string, value: any) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };
  const updateAddress = (key: string, value: any) => {
    setAddress((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "street" || key === "city" || key === "state" || key === "zip") {
        return clearAddressAutocompleteMetadata(next);
      }
      return next;
    });
  };
  const updateMoving = (key: string, value: any) => {
    setMovingForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "street" || key === "city" || key === "state" || key === "zip") {
        return clearAddressAutocompleteMetadata(next);
      }
      return next;
    });
  };

  const handleAddressAutocompleteSelect = (result: AddressAutocompleteResult) => {
    setAddress((prev) => applyAddressAutocompleteResult(prev, result));
  };

  const handleMovingAutocompleteSelect = (result: AddressAutocompleteResult) => {
    setMovingForm((prev) => applyAddressAutocompleteResult(prev, result));
  };

  const toggleProvider = (provider: ScoredProvider) => {
    setSelectedProviders((prev) => {
      const next = new Map(prev);
      if (next.has(provider.id)) next.delete(provider.id);
      else next.set(provider.id, provider);
      return next;
    });
  };

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const recordOnboardingProgress = async (event: OnboardingProgressEvent) => {
    const res = await api.post<{ ok: boolean }>("/api/onboarding/progress", { event });
    if (res.error) throw new Error(res.error);
  };

  const routeIfOnboardingCompleted = async () => {
    const profileRes = await api.get<any>("/api/profile");
    if (profileRes.data?.onboardingCompleted === true) {
      hapticSuccess();
      router.replace("/(tabs)");
      return true;
    }
    return false;
  };

  // --- Step save handlers ---
  const saveProfile = async () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      setError(t("onboarding.error_namesRequired"));
      return false;
    }
    if (!hasRequiredLegalConsents(legalConsents)) {
      setError(t("onboarding.error_legalRequired"));
      return false;
    }
    setError(""); setSaving(true);
    try {
      const acceptedLegalConsents = createAcceptedLegalConsents(legalConsents);
      const legalRes = await api.post<any>("/api/legal/acceptance", { legalConsents: acceptedLegalConsents });
      if (legalRes.error) throw new Error(legalRes.error);
      const profilePayload = {
        ...profile,
        hasDisability: sensitiveOptIn ? profile.hasDisability : false,
        isImmigrant: sensitiveOptIn ? profile.isImmigrant : false,
        immigrationStatus: sensitiveOptIn ? profile.immigrationStatus : "",
      };
      const hasSensitiveProfileData =
        profilePayload.hasDisability ||
        profilePayload.isImmigrant ||
        Boolean(profilePayload.immigrationStatus);
      if (hasSensitiveProfileData) {
        const consentRes = await api.post<any>("/api/consent", {
          grants: [{ category: "SENSITIVE", granted: true }],
        });
        if (consentRes.error) throw new Error(consentRes.error);
      }
      const res = await api.post<any>("/api/profile", profilePayload);
      if (res.error) throw new Error(res.error);
      await setPendingLegalConsents(null);
      return true;
    } catch (e: any) {
      setError(e.message || t("onboarding.error_saveProfile"));
      return false;
    } finally { setSaving(false); }
  };

  const saveAddress = async () => {
    if (!address.street.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim()) {
      setError(t("onboarding.error_addressRequired"));
      return false;
    }
    if (address.state.length !== 2) {
      setError(t("onboarding.error_stateFormat"));
      return false;
    }
    const addressMismatch = detectStateZipMismatch(address.state, address.zip);
    if (addressMismatch) {
      setError(t("onboarding.error_stateZipMismatch", {
        defaultValue: `ZIP ${address.zip} appears to be in ${addressMismatch.zipState}, but the state is ${addressMismatch.typedState}. Please check the address.`,
        state: addressMismatch.typedState,
        zip: address.zip,
        zipState: addressMismatch.zipState,
      }));
      return false;
    }
    setError(""); setSaving(true);
    try {
      const res = createdAddressId
        ? await api.patch<any>(`/api/addresses/${createdAddressId}`, { ...address, isPrimary: true })
        : await api.post<any>("/api/addresses", { ...address, isPrimary: true });
      if (res.error) throw new Error(res.error);
      setCreatedAddressId(res.data?.address?.id || createdAddressId || null);
      return true;
    } catch (e: any) {
      setError(e.message || t("onboarding.error_saveAddress"));
      return false;
    } finally { setSaving(false); }
  };

  const saveServices = async () => {
    if (!createdAddressId) {
      setError(t("onboarding.error_addressMissing"));
      return false;
    }
    const nextCreatedServiceIds = { ...createdServiceIds };
    setError(""); setSaving(true);
    try {
      // No providers selected — wipe any services we already created.
      if (selectedProviders.size === 0) {
        const deletes = Object.values(nextCreatedServiceIds).map((serviceId) =>
          api.delete(`/api/services/${serviceId}`)
        );
        const results = await Promise.all(deletes);
        const firstErr = results.find((r) => r.error);
        if (firstErr) throw new Error(firstErr.error);
        setCreatedServiceIds({});
        await recordOnboardingProgress("SERVICES_SKIPPED");
        return true;
      }

      const selectedProviderIds = new Set(selectedProviders.keys());

      // Run delete (deselected) and upsert (selected) groups in parallel — the
      // server treats these as independent records, so there's no ordering
      // requirement and the user's wait time scales with the slowest call
      // instead of the sum of all calls.
      const deletions = Object.entries(nextCreatedServiceIds)
        .filter(([providerId]) => !selectedProviderIds.has(providerId))
        .map(async ([providerId, serviceId]) => {
          const deleteRes = await api.delete(`/api/services/${serviceId}`);
          if (deleteRes.error) throw new Error(deleteRes.error);
          delete nextCreatedServiceIds[providerId];
        });

      const upserts = Array.from(selectedProviders).map(async ([id, provider]) => {
        const b = billingData[id] || {};
        const payload: any = {
          addressId: createdAddressId,
          providerId: provider.id,
          category: provider.category,
          providerName: provider.name,
          website: provider.website || undefined,
          phone: provider.phone || undefined,
        };
        if (b.monthlyCost) payload.monthlyCost = parseFloat(b.monthlyCost);
        if (b.billingCycle) payload.billingCycle = b.billingCycle;

        if (nextCreatedServiceIds[id]) {
          const updateRes = await api.patch<any>(`/api/services/${nextCreatedServiceIds[id]}`, payload);
          if (updateRes.error) throw new Error(updateRes.error);
          return;
        }

        const createRes = await api.post<any>("/api/services", payload);
        if (createRes.error) throw new Error(createRes.error);

        const serviceId = createRes.data?.service?.id;
        if (!serviceId) throw new Error(t("onboarding.error_serviceIdMissing"));
        nextCreatedServiceIds[id] = serviceId;
      });

      await Promise.all([...deletions, ...upserts]);

      setCreatedServiceIds(nextCreatedServiceIds);
      return true;
    } catch (e: any) {
      setCreatedServiceIds(nextCreatedServiceIds);
      setError(e.message || t("onboarding.error_saveServices"));
      return false;
    } finally { setSaving(false); }
  };

  const saveMovingPlan = async () => {
    if (!wantsToMove) {
      setError(""); setSaving(true);
      try {
        if (createdMovingPlanId) {
          const deletePlanRes = await api.delete(`/api/moving/${createdMovingPlanId}`);
          if (deletePlanRes.error) throw new Error(deletePlanRes.error);
          setCreatedMovingPlanId(null);
        }

        if (createdDestinationAddressId) {
          const deleteAddressRes = await api.delete(`/api/addresses/${createdDestinationAddressId}`);
          if (deleteAddressRes.error) throw new Error(deleteAddressRes.error);
          setCreatedDestinationAddressId(null);
        }

        return true;
      } catch (e: any) {
        setError(e.message || t("onboarding.error_planCleanup"));
        return false;
      } finally { setSaving(false); }
    }
    if (!movingForm.city.trim() || !movingForm.state.trim() || !movingForm.zip.trim() || !movingForm.moveDate) {
      setError(t("onboarding.error_destinationRequired"));
      return false;
    }
    if (movingForm.state.length !== 2) {
      setError(t("onboarding.error_stateFormat"));
      return false;
    }
    const destinationMismatch = detectStateZipMismatch(movingForm.state, movingForm.zip);
    if (destinationMismatch) {
      setError(t("onboarding.error_stateZipMismatchDestination", {
        defaultValue: `ZIP ${movingForm.zip} appears to be in ${destinationMismatch.zipState}, but the state is ${destinationMismatch.typedState}. Please check the destination address.`,
        state: destinationMismatch.typedState,
        zip: movingForm.zip,
        zipState: destinationMismatch.zipState,
      }));
      return false;
    }
    if (!createdAddressId) {
      setError(t("onboarding.error_originMissing"));
      return false;
    }
    setError(""); setSaving(true);
    try {
      if (createdMovingPlanId) {
        const deletePlanRes = await api.delete(`/api/moving/${createdMovingPlanId}`);
        if (deletePlanRes.error) throw new Error(deletePlanRes.error);
        setCreatedMovingPlanId(null);
      }

      if (createdDestinationAddressId) {
        const deleteAddressRes = await api.delete(`/api/addresses/${createdDestinationAddressId}`);
        if (deleteAddressRes.error) throw new Error(deleteAddressRes.error);
        setCreatedDestinationAddressId(null);
      }

      const planRes = await api.post<any>("/api/moving", {
        fromAddressId: createdAddressId,
        moveDate: movingForm.moveDate,
        destinationAddress: {
          nickname: `${movingForm.city}, ${movingForm.state}`,
          street: movingForm.street.trim() || `${movingForm.city}, ${movingForm.state}`,
          city: movingForm.city.trim(),
          state: movingForm.state.trim().toUpperCase(),
          zip: movingForm.zip.trim(),
          country: movingForm.country || "USA",
          type: "HOME",
          ownership: "RENTER",
          isPrimary: false,
          startDate: movingForm.moveDate,
          formattedAddress: movingForm.formattedAddress,
          placeId: movingForm.placeId,
          latitude: movingForm.latitude,
          longitude: movingForm.longitude,
        },
      });
      if (planRes.error) throw new Error(planRes.error);

      const planId = planRes.data?.plan?.id;
      const destinationAddressId = planRes.data?.destinationAddressId || null;
      if (!planId) throw new Error(t("onboarding.error_planMissing"));

      setCreatedDestinationAddressId(destinationAddressId);
      setCreatedMovingPlanId(planId);
      return planId as string;
    } catch (e: any) {
      setError(e.message || t("onboarding.error_savePlan"));
      return false;
    } finally { setSaving(false); }
  };

  const handleComplete = async () => {
    const planId = await saveMovingPlan();
    if (planId === false) return false;

    setSaving(true);
    setError("");
    try {
      if (selectedProviders.size === 0 && Object.keys(createdServiceIds).length === 0) {
        await recordOnboardingProgress("SERVICES_SKIPPED");
      }
      if (typeof planId === "string") {
        await recordOnboardingProgress("COMPLETED");
      } else {
        await recordOnboardingProgress("MOVING_SKIPPED");
        await recordOnboardingProgress("COMPLETED");
      }
      const profileRes = await api.get<any>("/api/profile");
      if (profileRes.error) {
        throw new Error(profileRes.error);
      }
      if (profileRes.data?.onboardingCompleted !== true) {
        throw new Error(t("onboarding.error_onboardingIncomplete"));
      }
      hapticSuccess();
      // Surface the push notification soft-prompt at end of onboarding (before
      // routing into the app). Apple HIG asks us to explain WHY notifications
      // matter before triggering the one-shot OS prompt; declining here just
      // defers the OS prompt — the user can enable later from Settings.
      await maybeOfferPushSoftPrompt();
      if (typeof planId === "string") {
        router.replace({ pathname: "/moving/[id]", params: { id: planId } });
      } else {
        router.replace("/(tabs)");
      }
      return true;
    } catch (e: any) {
      setError(e?.message || t("onboarding.error_completeOnboarding"));
      return false;
    } finally { setSaving(false); }
  };

  const maybeOfferPushSoftPrompt = async () => {
    try {
      const decision = await getPushSoftPromptDecision();
      if (decision !== null) return; // already answered
      await new Promise<void>((resolve) => {
        Alert.alert(
          t("onboarding.pushPromptTitle", { defaultValue: "Stay on top of your move" }),
          t("onboarding.pushPromptBody", {
            defaultValue:
              "LocateFlow can send reminders for moving tasks, provider replies, and billing notices. You can change this any time in Settings.",
          }),
          [
            {
              text: t("onboarding.pushPromptDecline", { defaultValue: "Not now" }),
              style: "cancel",
              onPress: async () => {
                await setPushSoftPromptDecision("deferred");
                resolve();
              },
            },
            {
              text: t("onboarding.pushPromptAccept", { defaultValue: "Enable notifications" }),
              onPress: async () => {
                await setPushSoftPromptDecision("accepted");
                // The native OS prompt fires from registerForPushNotifications.
                void registerForPushNotifications().catch(() => null);
                resolve();
              },
            },
          ],
          { cancelable: true, onDismiss: () => resolve() },
        );
      });
    } catch {
      /* best effort */
    }
  };

  const next = async () => {
    hapticLight();
    let ok = true;
    if (step === 0) ok = await saveProfile();
    else if (step === 1) ok = await saveAddress();
    else if (step === 2) ok = await saveServices();
    if (!ok) { hapticError(); return; }
    if (step === 2 && await routeIfOnboardingCompleted()) return;
    if (step < 3) { setStep(step + 1); setError(""); }
    else {
      const completed = await handleComplete();
      if (!completed) hapticError();
    }
  };

  const skipServices = async () => {
    hapticLight();
    const ok = await saveServices();
    if (!ok) {
      hapticError();
      return;
    }
    if (await routeIfOnboardingCompleted()) return;
    setStep(3);
    setError("");
  };

  const back = () => { if (step > 0) { setStep(step - 1); setError(""); } };

  const recommended = getRecommendedProviders(providers, 8);

  const filteredProviders = providers.filter((p: ScoredProvider) => {
    if (!providerSearch) return true;
    const q = providerSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
  });
  const grouped = groupByMergedDisplayCategory(filteredProviders);
  const sortedCats = Object.keys(grouped).sort(
    (a, b) => getMergedDisplayCategoryOrder(a) - getMergedDisplayCategoryOrder(b)
  );
  const categoryLabel = useCallback(
    (category: string) => t(`categories.${category}`, { defaultValue: getMergedDisplayCategoryLabel(category) }),
    [t],
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        {/* Progress */}
        <View style={styles.progressRow}>
          {STEP_KEYS.map((key, i) => (
            <View key={key} style={[styles.progressDot, i <= step && styles.progressDotActive, i < step && styles.progressDotDone]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>
          {t("onboarding.stepIndicator", { current: step + 1, total: STEP_KEYS.length, label: t(STEP_KEYS[step]) })}
        </Text>

        {error ? (
          <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
        ) : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 0: Profile */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <View style={styles.stepIcon}><User size={28} color={theme.colors.primary} /></View>
              <Text style={styles.stepTitle}>{t("onboarding.profile_title")}</Text>
              <Text style={styles.stepDesc}>{t("onboarding.profile_description")}</Text>

              <View style={[styles.row, { marginTop: 24 }]}>
                <View style={{ flex: 1 }}>
                  <Input label={`${t("auth.firstName")} *`} placeholder="John" value={profile.firstName}
                    onChangeText={(v: string) => updateProfile("firstName", v)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label={`${t("auth.lastName")} *`} placeholder="Doe" value={profile.lastName}
                    onChangeText={(v: string) => updateProfile("lastName", v)} />
                </View>
              </View>

              <Text style={styles.fieldLabel}>{t("onboarding.ageRange")}</Text>
              <View style={styles.chipRow}>
                {AGE_RANGES.map((age) => (
                  <TouchableOpacity key={age}
                    style={[styles.chip, profile.ageRange === age && styles.chipActive]}
                    onPress={() => { hapticLight(); updateProfile("ageRange", profile.ageRange === age ? "" : age); }}>
                    <Text style={[styles.chipText, profile.ageRange === age && styles.chipTextActive]}>{age}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t("onboarding.familyStatus")}</Text>
              <View style={styles.chipRow}>
                {FAMILY_STATUSES.map((fs) => (
                  <TouchableOpacity key={fs.value}
                    style={[styles.chip, profile.familyStatus === fs.value && styles.chipActive]}
                    onPress={() => { hapticLight(); updateProfile("familyStatus", fs.value); }}>
                    <Text style={[styles.chipText, profile.familyStatus === fs.value && styles.chipTextActive]}>{fs.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{t("onboarding.household")}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.textTertiary, marginBottom: 8 }}>
                {t("onboarding.household_hint")}
              </Text>
              <View style={styles.toggleGrid}>
                {COMMON_PROFILE_TOGGLES.map(({ key, label }) => (
                  <TouchableOpacity key={key}
                    style={[styles.toggleChip, (profile as any)[key] && styles.toggleChipActive]}
                    onPress={() => { hapticLight(); updateProfile(key, !(profile as any)[key]); }}>
                    {(profile as any)[key] && <Check size={14} color={theme.colors.primary} />}
                    <Text style={[styles.toggleChipText, (profile as any)[key] && styles.toggleChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sensitive-category opt-in. Off by default; toggles unlock
                  the disability field only after the user consents. */}
              <View style={{
                marginTop: 16,
                padding: 12,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.borderLight,
                backgroundColor: theme.colors.glass.bg,
              }}>
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    if (sensitiveOptIn) {
                      // Opting out wipes any answers the user gave so we
                      // never retain sensitive data without consent.
                      setSensitiveOptIn(false);
                      updateProfile("hasDisability", false);
                      updateProfile("isImmigrant", false);
                      updateProfile("immigrationStatus", "");
                    } else {
                      setSensitiveOptIn(true);
                    }
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: sensitiveOptIn ? theme.colors.primary : theme.colors.borderLight,
                      backgroundColor: sensitiveOptIn ? theme.colors.primary : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {sensitiveOptIn && <Check size={14} color="#fff" />}
                  </View>
                  <Text style={{ flex: 1, color: theme.colors.text, fontSize: 13, fontWeight: "600" }}>
                    {t("onboarding.sensitive_optIn")}
                  </Text>
                </TouchableOpacity>
                <Text style={{ marginTop: 6, fontSize: 11, color: theme.colors.textTertiary, lineHeight: 16 }}>
                  {t("onboarding.sensitive_hint")}
                </Text>
                {sensitiveOptIn && (
                  <View style={[styles.toggleGrid, { marginTop: 12 }]}>
                    {SENSITIVE_PROFILE_TOGGLES.map(({ key, label, why }) => (
                      <View key={key} style={{ width: "100%" }}>
                        <TouchableOpacity
                          style={[styles.toggleChip, (profile as any)[key] && styles.toggleChipActive, { width: "100%" }]}
                          onPress={() => { hapticLight(); updateProfile(key, !(profile as any)[key]); }}
                        >
                          {(profile as any)[key] && <Check size={14} color={theme.colors.primary} />}
                          <Text style={[styles.toggleChipText, (profile as any)[key] && styles.toggleChipTextActive]}>{label}</Text>
                        </TouchableOpacity>
                        <Text style={{ marginTop: 4, marginLeft: 4, fontSize: 11, color: theme.colors.textTertiary, lineHeight: 15 }}>
                          {t("onboarding.sensitive_why", { reason: why })}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {profile.hasChildren && (
                <View style={styles.counterRow}>
                  <Text style={styles.counterLabel}>{t("onboarding.childrenCount")}</Text>
                  <View style={styles.counter}>
                    <TouchableOpacity style={styles.counterBtn} onPress={() => updateProfile("childrenCount", Math.max(0, profile.childrenCount - 1))}>
                      <Text style={styles.counterBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{profile.childrenCount}</Text>
                    <TouchableOpacity style={styles.counterBtn} onPress={() => updateProfile("childrenCount", profile.childrenCount + 1)}>
                      <Text style={styles.counterBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.counterRow}>
                <Text style={styles.counterLabel}>{t("onboarding.carCount")}</Text>
                <View style={styles.counter}>
                  <TouchableOpacity style={styles.counterBtn} onPress={() => updateProfile("carCount", Math.max(0, profile.carCount - 1))}>
                    <Text style={styles.counterBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{profile.carCount}</Text>
                  <TouchableOpacity style={styles.counterBtn} onPress={() => updateProfile("carCount", profile.carCount + 1)}>
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 20 }]}>{t("onboarding.moveType")}</Text>
              <View style={styles.chipRow}>
                {MOVE_TYPES.map((mt) => (
                  <TouchableOpacity key={mt.value}
                    style={[styles.chip, profile.moveType === mt.value && styles.chipActive]}
                    onPress={() => { hapticLight(); updateProfile("moveType", mt.value); }}>
                    <Text style={[styles.chipText, profile.moveType === mt.value && styles.chipTextActive]}>{mt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {profile.moveType === "BUSINESS" && (
                <View style={styles.toggleGrid}>
                  <TouchableOpacity
                    style={[styles.toggleChip, profile.isBusinessOwner && styles.toggleChipActive]}
                    onPress={() => { hapticLight(); updateProfile("isBusinessOwner", !profile.isBusinessOwner); }}>
                    {profile.isBusinessOwner && <Check size={14} color={theme.colors.primary} />}
                    <Text style={[styles.toggleChipText, profile.isBusinessOwner && styles.toggleChipTextActive]}>{t("onboarding.businessOwner")}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {sensitiveOptIn ? (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{t("onboarding.immigrationStatus")}</Text>
                  <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginBottom: 8, lineHeight: 15 }}>
                    {t("onboarding.immigration_why")}
                  </Text>
                  <View style={styles.chipRow}>
                    {IMMIGRATION_STATUSES.map((is_) => (
                      <TouchableOpacity key={is_.value}
                        style={[styles.chip, profile.immigrationStatus === is_.value && styles.chipActive]}
                        onPress={() => {
                          hapticLight();
                          const newVal = profile.immigrationStatus === is_.value ? "" : is_.value;
                          updateProfile("immigrationStatus", newVal);
                          updateProfile("isImmigrant", newVal !== "" && newVal !== "CITIZEN");
                        }}>
                        <Text style={[styles.chipText, profile.immigrationStatus === is_.value && styles.chipTextActive]}>{is_.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}

              <LegalConsentPanel
                consents={legalConsents}
                onChange={setLegalConsents}
                disabled={saving}
              />
            </View>
          )}

          {/* Step 1: Address */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <View style={styles.stepIcon}><MapPin size={28} color={theme.colors.primary} /></View>
              <Text style={styles.stepTitle}>{t("onboarding.address_title")}</Text>
              <Text style={styles.stepDesc}>{t("onboarding.address_description")}</Text>
              <View style={{ width: "100%", marginTop: 16 }}>
                <EmailVerificationBanner context={t("addresses.title")} />
              </View>

              <Input label={t("addresses.nickname")} placeholder="e.g. Home, Apartment" value={address.nickname}
                onChangeText={(v: string) => updateAddress("nickname", v)} containerStyle={{ marginTop: 24, width: "100%" }} />
              <AddressAutocompleteField label={`${t("addresses.street")} *`} placeholder="123 Main St" value={address.street}
                onValueChange={(value) => updateAddress("street", value)} onSelect={handleAddressAutocompleteSelect} containerStyle={{ marginTop: 12, width: "100%" }} />

              <View style={[styles.row, { marginTop: 12 }]}>
                <View style={{ flex: 2 }}>
                  <Input label={`${t("addresses.city")} *`} placeholder="Austin" value={address.city}
                    onChangeText={(v: string) => updateAddress("city", v)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label={`${t("addresses.state")} *`} placeholder="TX" value={address.state} maxLength={2}
                    onChangeText={(v: string) => updateAddress("state", v.toUpperCase().slice(0, 2))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label={`${t("addresses.zip")} *`} placeholder="78701" value={address.zip} keyboardType="number-pad" maxLength={10}
                    onChangeText={(v: string) => updateAddress("zip", v)} />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 20 }]}>{t("onboarding.address_typeLabel")}</Text>
              <View style={styles.chipRow}>
                {ADDRESS_TYPES.map((t) => (
                  <TouchableOpacity key={t.value}
                    style={[styles.chip, address.type === t.value && styles.chipActive]}
                    onPress={() => { hapticLight(); updateAddress("type", t.value); }}>
                    <Text style={[styles.chipText, address.type === t.value && styles.chipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>{t("onboarding.address_ownershipLabel")}</Text>
              <View style={styles.chipRow}>
                {OWNERSHIP_TYPES.map((o) => (
                  <TouchableOpacity key={o.value}
                    style={[styles.chip, address.ownership === o.value && styles.chipActive]}
                    onPress={() => { hapticLight(); updateAddress("ownership", o.value); }}>
                    <Text style={[styles.chipText, address.ownership === o.value && styles.chipTextActive]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Services */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <View style={styles.stepIcon}><Zap size={28} color={theme.colors.primary} /></View>
              <Text style={styles.stepTitle}>{t("onboarding.providers_title")}</Text>
              <Text style={styles.stepDesc}>
                {address.state
                  ? t("onboarding.providers_showingState", { state: address.state })
                  : t("onboarding.providers_allStates")}
                {selectedProviders.size > 0 ? t("onboarding.providers_selectedSuffix", { count: selectedProviders.size }) : ""}
              </Text>

              <View style={styles.searchRow}>
                <Search size={16} color={theme.colors.textMuted} />
                <Input placeholder={t("onboarding.providers_searchPlaceholder")} value={providerSearch}
                  onChangeText={setProviderSearch}
                  containerStyle={{ flex: 1, marginBottom: 0 }} />
              </View>

              {/* Recommended Section */}
              {!loadingProviders && !providerSearch && recommended.length > 0 && (
                <View style={styles.recoSection}>
                  <View style={styles.recoHeader}>
                    <Sparkles size={16} color={theme.colors.amber.text} />
                    <Text style={styles.recoTitle}>{t("onboarding.providers_recommended")}</Text>
                  </View>
                  {recommended.map((provider: ScoredProvider) => {
                    const isSelected = selectedProviders.has(provider.id);
                    const reason = getLocalizedProviderReason(
                      t,
                      i18n.language,
                      provider,
                      categoryLabel(provider.category),
                    );
                    return (
                      <TouchableOpacity
                        key={`rec-${provider.id}`}
                        style={[styles.recoCard, isSelected && styles.recoCardActive]}
                        onPress={() => { hapticLight(); toggleProvider(provider as any); }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.providerAvatar, isSelected && styles.providerAvatarActive]}>
                          <Text style={styles.providerAvatarText}>{provider.name.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.providerName} numberOfLines={1}>{provider.name}</Text>
                          <Text style={styles.recoReason} numberOfLines={1}>
                            {reason}
                          </Text>
                        </View>
                        {isSelected && <Check size={16} color={theme.colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {loadingProviders ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={styles.loadingText}>{t("onboarding.providers_loading")}</Text>
                </View>
              ) : sortedCats.length === 0 ? (
                <Text style={styles.emptyText}>{t("onboarding.providers_empty")}</Text>
              ) : (
                <View style={{ marginTop: 12, width: "100%" }}>
                  {sortedCats.map((cat) => {
                    const items = grouped[cat];
                    const isOpen = expandedCats.has(cat);
                    const selectedCount = items.filter((p: ScoredProvider) => selectedProviders.has(p.id)).length;
                    return (
                      <View key={cat} style={styles.catSection}>
                        <TouchableOpacity style={styles.catHeader} onPress={() => toggleCat(cat)}>
                          <Text style={styles.catIcon}>{getMergedDisplayCategoryIcon(cat)}</Text>
                          <Text style={styles.catTitle} numberOfLines={1}>{categoryLabel(cat)}</Text>
                          <View style={styles.catRight}>
                            <Text style={styles.catCount}>{items.length}</Text>
                            {selectedCount > 0 && (
                              <View style={styles.catBadge}>
                                <Text style={styles.catBadgeText}>{selectedCount}</Text>
                              </View>
                            )}
                            {isOpen ? <ChevronUp size={16} color={theme.colors.textMuted} /> : <ChevronDown size={16} color={theme.colors.textMuted} />}
                          </View>
                        </TouchableOpacity>
                        {isOpen && items.map((provider: ScoredProvider) => {
                          const sel = selectedProviders.has(provider.id);
                          const bd = billingData[provider.id];
                          const description = getLocalizedProviderDescription(t, i18n.language, provider);
                          return (
                            <View key={provider.id}>
                              <TouchableOpacity
                                style={[styles.providerItem, sel && styles.providerItemActive]}
                                onPress={() => { hapticLight(); toggleProvider(provider as any); }}>
                                <View style={[styles.providerAvatar, sel && styles.providerAvatarActive]}>
                                  <Text style={styles.providerAvatarText}>{provider.name.charAt(0)}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.providerName} numberOfLines={1}>{provider.name}</Text>
                                  {description ? (
                                    <Text style={styles.providerDesc} numberOfLines={1}>{description}</Text>
                                  ) : null}
                                  <View style={styles.providerMetaRow}>
                                    <View style={[styles.scopeBadge, provider.scope === "FEDERAL" ? styles.scopeFederal : styles.scopeState]}>
                                      <Text style={[styles.scopeText, provider.scope === "FEDERAL" ? styles.scopeFederalText : styles.scopeStateText]}>
                                        {provider.scope === "FEDERAL" ? t("onboarding.scopeFederal") : (provider.states || []).join(", ")}
                                      </Text>
                                    </View>
                                    {bd?.monthlyCost ? (
                                      <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: "rgba(16,185,129,0.15)" }}>
                                        <Text style={{ fontSize: 9, fontWeight: "600", color: "#34d399" }}>${bd.monthlyCost}/mo</Text>
                                      </View>
                                    ) : null}
                                  </View>
                                </View>
                                {sel && <Check size={18} color={theme.colors.primary} />}
                              </TouchableOpacity>
                              {sel && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingBottom: 10, paddingTop: 2, borderTopWidth: 0 }}>
                                  <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>$</Text>
                                  <View style={{ flex: 1, maxWidth: 120, backgroundColor: theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 10, paddingVertical: 6 }}>
                                    <TextInput
                                      placeholder={t("onboarding.billingCost")}
                                      placeholderTextColor={theme.colors.textMuted}
                                      keyboardType="decimal-pad"
                                      style={{ fontSize: 12, color: theme.colors.text, padding: 0 }}
                                      value={bd?.monthlyCost || ""}
                                      onChangeText={(v: string) => setBillingData((prev) => ({ ...prev, [provider.id]: { monthlyCost: v, billingCycle: prev[provider.id]?.billingCycle || "MONTHLY" } }))}
                                    />
                                  </View>
                                  {["MONTHLY", "YEARLY"].map((cycle) => (
                                    <TouchableOpacity
                                      key={cycle}
                                      onPress={() => setBillingData((prev) => ({ ...prev, [provider.id]: { monthlyCost: prev[provider.id]?.monthlyCost || "", billingCycle: cycle } }))}
                                      style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: (bd?.billingCycle || "MONTHLY") === cycle ? theme.colors.primaryFaded : theme.colors.surface, borderWidth: 1, borderColor: (bd?.billingCycle || "MONTHLY") === cycle ? "rgba(127, 182, 232,0.4)" : theme.colors.border }}>
                                      <Text style={{ fontSize: 10, fontWeight: "600", color: (bd?.billingCycle || "MONTHLY") === cycle ? theme.colors.primary : theme.colors.textMuted }}>
                                        {cycle === "MONTHLY" ? t("onboarding.billingCycle_monthly") : t("onboarding.billingCycle_yearly")}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Step 3: Moving */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <View style={[styles.stepIcon, { backgroundColor: theme.colors.successFaded, borderColor: "rgba(16,185,129,0.3)" }]}>
                <Truck size={28} color={theme.colors.success} />
              </View>
              <Text style={styles.stepTitle}>{t("onboarding.moving_title")}</Text>
              <Text style={styles.stepDesc}>
                {t("onboarding.moving_description")}
              </Text>

              {wantsToMove === null && (
                <View style={{ marginTop: 32, gap: 12, width: "100%" }}>
                  <Button title={t("onboarding.moving_yes")} onPress={() => { hapticLight(); setWantsToMove(true); }} fullWidth size="lg" />
                  <Button title={t("onboarding.moving_no")} onPress={() => { hapticLight(); setWantsToMove(false); }} variant="ghost" fullWidth size="lg" />
                </View>
              )}

              {wantsToMove === false && (
                <View style={{ marginTop: 24, alignItems: "center", gap: 12, width: "100%" }}>
                  <Check size={40} color={theme.colors.success} style={{ opacity: 0.5 }} />
                  <Text style={[styles.stepDesc, { marginTop: 0 }]}>{t("onboarding.moving_skipped")}</Text>
                  <Button title={t("onboarding.goToDashboard")} onPress={handleComplete} loading={saving} fullWidth size="lg" />
                </View>
              )}

              {wantsToMove === true && (
                <View style={{ marginTop: 20, gap: 12, width: "100%" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <MapPin size={16} color={theme.colors.primary} />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: theme.colors.text }}>{t("onboarding.moving_destinationHeader")}</Text>
                  </View>
                  <AddressAutocompleteField label={t("addresses.street")} placeholder="123 New St (optional)" value={movingForm.street}
                    onValueChange={(value) => updateMoving("street", value)} onSelect={handleMovingAutocompleteSelect} containerStyle={{ width: "100%" }} />
                  <View style={[styles.row]}>
                    <View style={{ flex: 2 }}>
                      <Input label={`${t("addresses.city")} *`} placeholder="Austin" value={movingForm.city}
                        onChangeText={(v: string) => updateMoving("city", v)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input label={`${t("addresses.state")} *`} placeholder="TX" value={movingForm.state} maxLength={2}
                        onChangeText={(v: string) => updateMoving("state", v.toUpperCase().slice(0, 2))} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input label={`${t("addresses.zip")} *`} placeholder="78701" value={movingForm.zip} keyboardType="number-pad" maxLength={10}
                        onChangeText={(v: string) => updateMoving("zip", v)} />
                    </View>
                  </View>
                  <View style={{ width: "100%" }}>
                    <Text style={styles.dateLabel}>{t("onboarding.moving_dateLabel")}</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowMoveDatePicker(true)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={t("onboarding.moving_dateA11y")}
                    >
                      <Calendar size={16} color={movingForm.moveDate ? theme.colors.primary : theme.colors.textMuted} />
                      <Text style={[styles.dateButtonText, movingForm.moveDate ? { color: theme.colors.text } : undefined]}>
                        {movingForm.moveDate
                          ? new Date(`${movingForm.moveDate}T00:00:00`).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })
                          : t("onboarding.moving_datePlaceholder")}
                      </Text>
                    </TouchableOpacity>
                    {showMoveDatePicker && (
                      <DateTimePicker
                        value={movingForm.moveDate ? new Date(`${movingForm.moveDate}T00:00:00`) : new Date()}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        minimumDate={new Date()}
                        onChange={(_event: any, date?: Date) => {
                          setShowMoveDatePicker(Platform.OS === "ios");
                          if (date) {
                            updateMoving("moveDate", date.toISOString().slice(0, 10));
                          }
                        }}
                        themeVariant={resolvedScheme}
                        textColor={theme.colors.text}
                      />
                    )}
                    {Platform.OS === "ios" && showMoveDatePicker ? (
                      <TouchableOpacity
                        style={styles.dateDoneButton}
                        onPress={() => setShowMoveDatePicker(false)}
                        accessibilityRole="button"
                        accessibilityLabel={t("onboarding.moving_dateDoneA11y")}
                      >
                        <Text style={styles.dateDoneText}>{t("common.done")}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button title={saving ? t("common.loading") : t("moving.newPlan")} onPress={handleComplete} loading={saving} fullWidth size="lg" />
                    </View>
                    <Button title={t("common.cancel")} onPress={() => { setWantsToMove(null); }} variant="ghost" />
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        {step < 3 && (
          <View style={styles.bottomBar}>
            {step > 0 ? (
              <Button title={t("common.back")} onPress={back} variant="ghost"
                icon={<ArrowLeft size={16} color={theme.colors.textSecondary} />} />
            ) : <View />}
            <View style={styles.bottomRight}>
              {step === 2 && (
                <Button title={t("common.skip")} onPress={skipServices} variant="ghost" loading={saving} />
              )}
              <Button
                title={saving ? t("common.loading") : t("common.continue")}
                onPress={next} loading={saving}
                disabled={step === 0 && (!profile.firstName || !profile.lastName)}
                iconRight={<ArrowRight size={16} color="#fff" />}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  progressRow: { flexDirection: "row", justifyContent: "center", gap: 8, paddingTop: 16, paddingHorizontal: 20 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)" },
  progressDotActive: { backgroundColor: theme.colors.primary },
  progressDotDone: { backgroundColor: "rgba(16,185,129,0.5)" },
  stepLabel: { fontSize: 13, color: theme.colors.textTertiary, textAlign: "center", marginTop: 12 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 },
  stepContent: { alignItems: "center" },
  stepIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: theme.colors.primaryFaded, borderWidth: 1,
    borderColor: "rgba(127, 182, 232,0.3)", alignItems: "center",
    justifyContent: "center", marginBottom: 20,
  },
  stepTitle: { fontSize: 24, fontWeight: "800", color: theme.colors.text, textAlign: "center", letterSpacing: -0.3 },
  stepDesc: { fontSize: 14, color: theme.colors.textTertiary, textAlign: "center", marginTop: 8, lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary, alignSelf: "flex-start", marginTop: 20, marginBottom: 8 },
  errorBox: {
    marginHorizontal: 24, marginTop: 8, padding: 12, borderRadius: theme.radius.lg,
    backgroundColor: "rgba(240, 140, 142, 0.10)", borderWidth: 1, borderColor: "rgba(240, 140, 142, 0.30)",
  },
  errorText: { fontSize: 13, color: "#F08C8E", textAlign: "center" },
  row: { flexDirection: "row", gap: 12, width: "100%" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primaryFaded, borderColor: "rgba(127, 182, 232,0.4)" },
  chipText: { fontSize: 14, color: theme.colors.textTertiary, fontWeight: "500" },
  chipTextActive: { color: theme.colors.primary },
  toggleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" },
  toggleChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  toggleChipActive: { backgroundColor: theme.colors.primaryFaded, borderColor: "rgba(127, 182, 232,0.4)" },
  toggleChipText: { fontSize: 13, color: theme.colors.textTertiary, fontWeight: "500" },
  toggleChipTextActive: { color: theme.colors.primary },
  counterRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    width: "100%", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  counterLabel: { fontSize: 15, color: theme.colors.text },
  counter: { flexDirection: "row", alignItems: "center", gap: 16 },
  counterBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: theme.colors.card,
    borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center",
  },
  counterBtnText: { fontSize: 20, color: theme.colors.text, fontWeight: "600" },
  counterValue: { fontSize: 18, fontWeight: "700", color: theme.colors.text, minWidth: 24, textAlign: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, width: "100%" },
  loadingBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 8 },
  loadingText: { fontSize: 14, color: theme.colors.textMuted },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: "center", paddingVertical: 40 },
  dateLabel: { fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary, marginBottom: 6 },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
  },
  dateButtonText: { flex: 1, fontSize: 15, color: theme.colors.textMuted },
  dateDoneButton: { alignSelf: "flex-end", marginTop: 4, paddingHorizontal: 8, paddingVertical: 6 },
  dateDoneText: { color: theme.colors.primary, fontWeight: "600" },
  catSection: { marginBottom: 8, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" },
  catHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.02)" },
  catTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text, flex: 1 },
  catRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  catCount: { fontSize: 11, color: theme.colors.textMuted },
  catBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: "rgba(127, 182, 232,0.2)" },
  catBadgeText: { fontSize: 10, fontWeight: "600", color: theme.colors.primary },
  providerItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  providerItemActive: { backgroundColor: "rgba(127, 182, 232,0.08)" },
  providerAvatar: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center", justifyContent: "center",
  },
  providerAvatarActive: { backgroundColor: theme.colors.primary },
  providerAvatarText: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  providerName: { fontSize: 14, fontWeight: "500", color: theme.colors.text },
  providerDesc: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  providerMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  scopeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  scopeFederal: { backgroundColor: "rgba(59,130,246,0.15)" },
  scopeState: { backgroundColor: "rgba(16,185,129,0.15)" },
  scopeText: { fontSize: 9, fontWeight: "600" },
  scopeFederalText: { color: "#60a5fa" },
  scopeStateText: { color: "#34d399" },
  catIcon: { fontSize: 16, marginRight: 4 },
  recoSection: {
    marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.card, padding: 14, width: "100%",
  },
  recoHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  recoTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  recoCard: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "rgba(255,255,255,0.02)",
    marginBottom: 6,
  },
  recoCardActive: { borderColor: "rgba(127, 182, 232,0.4)", backgroundColor: theme.colors.primaryFaded },
  recoReason: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
  bottomBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  bottomRight: { flexDirection: "row", alignItems: "center", gap: 8 },
});
