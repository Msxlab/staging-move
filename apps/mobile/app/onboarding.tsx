import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
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
import { LinearGradient } from "expo-linear-gradient";
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
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Input } from "@/components/ui/Input";
import { ServiceLogoMark } from "@/components/services/ServiceLogoMark";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { PressableScale } from "@/components/ui/PressableScale";
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
import {
  detectStateZipMismatch,
  generateChecklist,
  type UserChecklistProfile,
  type RelocationChecklist,
  type ChecklistStateRuleContext,
} from "@locateflow/shared";
import { MoveTeaserCard } from "@/components/ui/MoveTeaserCard";
import { LogoBrand } from "@/components/ui/LogoBrand";
import {
  ProShowcaseCard,
  hasProShowcaseContext,
} from "@/components/onboarding/ProShowcaseCard";
import { consumePendingInviteJoin } from "@/lib/workspace-invite";
import {
  StepTransition,
  StaggerItem,
  OnboardingProgressBar,
  useShake,
} from "@/components/onboarding/onboarding-motion";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { ObCoach } from "@/components/ui/ObCoach";
import { coachCopyKeys } from "@/components/ui/ob-coach-state";
import { computeOnboardingDataQuality } from "@/lib/onboarding-data-quality";
import { NotificationPrimingCard } from "@/components/onboarding/NotificationPrimingCard";

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

/**
 * ScanDot / ScanDots — the providers-step "scanning" pulse (design bundle-3
 * onb-flows.jsx scan ritual, mobile-sized). Three dots breathe in sequence
 * while recommendations load, then the result rows stagger in. Pure
 * decoration: runs on the Reanimated UI thread, loops are cancelled on
 * unmount, and reduce-motion renders calm static dots.
 */
function ScanDot({ index, color }: { index: number; color: string }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 0.6 : 0.35);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.6;
      return;
    }
    pulse.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }),
          withTiming(0.35, { duration: 440, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [index, reduceMotion, pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.8 + pulse.value * 0.3 }],
  }));

  return (
    <Animated.View
      style={[{ width: 7, height: 7, borderRadius: 999, backgroundColor: color }, dotStyle]}
    />
  );
}

function ScanDots({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <ScanDot key={i} index={i} color={color} />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();
  const { resolvedScheme } = useThemePreference();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const lastScrollYRef = useRef(0);
  // Inline validation feedback: a gentle horizontal wobble on the step content
  // whenever a save fails its checks. Paired with the existing coral error box +
  // hapticError for a clear "that didn't go through" read. Reduce-motion-safe
  // (shake() no-ops; the colour + haptic still fire).
  const { animatedStyle: shakeStyle, shake } = useShake();
  // Bumped whenever a step is successfully completed (validation passed + saved).
  // Drives the progress-bar's one-shot confirmation shimmer; paired with a
  // success haptic. Purely cosmetic — never gates navigation.
  const [pulseTick, setPulseTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Per-field validation errors (currently the required name fields). Surfacing
  // the error ON the offending field — coral border + inline message via the
  // shared Input — is clearer than the single top error box alone. Cleared as
  // soon as the user edits the field.
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [legalConsents, setLegalConsents] = useState(() => getPendingLegalConsents() || getDefaultLegalConsents());
  // Set when this user reached onboarding straight after auto-joining a
  // workspace via an invite link. We show a "you've joined" banner and DON'T
  // push them to create their own moving plan — they're a member, not an owner
  // setting up a fresh household. false = normal (owner) onboarding.
  const [joinedAsMember, setJoinedAsMember] = useState(false);

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
  // Essential categories the engine flagged as having NO matching provider /
  // service for this user (e.g. Electric, Insurance). The engine computes this
  // as stats.missingCritical; the web surfaces it but the mobile screen used to
  // drop it. We capture it here to show a gentle "you still need…" nudge.
  const [missingCritical, setMissingCritical] = useState<string[]>([]);
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

  // FREEMIUM: the moving plan is a paid unlock. A FREE user who enters move
  // details does NOT create a MovingPlan — instead we compute a value-first
  // teaser (countdown + top personalized steps) from the shared engine and show
  // it inline, then route to the upgrade page on "Unlock". Only a genuinely
  // paid user keeps the legacy create-the-plan flow. We resolve entitlement once
  // on mount; a new signup (the overwhelming majority of onboarding) is free.
  const [isPremium, setIsPremium] = useState(false);
  // The ephemeral, NEVER-persisted checklist powering the teaser preview. Set
  // when a free user submits the move step; cleared if they edit/cancel.
  const [teaserChecklist, setTeaserChecklist] = useState<RelocationChecklist | null>(null);
  // Snapshot of the route/date the teaser was computed for (so the card shows
  // the right countdown + "from → to" even as the form fields are reused).
  const [teaserMeta, setTeaserMeta] = useState<{ fromState: string; toState: string; moveDate: string } | null>(null);
  const [buildingTeaser, setBuildingTeaser] = useState(false);

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
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Catch-all auto-join: every post-auth path for a brand-new account routes
  // through onboarding (getPostAuthMobileRoute → "/onboarding"). If the user
  // arrived here straight from an invite link, consume the stashed token now so
  // they're joined to the inviting workspace before they finish setup. The auth
  // screens also call this; the helper clears the token + the accept endpoint is
  // idempotent, so a duplicate call is a harmless ALREADY_MEMBER no-op.
  useEffect(() => {
    let cancelled = false;
    void consumePendingInviteJoin()
      .then((res) => {
        if (cancelled || !res || !res.ok) return;
        // A joining member is NOT an owner setting up a fresh household — flag it
        // so we skip the "create your own moving plan" push below. We don't have
        // the workspace name from the accept result, so the banner uses generic
        // "household" copy; the role is what gates the member onboarding path.
        if (res.role !== "OWNER") {
          setJoinedAsMember(true);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

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
      // Resolve effective entitlement → only a paid tier keeps the legacy
      // create-a-plan flow; everyone else gets the value-first teaser. Mirrors
      // the dashboard's hasPremium derivation (entitlement first, subscription
      // fallback). An inherited Family/Pro member is premium even with no own row.
      {
        const ent = res.data?.entitlement;
        const sub = res.data?.subscription || {};
        const hasPremium = ent
          ? ent.isActive === true && ent.plan && ent.plan !== "FREE_TRIAL"
          : Boolean(
              sub.plan &&
                sub.plan !== "FREE_TRIAL" &&
                (sub.status === "ACTIVE" || (sub.premiumUntil && new Date(sub.premiumUntil) > new Date())),
            );
        setIsPremium(!!hasPremium);
      }
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
      const missing = res.data?.stats?.missingCritical;
      setMissingCritical(Array.isArray(missing) ? missing : []);
    } catch {
      setProviders([]);
      setMissingCritical([]);
    } finally {
      setLoadingProviders(false);
    }
  }, [address.latitude, address.longitude, address.state, address.zip, createdAddressId]);

  useEffect(() => {
    if (step === 2) fetchProviders();
  }, [step, fetchProviders]);

  const updateProfile = (key: string, value: any) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    // Clear a field's inline error the moment the user starts fixing it.
    if (key === "firstName" || key === "lastName") {
      setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    }
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
      setFieldErrors({
        firstName: profile.firstName.trim() ? undefined : t("onboarding.error_namesRequired"),
        lastName: profile.lastName.trim() ? undefined : t("onboarding.error_namesRequired"),
      });
      return false;
    }
    setFieldErrors({});
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

  // Shared move-destination validation used by BOTH the legacy paid create flow
  // and the free teaser. Returns true when the destination + date are valid;
  // sets the coral error + returns false otherwise (caller fires the shake).
  const validateMoveDestination = (): boolean => {
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
    return true;
  };

  // FREE PATH: compute the value-first teaser from the entered move details and
  // the shared checklist engine — NO MovingPlan is persisted (contract: free
  // never creates a plan). Every step/reason shown comes from real
  // STATE_DMV_DEADLINES data + the user's own profile, never invented.
  const buildTeaser = async () => {
    hapticLight();
    if (!validateMoveDestination()) {
      hapticError();
      shake();
      return;
    }
    setError("");
    setBuildingTeaser(true);
    try {
      const checklistProfile: UserChecklistProfile = {
        hasChildren: profile.hasChildren,
        childrenCount: profile.childrenCount,
        hasPets: profile.hasPets,
        hasSenior: profile.hasSenior,
        carCount: profile.carCount,
        hasDisability: profile.hasDisability,
        needsStorage: profile.needsStorage,
        hasMotorcycle: profile.hasMotorcycle,
        hasBoatRV: profile.hasBoatRV,
        isImmigrant: profile.isImmigrant,
        isBusinessOwner: profile.isBusinessOwner,
        moveType: profile.moveType as UserChecklistProfile["moveType"],
      };
      const fromState = address.state.trim().toUpperCase();
      const toState = movingForm.state.trim().toUpperCase();
      // Optional state-rule enrichment for richer DMV/voter/tax notes. Best-effort:
      // the engine produces honest deadlines from STATE_DMV_DEADLINES without it.
      let stateRule: ChecklistStateRuleContext | null = null;
      try {
        const stateRuleRes = await api.get<any>("/api/state-rules", { state: toState });
        stateRule = stateRuleRes.data?.stateRule || null;
      } catch {
        stateRule = null;
      }
      const cl = generateChecklist(
        checklistProfile,
        new Date(`${movingForm.moveDate}T00:00:00Z`),
        fromState,
        toState,
        new Set<string>(),
        stateRule,
      );
      setTeaserChecklist(cl);
      setTeaserMeta({ fromState, toState, moveDate: movingForm.moveDate });
      hapticSuccess();
    } catch {
      // The engine is pure + local, so a failure here is unexpected; fall back to
      // the no-dead-end rule by routing the user to the dashboard via skip.
      setError(t("onboarding.error_savePlan"));
      hapticError();
      shake();
    } finally {
      setBuildingTeaser(false);
    }
  };

  // Complete onboarding WITHOUT a moving plan (free path). Used by the teaser's
  // "Unlock" CTA (then routes to the subscription page) and by a plain
  // skip-to-dashboard. Never POSTs /api/moving, so it can't 403 / dead-end.
  const completeWithoutPlan = async (after: "subscription" | "dashboard") => {
    setSaving(true);
    setError("");
    try {
      if (selectedProviders.size === 0 && Object.keys(createdServiceIds).length === 0) {
        await recordOnboardingProgress("SERVICES_SKIPPED");
      }
      await recordOnboardingProgress("MOVING_SKIPPED");
      await recordOnboardingProgress("COMPLETED");
      const profileRes = await api.get<any>("/api/profile");
      if (profileRes.error) throw new Error(profileRes.error);
      if (profileRes.data?.onboardingCompleted !== true) {
        throw new Error(t("onboarding.error_onboardingIncomplete"));
      }
      hapticSuccess();
      await maybeOfferPushSoftPrompt();
      if (after === "subscription") {
        // Land on the dashboard underneath, then open the upgrade page — so
        // dismissing the subscription screen leaves the user in the app, not
        // back at onboarding.
        router.replace("/(tabs)");
        router.push("/settings/subscription");
      } else {
        router.replace("/(tabs)");
      }
      return true;
    } catch (e: any) {
      setError(e?.message || t("onboarding.error_completeOnboarding"));
      hapticError();
      shake();
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    const planId = await saveMovingPlan();
    if (planId === false) {
      // saveMovingPlan already set the coral error message; mirror the inline
      // shake + error haptic the other steps give so a failed destination
      // validation reads the same whether it came via "Continue" or a direct
      // "New plan" / "Go to dashboard" button on the final step.
      hapticError();
      shake();
      return false;
    }

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

  // Gentle confirmation when a step is genuinely completed: a soft success
  // haptic + a progress-bar shimmer. Both no-op safely (haptics are platform
  // guarded; the shimmer honours reduce-motion inside the progress bar).
  const celebrateStepComplete = () => {
    hapticSuccess();
    setPulseTick((tick) => tick + 1);
  };

  const next = async () => {
    hapticLight();
    let ok = true;
    if (step === 0) ok = await saveProfile();
    else if (step === 1) ok = await saveAddress();
    else if (step === 2) ok = await saveServices();
    if (!ok) { hapticError(); shake(); return; }
    if (step === 2 && await routeIfOnboardingCompleted()) return;
    if (step < 3) {
      celebrateStepComplete();
      setStep(step + 1);
      setError("");
    }
    else {
      // Unreachable in practice (the bottom "Continue" bar only renders for
      // step < 3; the final step completes via its own buttons → handleComplete,
      // which already shakes on failure). Kept defensive; handleComplete owns
      // the failure feedback so we don't double-fire it here.
      await handleComplete();
    }
  };

  const skipServices = async () => {
    hapticLight();
    const ok = await saveServices();
    if (!ok) {
      hapticError();
      shake();
      return;
    }
    if (await routeIfOnboardingCompleted()) return;
    celebrateStepComplete();
    setStep(3);
    setError("");
  };

  const back = () => { if (step > 0) { setStep(step - 1); setError(""); } };

  // Top recommendation per category (best provider, deduped, sorted by urgency).
  // We split it into two clearly-separated buckets so the user leads with the
  // must-haves and isn't asked to weigh "set up electricity" against "add a gym":
  //   • essentials  → CRITICAL/IMPORTANT tiers (electric, gas, water, internet,
  //                   DMV, insurance, bank…) — the "Recommended for your move" set.
  //   • extras      → RECOMMENDED/OPTIONAL tiers (gym, streaming, shopping…).
  // Both come straight from the engine's already-tier-sorted output, so we never
  // fabricate providers — we only partition what the API returned.
  const recommended = useMemo(() => getRecommendedProviders(providers, 12), [providers]);
  const essentialRecommended = useMemo(
    () => recommended.filter((p) => p.urgencyTier === "CRITICAL" || p.urgencyTier === "IMPORTANT"),
    [recommended],
  );
  const extraRecommended = useMemo(
    () => recommended.filter((p) => p.urgencyTier !== "CRITICAL" && p.urgencyTier !== "IMPORTANT"),
    [recommended],
  );
  // How many of the essential picks aren't selected yet — drives the one-tap
  // "Add all" button (and lets us flip it to a "done" state once they're all in).
  const unselectedEssentialCount = useMemo(
    () => essentialRecommended.reduce((n, p) => (selectedProviders.has(p.id) ? n : n + 1), 0),
    [essentialRecommended, selectedProviders],
  );

  // One-tap: select every essential pick the user hasn't already added. Purely
  // additive — it never deselects, so a user who tapped one extra keeps it, and
  // they can still deselect any single card afterward.
  const addAllEssentials = useCallback(() => {
    hapticSuccess();
    setSelectedProviders((prev) => {
      const next = new Map(prev);
      for (const provider of essentialRecommended) {
        if (!next.has(provider.id)) next.set(provider.id, provider);
      }
      return next;
    });
  }, [essentialRecommended]);

  // Shared compact recommendation card (used by both the essentials and the
  // optional-extras lists so they stay visually identical and there's no
  // duplicated JSX). `keyId` keeps the two lists' React keys distinct.
  const renderRecoCard = (provider: ScoredProvider, index: number, keyId: string) => {
    const isSelected = selectedProviders.has(provider.id);
    const reason = getLocalizedProviderReason(t, i18n.language, provider, categoryLabel(provider.category));
    return (
      // Slower per-row cascade than the default StaggerItem rhythm — after the
      // scan dots, the recommendation rows "land" one by one (the bundle's
      // reveal feel) instead of appearing as a block. Reduce-motion settles
      // instantly via StaggerItem itself.
      <StaggerItem key={keyId} index={index} baseDelay={56} maxDelay={420}>
        <PressableScale
          style={[styles.recoCard, isSelected && styles.recoCardActive]}
          onPress={() => { hapticLight(); toggleProvider(provider as any); }}
          min={0.97}
          accessibilityLabel={provider.name}
        >
          <ServiceLogoMark
            service={{
              category: provider.category,
              providerName: provider.name,
              website: provider.website,
              provider: { name: provider.name, logoUrl: provider.logoUrl, website: provider.website },
            }}
            fallbackIcon={getMergedDisplayCategoryIcon(provider.category)}
            size={36}
            logoSize={30}
            borderRadius={10}
            backgroundColor={isSelected ? theme.colors.primary : "rgba(255,255,255,0.05)"}
            borderColor={theme.colors.rose.border}
            fallbackFontSize={16}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.providerName} numberOfLines={1}>{provider.name}</Text>
            <Text style={styles.recoReason} numberOfLines={1}>{reason}</Text>
          </View>
          {isSelected && <Check size={16} color={theme.colors.primary} />}
        </PressableScale>
      </StaggerItem>
    );
  };

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

  // Essential categories the user still has no provider for — gentle nudge.
  // Drop any the user has just picked a provider for in this step so the hint
  // stays current as they select, and de-duplicate by readable label (several
  // raw categories merge into one display label, e.g. the insurance family).
  const selectedCategories = useMemo(
    () => new Set(Array.from(selectedProviders.values()).map((p) => p.category)),
    [selectedProviders],
  );
  const missingCriticalLabels = useMemo(() => {
    const labels: string[] = [];
    const seen = new Set<string>();
    for (const category of missingCritical) {
      if (selectedCategories.has(category)) continue;
      const label = categoryLabel(category);
      if (seen.has(label)) continue;
      seen.add(label);
      labels.push(label);
    }
    return labels;
  }, [missingCritical, selectedCategories, categoryLabel]);

  // COACH layer (owner decision, design bundle-3): every onboarding step
  // carries a short honest explainer of why accurate data on this step makes
  // the AI's suggestions better ("accurate data → accurate recommendations").
  // ObCoach owns the per-user collapse persistence; this only picks the copy.
  const coachKeysForStep = coachCopyKeys(step);

  // DATA QUALITY (design `.ob-quality`): honest profile-completeness only —
  // every point maps to a signal the recommendation/checklist engines really
  // use (household profile, address, kept providers, destination + date).
  // Pure mapper, unit-tested in src/lib/onboarding-data-quality.test.ts.
  const dataQuality = useMemo(
    () =>
      computeOnboardingDataQuality({
        hasName: Boolean(profile.firstName.trim() && profile.lastName.trim()),
        hasAgeRange: Boolean(profile.ageRange),
        householdSignals:
          [
            profile.hasChildren,
            profile.hasPets,
            profile.hasSenior,
            profile.needsStorage,
            profile.hasMotorcycle,
            profile.hasBoatRV,
          ].filter(Boolean).length + (profile.carCount > 0 ? 1 : 0),
        hasAddress: Boolean(
          address.street.trim() && address.city.trim() && address.state.trim() && address.zip.trim(),
        ),
        providersKept: selectedProviders.size,
        hasDestinationState: wantsToMove === true && movingForm.state.trim().length === 2,
        hasMoveDate: wantsToMove === true && Boolean(movingForm.moveDate),
      }),
    [profile, address, selectedProviders, wantsToMove, movingForm.state, movingForm.moveDate],
  );

  const coachCallout = coachKeysForStep ? (
    <ObCoach
      eyebrow={t(coachKeysForStep.eyebrowKey)}
      body={t(coachKeysForStep.bodyKey)}
      quality={dataQuality}
      style={{ marginTop: 16 }}
    />
  ) : null;

  // Real disabled state for the bottom CTA (no opacity hack): neutral fill +
  // lock glyph + a short inline hint explaining what unlocks it. Gates mirror
  // each step's REQUIRED fields only (names on step 0, the four required
  // address parts on step 1) — deeper checks (state/ZIP mismatch, legal
  // consents) still run on submit with the same error + shake as before.
  const missingRequiredAddress =
    !address.street.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim();
  const continueDisabled =
    (step === 0 && (!profile.firstName || !profile.lastName)) ||
    (step === 1 && missingRequiredAddress);
  const headerCompact = keyboardVisible || headerCollapsed;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {/* Aurora onboarding chrome: compact brand stage + named step rail.
            Pure presentation; all production save/skip/payment paths below
            stay unchanged. */}
        <View style={[styles.onboardingHeader, headerCompact && styles.onboardingHeaderCompact]}>
          <LinearGradient
            colors={[`${theme.colors.primary}24`, `${theme.colors.accent}10`, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {headerCompact ? (
            <View style={styles.compactHeaderRow}>
              <LogoBrand size="sm" />
              <View style={styles.compactHeaderCopy}>
                <Text style={styles.compactHeaderKicker}>
                  {t("onboarding.stepIndicator", { current: step + 1, total: STEP_KEYS.length, label: t(STEP_KEYS[step]) })}
                </Text>
                <Text style={styles.compactHeaderTitle} numberOfLines={1}>
                  {t(STEP_KEYS[step])}
                </Text>
              </View>
              <View style={styles.headerPill}>
                <Text style={styles.headerPillText}>{step + 1}/{STEP_KEYS.length}</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.headerBrandRow}>
                <LogoBrand size="sm" />
                <View style={styles.headerCopy}>
                  <Text style={styles.headerKicker}>
                    {t("onboarding.headerKicker", { defaultValue: "A moving companion" })}
                  </Text>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {t("onboarding.headerTitle", { defaultValue: "Move once. Remember everything." })}
                  </Text>
                </View>
                <View style={styles.headerPill}>
                  <Text style={styles.headerPillText}>{step + 1}/{STEP_KEYS.length}</Text>
                </View>
              </View>
              <View
                style={styles.stepRail}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 1, max: STEP_KEYS.length, now: step + 1 }}
              >
                {STEP_KEYS.map((key, index) => {
                  const active = index === step;
                  const complete = index < step;
                  return (
                    <View key={key} style={styles.stepRailItem}>
                      <View
                        style={[
                          styles.stepRailDot,
                          (active || complete) && styles.stepRailDotOn,
                          active && styles.stepRailDotActive,
                        ]}
                      >
                        {complete ? <Check size={9} color={theme.colors.background} /> : null}
                      </View>
                      <Text
                        style={[
                          styles.stepRailLabel,
                          active && styles.stepRailLabelOn,
                        ]}
                        numberOfLines={1}
                      >
                        {t(key)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
          <OnboardingProgressBar step={step} total={STEP_KEYS.length} pulseTick={pulseTick} />
        </View>
        {!headerCompact && (
          <Text style={styles.stepLabel}>
            {t("onboarding.stepIndicator", { current: step + 1, total: STEP_KEYS.length, label: t(STEP_KEYS[step]) })}
          </Text>
        )}

        {error ? (
          <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
        ) : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            headerCompact && styles.scrollContentCompact,
            keyboardVisible && styles.scrollContentKeyboard,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          scrollEventThrottle={16}
          onScroll={({ nativeEvent }) => {
            const y = nativeEvent.contentOffset.y;
            const lastY = lastScrollYRef.current;
            if (y > lastY + 10 && y > 12) {
              setHeaderCollapsed(true);
            } else if (y < lastY - 10 || y <= 4) {
              setHeaderCollapsed(false);
            }
            lastScrollYRef.current = y;
          }}
        >
          {/* Each step's content cross-fades + lifts 8px on entry. Keyed on
              `step` so it remounts per step, which also re-triggers the
              staggered option lists inside. Reduce-motion settles instantly.
              The outer shake view wobbles the whole step on a failed save —
              its shared value lives outside StepTransition so a per-step
              remount never resets a shake mid-play. */}
          <Animated.View style={shakeStyle}>
          <StepTransition stepKey={step}>
          {/* Step 0: Profile */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <View style={styles.stepIcon}><User size={28} color={theme.colors.primary} /></View>
              <Text style={styles.stepTitle}>{t("onboarding.profile_title")}</Text>
              <Text style={styles.stepDesc}>{t("onboarding.profile_description")}</Text>
              {coachCallout}

              <View style={[styles.row, { marginTop: 24 }]}>
                <View style={{ flex: 1 }}>
                  <Input label={`${t("auth.firstName")} *`} placeholder="John" value={profile.firstName}
                    error={fieldErrors.firstName}
                    onChangeText={(v: string) => updateProfile("firstName", v)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label={`${t("auth.lastName")} *`} placeholder="Doe" value={profile.lastName}
                    error={fieldErrors.lastName}
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
              {coachCallout}
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
              {coachCallout}

              <View style={styles.searchRow}>
                <Search size={16} color={theme.colors.textMuted} />
                <Input placeholder={t("onboarding.providers_searchPlaceholder")} value={providerSearch}
                  onChangeText={setProviderSearch}
                  containerStyle={{ flex: 1, marginBottom: 0 }} />
              </View>

              {/* Missing-essentials nudge. The engine flags essential
                  categories the user has no provider for (stats.missingCritical);
                  surface a gentle reminder so they don't leave step 2 without
                  the must-haves (e.g. Electric, Insurance). Hidden while
                  searching and once every flagged category is covered. */}
              {!loadingProviders && !providerSearch && missingCriticalLabels.length > 0 && (
                <View style={styles.missingNudge} accessibilityRole="summary">
                  <Sparkles size={16} color={theme.colors.amber.text} />
                  <Text style={styles.missingNudgeText}>
                    {t("onboarding.providers_missingCritical", {
                      defaultValue: "You still need: {{categories}}",
                      categories: missingCriticalLabels.join(", "),
                    })}
                  </Text>
                </View>
              )}

              {/* Essentials — lead with the must-haves for a move (utilities,
                  DMV, insurance, bank…). Clearly labelled "Recommended for your
                  move" and visually set apart from the optional extras below so
                  the decision load is "add these few" rather than "scan a list".
                  The one-tap "Add all" selects every essential pick at once. */}
              {!loadingProviders && !providerSearch && essentialRecommended.length > 0 && (
                <View style={styles.recoSection}>
                  <View style={styles.recoHeaderRow}>
                    <View style={styles.recoHeader}>
                      <Sparkles size={16} color={theme.colors.amber.text} />
                      <Text style={styles.recoTitle}>{t("onboarding.providers_essentialsTitle", { defaultValue: "Recommended for your move" })}</Text>
                    </View>
                    {unselectedEssentialCount > 0 ? (
                      <TouchableOpacity
                        style={styles.addAllBtn}
                        onPress={addAllEssentials}
                        accessibilityRole="button"
                        accessibilityLabel={t("onboarding.providers_addAllA11y", { defaultValue: "Add all recommended essentials", count: unselectedEssentialCount })}
                      >
                        <Check size={13} color={theme.colors.primary} />
                        <Text style={styles.addAllBtnText}>
                          {t("onboarding.providers_addAll", { defaultValue: "Add all", count: unselectedEssentialCount })}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.addAllDone} accessibilityRole="text">
                        <Check size={13} color={theme.colors.success} />
                        <Text style={styles.addAllDoneText}>{t("onboarding.providers_allAdded", { defaultValue: "All added" })}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.recoSubtle}>
                    {t("onboarding.providers_essentialsHint", { defaultValue: "Tap one to deselect — you're in control." })}
                  </Text>
                  {essentialRecommended.map((provider: ScoredProvider, recoIndex: number) =>
                    renderRecoCard(provider, recoIndex, `ess-${provider.id}`),
                  )}
                </View>
              )}

              {/* Optional extras — clearly separated, lower-stakes picks the
                  engine surfaced for this profile (gym, streaming, shopping…).
                  Same card UI, but framed as "nice to have" so nobody feels they
                  must tap through them. Hidden while searching. */}
              {!loadingProviders && !providerSearch && extraRecommended.length > 0 && (
                <View style={[styles.recoSection, styles.recoSectionExtras]}>
                  <View style={styles.recoHeader}>
                    <Text style={styles.recoTitleMuted}>{t("onboarding.providers_extrasTitle", { defaultValue: "Optional extras" })}</Text>
                  </View>
                  {extraRecommended.map((provider: ScoredProvider, recoIndex: number) =>
                    renderRecoCard(provider, recoIndex, `extra-${provider.id}`),
                  )}
                </View>
              )}

              {loadingProviders ? (
                // Staged scan ritual (design bundle-3 scan step): three pulsing
                // dots + an honest "scanning" line over placeholder cards, then
                // the recommendation rows stagger in below once the fetch lands.
                // Dots and skeletons both honour reduce-motion.
                <View style={{ width: "100%", marginTop: 16 }}>
                  <View style={styles.loadingBox}>
                    <ScanDots color={theme.colors.primary} />
                    <Text style={styles.loadingText}>
                      {address.state
                        ? t("onboarding.providers_scanningState", {
                            defaultValue: "Scanning {{state}} providers for your move…",
                            state: address.state,
                          })
                        : t("onboarding.providers_scanning", {
                            defaultValue: "Scanning providers for your move…",
                          })}
                    </Text>
                  </View>
                  <View style={{ gap: 10, marginTop: 4 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <SkeletonCard key={i} lines={2} />
                    ))}
                  </View>
                </View>
              ) : sortedCats.length === 0 ? (
                <View style={styles.emptyProviders}>
                  <Search size={28} color={theme.colors.textMuted} />
                  <Text style={styles.emptyText}>{t("onboarding.providers_empty")}</Text>
                </View>
              ) : (
                <View style={{ marginTop: 12, width: "100%" }}>
                  {sortedCats.map((cat, catIndex) => {
                    const items = grouped[cat];
                    const isOpen = expandedCats.has(cat);
                    const selectedCount = items.filter((p: ScoredProvider) => selectedProviders.has(p.id)).length;
                    return (
                      <StaggerItem key={cat} index={catIndex} style={styles.catSection}>
                        <TouchableOpacity style={styles.catHeader} onPress={() => toggleCat(cat)}>
                          <View style={styles.catIcon}>
                            <CategoryIcon emoji={getMergedDisplayCategoryIcon(cat)} size={16} color={theme.colors.primary} />
                          </View>
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
                                <ServiceLogoMark
                                  service={{
                                    category: provider.category,
                                    providerName: provider.name,
                                    website: provider.website,
                                    provider: { name: provider.name, logoUrl: provider.logoUrl, website: provider.website },
                                  }}
                                  fallbackIcon={getMergedDisplayCategoryIcon(provider.category)}
                                  size={36}
                                  logoSize={30}
                                  borderRadius={10}
                                  backgroundColor={sel ? theme.colors.primary : "rgba(255,255,255,0.05)"}
                                  borderColor={theme.colors.rose.border}
                                  fallbackFontSize={16}
                                />
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
                                      <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: theme.colors.successFaded }}>
                                        <Text style={{ fontSize: 9, fontWeight: "600", color: theme.colors.success }}>${bd.monthlyCost}/mo</Text>
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
                                      style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: (bd?.billingCycle || "MONTHLY") === cycle ? theme.colors.primaryFaded : theme.colors.surface, borderWidth: 1, borderColor: (bd?.billingCycle || "MONTHLY") === cycle ? theme.colors.borderFocus : theme.colors.border }}>
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
                      </StaggerItem>
                    );
                  })}
                </View>
              )}

              {/* Reassure that skipping isn't a dead-end. The bottom-bar
                  "Add later" button records SERVICES_SKIPPED (not a hard skip) —
                  the dashboard checklist and the win-back reminders surface
                  these essentials again, so nobody loses them by moving on. */}
              {!loadingProviders && (
                <Text style={styles.skipReassure}>
                  {t("onboarding.providers_skipReassure", {
                    defaultValue: "Not ready? Tap “Add later” — we'll keep these on your move checklist and remind you.",
                  })}
                </Text>
              )}
            </View>
          )}

          {/* Step 3: Moving */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <View style={[styles.stepIcon, { backgroundColor: theme.colors.successFaded, borderColor: theme.colors.emerald.border }]}>
                <Truck size={28} color={theme.colors.success} />
              </View>
              <Text style={styles.stepTitle}>{t("onboarding.moving_title")}</Text>
              <Text style={styles.stepDesc}>
                {t("onboarding.moving_description")}
              </Text>
              {coachCallout}

              {joinedAsMember && (
                <View style={styles.memberBanner}>
                  <Text style={styles.memberBannerText}>
                    {t(
                      "onboarding.invitedMemberMovingNote",
                      "You've joined a household. A move plan is optional — your household's owner manages the shared move. You can add your own any time.",
                    )}
                  </Text>
                </View>
              )}

              {wantsToMove === null && (
                <View style={{ marginTop: 32, gap: 12, width: "100%" }}>
                  {/* A joining member shouldn't be pushed to create their own
                      move plan, so for them "Not right now" is the primary
                      action and "plan a move" the secondary one. */}
                  {joinedAsMember ? (
                    <>
                      <Button title={t("onboarding.moving_no")} onPress={() => { hapticLight(); setWantsToMove(false); }} fullWidth size="cta" />
                      <Button title={t("onboarding.moving_yes")} onPress={() => { hapticLight(); setWantsToMove(true); }} variant="ghost" fullWidth size="lg" />
                    </>
                  ) : (
                    <>
                      <Button title={t("onboarding.moving_yes")} onPress={() => { hapticLight(); setWantsToMove(true); }} fullWidth size="cta" />
                      <Button title={t("onboarding.moving_no")} onPress={() => { hapticLight(); setWantsToMove(false); }} variant="ghost" fullWidth size="lg" />
                    </>
                  )}
                </View>
              )}

              {wantsToMove === false && (
                <View style={{ marginTop: 24, alignItems: "center", gap: 12, width: "100%" }}>
                  <Check size={40} color={theme.colors.success} style={{ opacity: 0.5 }} />
                  <Text style={[styles.stepDesc, { marginTop: 0 }]}>{t("onboarding.moving_skipped")}</Text>
                  <Button title={t("onboarding.goToDashboard")} onPress={handleComplete} loading={saving} fullWidth size="cta" />
                </View>
              )}

              {/* FREE TEASER: once we've computed the ephemeral preview, show the
                  value-first teaser card (countdown + top personalized steps +
                  Unlock CTA) in place of the form. No MovingPlan was persisted. */}
              {wantsToMove === true && !isPremium && teaserChecklist && teaserMeta && (
                <View style={{ marginTop: 20, gap: 12, width: "100%" }}>
                  <MoveTeaserCard
                    checklist={teaserChecklist}
                    fromState={teaserMeta.fromState}
                    toState={teaserMeta.toState}
                    moveDate={teaserMeta.moveDate}
                    busy={saving}
                    onUnlock={() => completeWithoutPlan("subscription")}
                  />
                  <Button
                    title={t("onboarding.teaser_continueFree", { defaultValue: "Continue with the free plan" })}
                    onPress={() => completeWithoutPlan("dashboard")}
                    variant="ghost"
                    fullWidth
                    loading={saving}
                  />
                  <Button
                    title={t("onboarding.teaser_editMove", { defaultValue: "Edit move details" })}
                    onPress={() => { setTeaserChecklist(null); setTeaserMeta(null); }}
                    variant="ghost"
                  />
                </View>
              )}

              {wantsToMove === true && !(!isPremium && teaserChecklist) && (
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
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowMoveDatePicker(true);
                      }}
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
                    {showMoveDatePicker && Platform.OS === "ios" ? (
                      <View style={styles.datePickerPanel}>
                        <View style={styles.datePickerToolbar}>
                          <Text style={styles.datePickerTitle}>{t("onboarding.moving_dateLabel")}</Text>
                          <TouchableOpacity
                            style={styles.datePickerDone}
                            onPress={() => setShowMoveDatePicker(false)}
                            accessibilityRole="button"
                            accessibilityLabel={t("onboarding.moving_dateDoneA11y")}
                          >
                            <Text style={styles.datePickerDoneText}>{t("common.done")}</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={movingForm.moveDate ? new Date(`${movingForm.moveDate}T00:00:00`) : new Date()}
                          mode="date"
                          display="spinner"
                          minimumDate={new Date()}
                          onChange={(_event: any, date?: Date) => {
                            if (date) {
                              updateMoving("moveDate", date.toISOString().slice(0, 10));
                            }
                          }}
                          themeVariant={resolvedScheme}
                          textColor={theme.colors.text}
                        />
                      </View>
                    ) : showMoveDatePicker ? (
                      <DateTimePicker
                        value={movingForm.moveDate ? new Date(`${movingForm.moveDate}T00:00:00`) : new Date()}
                        mode="date"
                        display="default"
                        minimumDate={new Date()}
                        onChange={(_event: any, date?: Date) => {
                          setShowMoveDatePicker(false);
                          if (date) {
                            updateMoving("moveDate", date.toISOString().slice(0, 10));
                          }
                        }}
                        themeVariant={resolvedScheme}
                        textColor={theme.colors.text}
                      />
                    ) : null}
                  </View>
                  {/* Aspirational "what Pro unlocks for YOUR move" showcase —
                      built from the REAL entered context (origin → destination
                      state + household). SHOWCASE, not a paywall: the only
                      action is a quiet "See Pro" link to the upgrade surface;
                      the primary CTA below proceeds normally. Only once a
                      destination state is typed, never for paid users. NO
                      payment step here. */}
                  {!isPremium &&
                    hasProShowcaseContext({
                      fromState: address.state || null,
                      toState: movingForm.state || null,
                      hasChildren: profile.hasChildren,
                      hasPets: profile.hasPets,
                    }) && (
                      <ProShowcaseCard
                        context={{
                          fromState: address.state || null,
                          toState: movingForm.state || null,
                          hasChildren: profile.hasChildren,
                          hasPets: profile.hasPets,
                        }}
                        fromLabel={address.state || t("onboarding.proShowcase_yourState", { defaultValue: "your state" })}
                        toLabel={movingForm.state || t("onboarding.proShowcase_yourState", { defaultValue: "your state" })}
                        onSeePro={() => completeWithoutPlan("subscription")}
                      />
                    )}
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      {isPremium ? (
                        // Paid user → the unchanged create-the-plan flow.
                        <Button title={saving ? t("common.loading") : t("moving.newPlan")} onPress={handleComplete} loading={saving} fullWidth size="cta" />
                      ) : (
                        // Free user → compute the value-first teaser (no plan persisted).
                        <Button
                          title={buildingTeaser ? t("common.loading") : t("onboarding.teaser_preview", { defaultValue: "See my plan preview" })}
                          onPress={buildTeaser}
                          loading={buildingTeaser}
                          fullWidth
                          size="cta"
                          iconRight={<Sparkles size={16} color="#fff" />}
                        />
                      )}
                    </View>
                    <Button title={t("common.cancel")} onPress={() => { setWantsToMove(null); }} variant="ghost" />
                  </View>
                </View>
              )}

              {/* Final-step notification priming (design bundle-3 PermissionBody,
                  notifications row ONLY — location is owner-vetoed). Explicit
                  toggle-on records the soft-prompt decision and runs the
                  existing push registration path, so the one-shot OS prompt
                  fires here and the completion-time Alert stays silent.
                  "Maybe later" never blocks finishing. */}
              <NotificationPrimingCard style={{ marginTop: 24 }} />
            </View>
          )}
          </StepTransition>
          </Animated.View>
        </ScrollView>

        {/* Bottom Actions — unified onboarding CTA hierarchy (owner decision):
            Primary (filled, 54px, plan-accent, full width) > Back (quiet
            ghost) > Skip (lowest, mono link). The primary's disabled state is
            REAL — neutral fill + a short inline hint — never an opacity dim.
            Gating/submit logic is byte-for-byte the old behaviour: the same
            step-0 names condition, the same next/back/skipServices handlers. */}
        {step < 3 && (
          <View style={[styles.bottomBar, keyboardVisible && styles.bottomBarKeyboard]}>
            {continueDisabled && (
              <Text style={styles.ctaHint} accessibilityLiveRegion="polite">
                {step === 0
                  ? t("onboarding.cta_hint_names", {
                      defaultValue: "Add your first and last name to continue",
                    })
                  : t("onboarding.cta_hint_address", {
                      defaultValue: "Add your street, city, state, and ZIP to continue",
                    })}
              </Text>
            )}
            <Button
              title={saving ? t("common.loading") : t("common.continue")}
              onPress={next} loading={saving}
              disabled={continueDisabled}
              disabledTone="neutral"
              size="cta"
              fullWidth
              iconRight={<ArrowRight size={16} color="#fff" />}
            />
            {step > 0 && (
              <View style={styles.bottomSecondaryRow}>
                <Button title={t("common.back")} onPress={back} variant="ghost"
                  icon={<ArrowLeft size={16} color={theme.colors.textSecondary} />} />
                {step === 2 ? (
                  <TouchableOpacity
                    onPress={() => { if (!saving) skipServices(); }}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel={t("onboarding.providers_addLater", { defaultValue: "Add later" })}
                    accessibilityState={{ disabled: saving }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.skipLink}
                  >
                    <Text style={styles.skipLinkText}>
                      {t("onboarding.providers_addLater", { defaultValue: "Add later" })}
                    </Text>
                  </TouchableOpacity>
                ) : <View />}
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  onboardingHeader: {
    position: "relative",
    overflow: "hidden",
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: theme.radius["2xl"],
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    backgroundColor: theme.colors.glass.bg,
  },
  onboardingHeaderCompact: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 10,
    borderRadius: 18,
  },
  headerBrandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  compactHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  compactHeaderCopy: { flex: 1, minWidth: 0 },
  compactHeaderKicker: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.textTertiary,
  },
  compactHeaderTitle: { marginTop: 1, fontSize: 13, fontWeight: "800", color: theme.colors.text },
  headerCopy: { flex: 1, minWidth: 0 },
  headerKicker: {
    fontFamily: Platform.select({ ios: "GeistMono_500Medium", android: "GeistMono_500Medium" }),
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 1.25,
    textTransform: "uppercase",
    color: theme.colors.textTertiary,
  },
  headerTitle: {
    marginTop: 2,
    fontFamily: Platform.select({ ios: "Fraunces_500Medium", android: "Fraunces_500Medium" }),
    fontSize: 17,
    color: theme.colors.text,
  },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
  },
  headerPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
    fontVariant: ["tabular-nums"],
  },
  stepRail: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 14,
    marginBottom: 12,
  },
  stepRailItem: { flex: 1, alignItems: "center", minWidth: 0 },
  stepRailDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  stepRailDotOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stepRailDotActive: {
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  stepRailLabel: {
    marginTop: 5,
    maxWidth: "100%",
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textMuted,
    textAlign: "center",
  },
  stepRailLabelOn: { color: theme.colors.primary },
  stepLabel: { fontSize: 13, color: theme.colors.textTertiary, textAlign: "center", marginTop: 12 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 140 },
  scrollContentCompact: { paddingTop: 14 },
  scrollContentKeyboard: { paddingBottom: 92 },
  stepContent: { alignItems: "center" },
  stepIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: theme.colors.primaryFaded, borderWidth: 1,
    borderColor: theme.colors.rose.border, alignItems: "center",
    justifyContent: "center", marginBottom: 20,
  },
  stepTitle: { fontSize: 24, fontWeight: "800", color: theme.colors.text, textAlign: "center", letterSpacing: 0 },
  stepDesc: { fontSize: 14, color: theme.colors.textTertiary, textAlign: "center", marginTop: 8, lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary, alignSelf: "flex-start", marginTop: 20, marginBottom: 8 },
  errorBox: {
    marginHorizontal: 24, marginTop: 8, padding: 12, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: theme.colors.error + "44",
  },
  errorText: { fontSize: 13, color: theme.colors.error, textAlign: "center" },
  memberBanner: {
    marginTop: 16,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primaryFaded,
    backgroundColor: theme.colors.glass.bg,
    width: "100%",
  },
  memberBannerText: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18, textAlign: "center" },
  row: { flexDirection: "row", gap: 12, width: "100%" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primaryFaded, borderColor: theme.colors.borderFocus },
  chipText: { fontSize: 14, color: theme.colors.textTertiary, fontWeight: "500" },
  chipTextActive: { color: theme.colors.primary },
  toggleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" },
  toggleChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  toggleChipActive: { backgroundColor: theme.colors.primaryFaded, borderColor: theme.colors.borderFocus },
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
  loadingBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 8 },
  loadingText: { fontSize: 14, color: theme.colors.textMuted },
  emptyProviders: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40, width: "100%" },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: "center" },
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
  dateDoneButton: { alignSelf: "flex-end", marginTop: 4, paddingHorizontal: 8, paddingVertical: 6 },
  dateDoneText: { color: theme.colors.primary, fontWeight: "600" },
  catSection: { marginBottom: 8, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" },
  catHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.02)" },
  catTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text, flex: 1 },
  catRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  catCount: { fontSize: 11, color: theme.colors.textMuted },
  catBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: theme.colors.primaryFaded },
  catBadgeText: { fontSize: 10, fontWeight: "600", color: theme.colors.primary },
  providerItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  providerItemActive: { backgroundColor: theme.colors.primaryFaded },
  providerName: { fontSize: 14, fontWeight: "500", color: theme.colors.text },
  providerDesc: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  providerMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  scopeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  scopeFederal: { backgroundColor: theme.colors.infoFaded },
  scopeState: { backgroundColor: theme.colors.successFaded },
  scopeText: { fontSize: 9, fontWeight: "600" },
  scopeFederalText: { color: theme.colors.info },
  scopeStateText: { color: theme.colors.success },
  catIcon: {
    width: 24,
    height: 24,
    marginRight: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
  },
  recoSection: {
    marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.card, padding: 14, width: "100%",
  },
  missingNudge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 12, padding: 12, borderRadius: 14, width: "100%",
    borderWidth: 1, borderColor: theme.colors.amber.border,
    backgroundColor: theme.colors.amber.bg,
  },
  missingNudgeText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.colors.amber.text, fontWeight: "600" },
  recoHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  recoHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  recoTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  recoTitleMuted: { fontSize: 13, fontWeight: "700", color: theme.colors.textSecondary, marginBottom: 8 },
  recoSubtle: { fontSize: 11, color: theme.colors.textTertiary, marginBottom: 12 },
  recoSectionExtras: { marginTop: 10, backgroundColor: "transparent" },
  addAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: theme.colors.borderFocus,
  },
  addAllBtnText: { fontSize: 12, fontWeight: "700", color: theme.colors.primary },
  addAllDone: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  addAllDoneText: { fontSize: 12, fontWeight: "600", color: theme.colors.success },
  skipReassure: { fontSize: 12, lineHeight: 17, color: theme.colors.textTertiary, textAlign: "center", marginTop: 16, paddingHorizontal: 8 },
  recoCard: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "rgba(255,255,255,0.02)",
    marginBottom: 6,
  },
  recoCardActive: { borderColor: theme.colors.borderFocus, backgroundColor: theme.colors.primaryFaded },
  recoReason: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
  // Unified CTA bar: hint (when locked) → full-width 54px primary →
  // Back (quiet ghost, left) + Skip (mono link, right) underneath.
  bottomBar: {
    paddingHorizontal: 24, paddingVertical: 14, gap: 10,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  bottomBarKeyboard: {
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: theme.colors.background,
  },
  ctaHint: {
    fontSize: 12, lineHeight: 16, color: theme.colors.textTertiary, textAlign: "center",
  },
  bottomSecondaryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  skipLink: { paddingVertical: 6, paddingHorizontal: 4 },
  // Lowest-emphasis action of the hierarchy — small uppercase mono link
  // (design `.ob-skip`); system mono keeps it dependency-free + Hermes-safe.
  skipLinkText: {
    fontSize: 11, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase",
    color: theme.colors.textTertiary,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
});
