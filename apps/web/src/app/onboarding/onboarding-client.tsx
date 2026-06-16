"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ONBOARDING_FUNNEL_STEPS } from "@/lib/onboarding-progress";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User, MapPin, Zap, Truck, CheckCircle2, AlertCircle,
  Loader2, Globe, Phone, Search, Building2, Shield, X, ChevronDown, ChevronUp, Sparkles, Calendar,
  Lock, CalendarClock, Clock, Briefcase, Palmtree,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AuroraAside } from "./aurora-aside";
import { ObCta } from "@/components/onboarding/ob-cta";
import {
  ObCoach,
  COACH_STEP_COPY_KEYS,
  useCoachCollapsed,
  type CoachStep,
} from "@/components/onboarding/ob-coach";
import {
  ObProShowcase,
  selectProShowcaseFeatures,
  hasProShowcaseContext,
  type ProShowcaseFeatureId,
} from "@/components/onboarding/ob-pro-showcase";
import { RaccoonReading } from "@/components/illustrations/RaccoonReading";
import {
  generateChecklist,
  type UserChecklistProfile,
  type RelocationChecklist,
  type ChecklistStateRuleContext,
} from "@/lib/shared-relocation";
import {
  buildOnboardingTeaserViewedMetadata,
  buildUpgradeClickedMetadata,
  getMoveCountdown,
  getOnboardingTeaserPrimaryAction,
  PHASE1_ANALYTICS_EVENTS,
  UX_ONBOARDING_TEASER_FLAG,
  shouldShowOnboardingTeaser,
  type UxOnboardingTeaserVariant,
} from "@locateflow/shared";
import { AddressAutocompleteInput } from "@/components/address/address-autocomplete-input";
import {
  getRecommendedProviders,
  getMergedDisplayCategoryKey,
  getMergedDisplayCategoryLabel,
  getMergedDisplayCategoryOrder,
  getMergedDisplaySubcategoryLabel,
  groupByMergedDisplayCategory,
} from "@/lib/recommendation-engine";
import type { ScoredProvider } from "@/lib/recommendation-engine";
import {
  createAcceptedLegalConsents,
  getDefaultLegalConsents,
  hasRequiredLegalConsents,
} from "@/lib/legal";
import { CategoryIcon } from "@/components/ui/category-icon";
import { detectStateZipMismatch } from "@locateflow/shared";
import { LegalConsentPanel } from "@/components/legal/legal-consent-panel";
import { buildOnboardingProfilePayload } from "@/lib/onboarding-profile-payload";
import { getProviderEmptyStateCopy } from "@/lib/provider-empty-state";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/shared-address-autocomplete";
import {
  ServiceLimitUpsell,
  type ServiceLimitDetails,
} from "@/components/shared/service-limit-upsell";
import { trackEvent } from "@/lib/analytics";

// Edition VII note: the design prototype opens with a plan-picker step. That
// step is DELIBERATELY absent here — billing stays post-onboarding (owner
// decision), so the wizard remains Profile → Address → Services → Moving.
const STEPS = [
  { icon: User, label: "Profile" },
  { icon: MapPin, label: "Address" },
  { icon: Zap, label: "Services" },
  { icon: Truck, label: "Moving" },
];

// Client draft for transient Step-3 inputs (move intent + typed destination/date)
// so a mid-wizard refresh doesn't drop typed-but-uncommitted work. Cleared on
// completion so a finished flow can't pre-fill a later one on a shared device.
const ONBOARDING_DRAFT_KEY = "locateflow.onboarding.draft";

// --- Glass card wrapper ---
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl shadow-2xl ${className}`}>
      {children}
    </div>
  );
}

function OnboardingProviderLogo({
  provider,
  isSelected,
}: {
  provider: { name: string; category: string; logoUrl?: string | null };
  isSelected: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(provider.logoUrl) && !failed;
  if (showLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={provider.logoUrl as string}
        alt={`${provider.name} logo`}
        className="shrink-0 w-9 h-9 rounded-lg object-contain bg-foreground/5 border border-border p-1"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
        isSelected ? "bg-tone-orange-fg text-white" : "bg-foreground/5 text-muted-foreground"
      }`}
      aria-hidden="true"
    >
      {provider.name.charAt(0).toUpperCase()}
    </div>
  );
}

function parsePetTypes(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default function OnboardingClient({
  uxOnboardingTeaserVariant = "control",
}: {
  uxOnboardingTeaserVariant?: UxOnboardingTeaserVariant;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("onboarding");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [serviceLimit, setServiceLimit] = useState<ServiceLimitDetails | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [legalConsents, setLegalConsents] = useState(() => getDefaultLegalConsents());
  const [legalAcceptedOnServer, setLegalAcceptedOnServer] = useState(false);
  const legalStepRequested = searchParams.get("step") === "legal";

  // AI coach (bundle-3): per-step honest "why accurate data here helps"
  // explainer. Open by default on a first onboarding; the dismissed state
  // persists in localStorage so a returning user keeps their choice.
  const coach = useCoachCollapsed();

  // Best-effort funnel telemetry: fire ONBOARDING_STARTED once when the wizard
  // mounts and ONBOARDING_STEP_VIEWED_<STEP> whenever the active step changes, so
  // per-step drop-off is measurable. Never blocks onboarding; deduped once-per
  // (user, event) server-side.
  const funnelStartedRef = useRef(false);
  const trackOnboardingFunnel = useCallback((event: "STARTED" | "STEP_VIEWED", funnelStep?: string) => {
    fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(funnelStep ? { event, step: funnelStep } : { event }),
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!funnelStartedRef.current) {
      funnelStartedRef.current = true;
      trackOnboardingFunnel("STARTED");
    }
    trackOnboardingFunnel("STEP_VIEWED", ONBOARDING_FUNNEL_STEPS[step] ?? "profile");
  }, [step, trackOnboardingFunnel]);

  // Resume the server-derived onboarding step. Profile, address, service
  // skip, and moving skip decisions are persisted server-side so refreshes do
  // not accidentally fall through to the dashboard.
  useEffect(() => {
    let cancelled = false;

    async function loadOnboardingState() {
      try {
        const data = await fetch("/api/profile").then((r) => r.json());
        if (cancelled) return;

        if (data.onboardingCompleted === true) {
          // Backstop: a completed user who revisits /onboarding shouldn't carry a
          // stale draft forward (covers any completion path that bypassed the
          // explicit clear in ensureOnboardingCompleted).
          try {
            localStorage.removeItem(ONBOARDING_DRAFT_KEY);
          } catch {
            // ignore
          }
          router.replace("/dashboard");
          return;
        }

        // Freemium gate signal: a paid (Individual/Family/Pro) user keeps the
        // normal moving-plan create flow; a free user gets the value-first
        // teaser instead. Prefer the resolved entitlement (mirrors dashboard),
        // falling back to the raw subscription heuristic.
        const ent = data.entitlement;
        const sub = data.subscription || {};
        const paid = ent
          ? ent.isActive === true && ent.plan && ent.plan !== "FREE_TRIAL"
          : sub.plan && sub.plan !== "FREE_TRIAL" &&
            (sub.status === "ACTIVE" || (sub.premiumUntil && new Date(sub.premiumUntil) > new Date()));
        setIsPremium(!!paid);

        const hasLegal = hasRequiredLegalConsents(data.legalConsents);
        setLegalAcceptedOnServer(hasLegal);
        if (data.legalConsents) {
          setLegalConsents(getDefaultLegalConsents(data.legalConsents));
        }

        // Legal consent is now collected INLINE on Step 0 (LegalConsentPanel in
        // the profile step). The dedicated ?step=legal interstitial is kept only
        // as the landing target for server redirects (e.g. OAuth callbacks):
        //  - ?step=legal + already accepted → bounce back to the wizard.
        //  - ?step=legal + not accepted     → the legal gate renders (below).
        //  - no ?step=legal + not accepted  → stay on the normal wizard; Step 0
        //    shows the inline legal panel and gates advancement on it.
        if (legalStepRequested) {
          if (hasLegal) {
            router.replace("/onboarding");
          }
          return;
        }

        const nextStep = typeof data.onboardingStepIndex === "number"
          ? Math.max(0, Math.min(3, data.onboardingStepIndex))
          : 0;
        setStep(nextStep);

        if (data.user || data.profile) {
          setProfile((prev) => ({
            ...prev,
            firstName: data.user?.firstName || prev.firstName,
            lastName: data.user?.lastName || prev.lastName,
            ageRange: data.profile?.ageRange || prev.ageRange,
            familyStatus: data.profile?.familyStatus || prev.familyStatus,
            hasChildren: data.profile?.hasChildren ?? prev.hasChildren,
            childrenCount: data.profile?.childrenCount ?? prev.childrenCount,
            hasPets: data.profile?.hasPets ?? prev.hasPets,
            petTypes: data.profile?.petTypes ? parsePetTypes(data.profile.petTypes) : prev.petTypes,
            carCount: data.profile?.carCount ?? prev.carCount,
            hasSenior: data.profile?.hasSenior ?? prev.hasSenior,
            hasDisability: data.profile?.hasDisability ?? prev.hasDisability,
            needsStorage: data.profile?.needsStorage ?? prev.needsStorage,
            hasMotorcycle: data.profile?.hasMotorcycle ?? prev.hasMotorcycle,
            hasBoatRV: data.profile?.hasBoatRV ?? prev.hasBoatRV,
            moveType: data.profile?.moveType || prev.moveType,
            isBusinessOwner: data.profile?.isBusinessOwner ?? prev.isBusinessOwner,
            isMilitary: false,
          }));
        }

        if (nextStep >= 1) {
          const addressData = await fetch("/api/addresses").then((r) => r.json()).catch(() => null);
          if (cancelled) return;
          const addresses = addressData?.addresses || [];
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

      } catch {
        // Keep the current step visible; individual saves still surface errors.
      }
    }

    loadOnboardingState();
    return () => {
      cancelled = true;
    };
  }, [legalStepRequested, router]);

  // Step 0 – Profile
  // `sensitiveOptIn` gates disability + immigration fields behind an explicit
  // user checkbox. Default off = we never collect GDPR Art. 9 / CCPA sensitive
  // categories without consent.
  const [profile, setProfile] = useState({
    firstName: "", lastName: "", ageRange: "", familyStatus: "SINGLE",
    hasChildren: false, childrenCount: 0, hasPets: false, petTypes: [] as string[],
    carCount: 0, hasSenior: false, hasDisability: false,
    needsStorage: false, hasMotorcycle: false, hasBoatRV: false,
    moveType: "PERSONAL" as string,
    isImmigrant: false, immigrationStatus: "" as string,
    isBusinessOwner: false, businessType: "" as string,
    isMilitary: false,
    sensitiveOptIn: false,
  });

  // Step 1 – Address
  const [address, setAddress] = useState({
    nickname: "", street: "", city: "", state: "", zip: "",
    country: "USA", type: "HOME", ownership: "RENTER", startDate: new Date().toISOString().slice(0, 10),
    formattedAddress: null as string | null,
    placeId: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [createdAddressId, setCreatedAddressId] = useState<string | null>(null);

  // Step 2 – Providers
  const [providers, setProviders] = useState<ScoredProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  // Server-computed essential categories the user hasn't tracked yet (coarse
  // catalog labels, never PII) — drives the "you still need…" nudge on Step 2.
  const [missingCritical, setMissingCritical] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<Map<string, ScoredProvider>>(new Map());
  const [providerSearch, setProviderSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // "Compiling your starter plan" ritual (Edition VII). A brief, HONEST
  // assemble moment played once when the Step-2 recommendations finish
  // loading: the REAL state-based recommendations the wizard already fetched
  // appear as staggered rows under a progress ring, then the full picker
  // reveals. It replaces the prototype's "account scan" — LocateFlow never
  // scans accounts, inboxes, or email, and the copy says so. Decorative only:
  // prefers-reduced-motion (or an empty result) skips straight to the list.
  const ritualPlayedRef = useRef(false);
  const ritualTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [ritualActive, setRitualActive] = useState(false);
  const [ritualRevealed, setRitualRevealed] = useState(0);
  const [ritualRows, setRitualRows] = useState<ScoredProvider[]>([]);

  // Step 3 – Moving plan
  const [wantsToMove, setWantsToMove] = useState<boolean | null>(null);
  const [movingForm, setMovingForm] = useState({
    street: "", city: "", state: "", zip: "", country: "USA",
    moveDate: "",
    formattedAddress: null as string | null,
    placeId: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [billingData, setBillingData] = useState<Record<string, { monthlyCost: string; billingCycle: string }>>({});

  // Restore the Step-3 draft once on mount (move intent + typed destination/date),
  // then persist it as the user types so a refresh mid-wizard doesn't lose it.
  // Only the typed text fields are restored — coords/placeId re-derive from the
  // address picker so a stale draft can't desync them from the city/zip.
  const draftRestoredRef = useRef(false);
  const clearOnboardingDraft = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === "object") {
          if (typeof d.wantsToMove === "boolean") setWantsToMove(d.wantsToMove);
          const mf = d.movingForm;
          if (mf && typeof mf === "object") {
            setMovingForm((prev) => ({
              ...prev,
              street: typeof mf.street === "string" ? mf.street : prev.street,
              city: typeof mf.city === "string" ? mf.city : prev.city,
              state: typeof mf.state === "string" ? mf.state : prev.state,
              zip: typeof mf.zip === "string" ? mf.zip : prev.zip,
              moveDate: typeof mf.moveDate === "string" ? mf.moveDate : prev.moveDate,
            }));
          }
        }
      }
    } catch {
      // ignore malformed / unavailable storage
    } finally {
      draftRestoredRef.current = true;
    }
  }, []);
  useEffect(() => {
    if (!draftRestoredRef.current) return;
    try {
      localStorage.setItem(
        ONBOARDING_DRAFT_KEY,
        JSON.stringify({
          wantsToMove,
          movingForm: {
            street: movingForm.street,
            city: movingForm.city,
            state: movingForm.state,
            zip: movingForm.zip,
            moveDate: movingForm.moveDate,
          },
        }),
      );
    } catch {
      // ignore storage failures
    }
  }, [wantsToMove, movingForm]);

  // Freemium: free users cannot create a MovingPlan. Instead of POSTing to
  // /api/moving (which now 403s for free), we compute an ephemeral, value-first
  // TEASER from the same checklist engine the dashboard uses — no persistence.
  // Paid users keep the normal create flow. `isPremium` decides which path the
  // Step-3 submit takes.
  const [isPremium, setIsPremium] = useState(false);
  const [teaser, setTeaser] = useState<{
    checklist: RelocationChecklist;
    fromState: string;
    toState: string;
    moveDate: string;
    mode: "free" | "paid";
  } | null>(null);

  const updateAddressField = (field: string, value: string | boolean | number | null) => {
    setAddress((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "street" || field === "city" || field === "state" || field === "zip") {
        return clearAddressAutocompleteMetadata(next);
      }
      return next;
    });
  };

  const updateMovingField = (field: string, value: string | boolean | number | null) => {
    setMovingForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "street" || field === "city" || field === "state" || field === "zip") {
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

  // Fetch providers when entering step 2
  const fetchProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const params = new URLSearchParams();
      if (createdAddressId) params.set("addressId", createdAddressId);
      if (address.state) params.set("state", address.state);
      if (address.zip) params.set("zip", address.zip);
      if (address.latitude != null) params.set("lat", String(address.latitude));
      if (address.longitude != null) params.set("lng", String(address.longitude));
      const res = await fetch(`/api/providers/recommendations?${params.toString()}`);
      const data = await res.json();
      setProviders(data.allProviders || []);
      setMissingCritical(Array.isArray(data?.stats?.missingCritical) ? data.stats.missingCritical : []);
    } catch {
      setProviders([]);
    } finally {
      setLoadingProviders(false);
    }
  }, [address.latitude, address.longitude, address.state, address.zip, createdAddressId]);

  useEffect(() => {
    if (step === 2) fetchProviders();
  }, [step, fetchProviders]);

  const finishRitual = useCallback(() => {
    ritualTimersRef.current.forEach(clearTimeout);
    ritualTimersRef.current = [];
    setRitualActive(false);
  }, []);

  // Play the compiling ritual exactly once, the first time the Step-2
  // recommendations land. Rows are the top REAL recommended providers (same
  // scoring the picker shows below) — nothing invented, nothing "scanned".
  useEffect(() => {
    if (step !== 2 || loadingProviders || ritualPlayedRef.current) return;
    ritualPlayedRef.current = true;
    const rows = getRecommendedProviders(providers, 12).slice(0, 5);
    if (rows.length === 0) return; // nothing to assemble — show the picker directly
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return; // skip straight to the real list
    setRitualRows(rows);
    setRitualRevealed(0);
    setRitualActive(true);
    const timers: ReturnType<typeof setTimeout>[] = [];
    rows.forEach((_, i) => {
      timers.push(setTimeout(() => setRitualRevealed(i + 1), 350 + i * 380));
    });
    // Hold the "ready" beat briefly, then hand over to the full picker.
    timers.push(setTimeout(() => setRitualActive(false), 350 + rows.length * 380 + 1200));
    ritualTimersRef.current = timers;
    // If the deps change mid-play (e.g. the user skips ahead), end the ritual
    // cleanly so a later visit to Step 2 never shows a frozen animation.
    return finishRitual;
  }, [step, loadingProviders, providers, finishRitual]);

  const toggleProvider = (provider: ScoredProvider) => {
    setSelectedProviders((prev) => {
      const next = new Map(prev);
      if (next.has(provider.id)) {
        next.delete(provider.id);
      } else {
        next.set(provider.id, provider);
      }
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

  // ---- Step handlers ----
  const saveProfile = async () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      setError("First name and last name are required.");
      return false;
    }
    setError("");
    setSaving(true);
    try {
      // Sensitive profile fields (disability / immigration) are gated server-side
      // behind a current SENSITIVE DataConsent. The opt-in checkbox above is the
      // user's consent gesture, so record it BEFORE saving the profile — otherwise
      // /api/profile rejects the payload with SENSITIVE_CONSENT_REQUIRED and the
      // user is stuck at this step. Mirrors apps/web settings/profile handleSave.
      const needsSensitiveConsent =
        profile.hasDisability || profile.isImmigrant || Boolean(profile.immigrationStatus);
      if (needsSensitiveConsent) {
        const consentRes = await fetch("/api/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grants: [{ category: "SENSITIVE", granted: true }] }),
        });
        if (!consentRes.ok) {
          const data = await consentRes.json().catch(() => ({}));
          throw new Error(data.error || "Sensitive profile consent is required.");
        }
      }

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOnboardingProfilePayload(profile)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save profile");
      }
      toast.success("Profile saved!");
      return true;
    } catch (e: any) {
      setError(e.message || "Failed to save profile");
      toast.error(e.message || "Failed to save profile");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const acceptLegal = async () => {
    if (!hasRequiredLegalConsents(legalConsents)) {
      setError("You must accept the Terms of Service and Legal Disclaimer before continuing.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const acceptedLegalConsents = createAcceptedLegalConsents(legalConsents);
      const res = await fetch("/api/legal/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalConsents: acceptedLegalConsents }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save legal acknowledgement");
      }
      setLegalConsents(getDefaultLegalConsents(data.legalConsents || acceptedLegalConsents));
      setLegalAcceptedOnServer(true);
      toast.success("Legal acknowledgements saved.");
      router.replace("/onboarding");
      router.refresh();
    } catch (e: any) {
      const message = e.message || "Failed to save legal acknowledgement";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Inline legal acceptance for Step 0 (no redirect, unlike the OAuth-landing
  // gate's acceptLegal). The profile POST requires legal consent server-side, so
  // Step 0 accepts legal BEFORE saving the profile. Returns false (with an error
  // surfaced) when consent is missing or the save fails.
  const acceptLegalInline = async (): Promise<boolean> => {
    if (legalAcceptedOnServer) return true;
    if (!hasRequiredLegalConsents(legalConsents)) {
      setError("Please accept the Terms of Service and Legal Disclaimer to continue.");
      return false;
    }
    try {
      const acceptedLegalConsents = createAcceptedLegalConsents(legalConsents);
      const res = await fetch("/api/legal/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalConsents: acceptedLegalConsents }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save legal acknowledgement");
      setLegalConsents(getDefaultLegalConsents(data.legalConsents || acceptedLegalConsents));
      setLegalAcceptedOnServer(true);
      return true;
    } catch (e: any) {
      const message = e.message || "Failed to save legal acknowledgement";
      setError(message);
      toast.error(message);
      return false;
    }
  };

  const saveAddress = async () => {
    if (!address.street.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim()) {
      setError("Street, city, state and ZIP are required.");
      return false;
    }
    if (address.state.length !== 2) {
      setError("State must be a 2-letter code (e.g. TX, NJ).");
      return false;
    }
    if (!/^\d{5}(-\d{4})?$/.test(address.zip)) {
      setError("ZIP code must be 5 digits.");
      return false;
    }
    const mismatch = detectStateZipMismatch(address.state, address.zip);
    if (mismatch) {
      setError(`ZIP ${address.zip} appears to be in ${mismatch.zipState}, but the state is ${mismatch.typedState}. Please check the address.`);
      return false;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(createdAddressId ? `/api/addresses/${createdAddressId}` : "/api/addresses", {
        method: createdAddressId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...address, isPrimary: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save address");
      setCreatedAddressId(data.address.id || createdAddressId);
      toast.success("Address saved!");
      return true;
    } catch (e: any) {
      setError(e.message || "Failed to save address");
      toast.error(e.message || "Failed to save address");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveServices = async () => {
    if (selectedProviders.size === 0) return true;
    if (!createdAddressId) {
      setError("No address found. Please go back and add an address first.");
      return false;
    }
    setError("");
    setSaving(true);
    try {
      let saved = 0;
      for (const [id, provider] of selectedProviders) {
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
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          saved++;
          continue;
        }
        const data = await res.json().catch(() => ({}));
        const message = data.error || "A selected provider could not be added.";
        if (
          data.code === "SERVICE_LIMIT_REACHED" ||
          data.code === "SETUP_SERVICE_LIMIT_REACHED" ||
          data.code === "SUBSCRIPTION_REQUIRED" ||
          data.code === "TRIAL_EXPIRED"
        ) {
          setServiceLimit({
            code: data.code,
            limit: data.limit ?? null,
            current: data.current ?? null,
            accessType: data.accessType ?? null,
            plan: data.plan ?? null,
            eligibleForTrial: data.eligibleForTrial ?? true,
            subscription: data.subscription ?? null,
            campaign: data.campaign ?? null,
            monthlyOffer: data.monthlyOffer ?? null,
            upgradePath: data.upgradePath ?? "/settings/subscription",
          });
          throw new Error(message);
        }
        if (data.upgradeRequired || typeof data.code === "string") {
          throw new Error(message);
        }
      }
      if (saved === 0) throw new Error("No selected providers could be added.");
      toast.success(`${saved} service${saved !== 1 ? "s" : ""} added!`);
      return true;
    } catch (e: any) {
      setError(e.message || "Failed to save services");
      toast.error(e.message || "Failed to save services");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveMovingPlan = async () => {
    if (!wantsToMove) return null;
    if (!validateMovingForm()) return false;
    if (!createdAddressId) {
      setError("No origin address found. Please go back and add an address first.");
      return false;
    }
    setError("");
    setSaving(true);
    try {
      const planRes = await fetch("/api/moving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const planData = await planRes.json().catch(() => ({}));
      if (!planRes.ok) {
        throw new Error(planData.error || "Failed to create moving plan");
      }
      const planId = planData?.plan?.id;
      if (!planId) {
        throw new Error("Moving plan could not be created.");
      }
      toast.success("Moving plan created!");
      return planId as string;
    } catch (e: any) {
      setError(e.message || "Failed to create moving plan");
      toast.error(e.message || "Failed to create moving plan");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Validate the Step-3 move form (shared by the paid create path and the
  // free teaser path). Returns true when destination + date are usable.
  const validateMovingForm = (): boolean => {
    if (!movingForm.city.trim() || !movingForm.state.trim() || !movingForm.zip.trim() || !movingForm.moveDate) {
      setError("Please fill in destination city, state, ZIP, and move date.");
      return false;
    }
    if (movingForm.state.length !== 2) {
      setError("State must be a 2-letter code.");
      return false;
    }
    const mismatch = detectStateZipMismatch(movingForm.state, movingForm.zip);
    if (mismatch) {
      setError(`ZIP ${movingForm.zip} appears to be in ${mismatch.zipState}, but the state is ${mismatch.typedState}. Please check the destination address.`);
      return false;
    }
    return true;
  };

  const hasMoveDestinationAndDate = (): boolean =>
    Boolean(
      movingForm.city.trim() &&
        movingForm.state.trim() &&
        movingForm.zip.trim() &&
        movingForm.moveDate,
    );

  // Teaser: compute a personalized move preview from the entered
  // onboarding data using the SAME checklist engine the dashboard uses. No
  // /api/moving POST, no MovingPlan persisted — purely ephemeral. Reasons and
  // deadlines come from the real engine + the user's data (never invented).
  const buildMoveTeaser = async (mode: "free" | "paid") => {
    if (!validateMovingForm()) return false;
    setError("");
    setSaving(true);
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
        moveType: (profile.moveType as UserChecklistProfile["moveType"]) || "PERSONAL",
      };
      const toState = movingForm.state.trim().toUpperCase();
      const fromState = address.state.trim().toUpperCase();
      // Optional state-rule enrichment for richer "because your state…" notes.
      // The engine works without it, so this is best-effort and non-blocking.
      let stateRule: ChecklistStateRuleContext | null = null;
      if (toState) {
        try {
          const res = await fetch(`/api/state-rules?state=${toState}`).then((r) => r.json());
          stateRule = res.stateRule || null;
        } catch {
          stateRule = null;
        }
      }
      const checklist = generateChecklist(
        checklistProfile,
        new Date(movingForm.moveDate),
        fromState,
        toState,
        new Set<string>(),
        stateRule,
      );
      setTeaser({ checklist, fromState, toState, moveDate: movingForm.moveDate, mode });
      trackEvent(
        PHASE1_ANALYTICS_EVENTS.ONBOARDING_TEASER_VIEWED,
        buildOnboardingTeaserViewedMetadata({
          planTier: mode === "free" ? "free" : "unknown",
          variant: uxOnboardingTeaserVariant,
          platform: "web",
        }),
      );
      if (mode === "free") {
        trackEvent("move_teaser_viewed", { source: "onboarding" });
      }
      return true;
    } catch (e: any) {
      setError(e.message || "Could not build your move preview.");
      toast.error(e.message || "Could not build your move preview.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const recordOnboardingProgress = async (event: "SERVICES_SKIPPED" | "MOVING_SKIPPED" | "COMPLETED") => {
    const res = await fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Failed to save onboarding progress");
    }
  };

  const ensureOnboardingCompleted = async () => {
    const res = await fetch("/api/profile");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Failed to verify onboarding status");
    }
    if (data.onboardingCompleted !== true) {
      throw new Error("Onboarding could not be completed. Please try again.");
    }
    // Onboarding is done — drop the transient draft so a finished flow can't
    // pre-fill a different user's wizard on a shared device.
    clearOnboardingDraft();
  };

  const next = async () => {
    let ok = true;
    if (step === 0) {
      // Legal is collected inline on Step 0; accept it BEFORE saving the profile
      // because /api/profile rejects writes without consent (api-gates).
      if (!legalAcceptedOnServer) {
        const legalOk = await acceptLegalInline();
        if (!legalOk) return;
      }
      ok = await saveProfile();
    } else if (step === 1) ok = await saveAddress();
    else if (step === 2) {
      const selectedCount = selectedProviders.size;
      ok = await saveServices();
      if (ok && selectedCount === 0) {
        try {
          await recordOnboardingProgress("SERVICES_SKIPPED");
        } catch (e: any) {
          const message = e.message || "Failed to save onboarding progress";
          setError(message);
          toast.error(message);
          return;
        }
      }
    }
    if (!ok) return;
    if (step < 3) { setStep(step + 1); setError(""); }
    else router.push("/dashboard");
  };

  const completeWithMovingPlan = async (planId: string) => {
    trackEvent("moving_plan_started", { source: "onboarding" });
    await recordOnboardingProgress("COMPLETED");
    await ensureOnboardingCompleted();
    trackEvent("onboarding_completed", { created_moving_plan: true });
    router.push(`/moving/plan/${planId}`);
  };

  const finishOnboarding = async () => {
    // FREE users with a planned move: don't create a MovingPlan (the gate
    // blocks it). Show the value-first teaser instead — onboarding completes
    // only after the user acts on the preview (upgrade or "continue free").
    if (wantsToMove && !isPremium) {
      await buildMoveTeaser("free");
      return;
    }

    if (
      wantsToMove &&
      shouldShowOnboardingTeaser({
        hasDestinationAndDate: hasMoveDestinationAndDate(),
        isPremium,
        variant: uxOnboardingTeaserVariant,
      })
    ) {
      await buildMoveTeaser(isPremium ? "paid" : "free");
      return;
    }

    const planId = await saveMovingPlan();
    if (planId === false) return;
    try {
      if (typeof planId === "string") {
        await completeWithMovingPlan(planId);
        return;
      }
      await recordOnboardingProgress("MOVING_SKIPPED");
      await recordOnboardingProgress("COMPLETED");
      await ensureOnboardingCompleted();
      trackEvent("onboarding_completed", { created_moving_plan: false });
      router.push("/dashboard");
    } catch (e: any) {
      const message = e.message || "Failed to complete onboarding";
      setError(message);
      toast.error(message);
    }
  };

  const continueFromPaidTeaser = async () => {
    const planId = await saveMovingPlan();
    if (planId === false || typeof planId !== "string") return;
    try {
      await completeWithMovingPlan(planId);
    } catch (e: any) {
      const message = e.message || "Failed to complete onboarding";
      setError(message);
      toast.error(message);
    }
  };

  // Complete onboarding from the free teaser without persisting a MovingPlan.
  // Used by both "Unlock with Individual" (routes to upgrade) and "Continue to
  // dashboard". No /api/moving POST — avoids the 403 dead-end entirely.
  const finishFromTeaser = async (target: "upgrade" | "dashboard") => {
    setSaving(true);
    setError("");
    try {
      await recordOnboardingProgress("MOVING_SKIPPED");
      await recordOnboardingProgress("COMPLETED");
      await ensureOnboardingCompleted();
      trackEvent("onboarding_completed", { created_moving_plan: false, saw_teaser: true });
      if (target === "upgrade") {
        trackEvent(
          PHASE1_ANALYTICS_EVENTS.UPGRADE_CLICKED,
          buildUpgradeClickedMetadata({
            upgradeSurface: "onboarding_teaser",
            targetPlanTier: "individual",
            featureGate: "onboarding_teaser",
            surface: "onboarding",
            variant: uxOnboardingTeaserVariant,
            experimentFlag: UX_ONBOARDING_TEASER_FLAG,
          }),
        );
        trackEvent("move_teaser_upgrade_clicked", { source: "onboarding" });
        router.push("/settings/subscription?returnTo=%2Fdashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (e: any) {
      const message = e.message || "Failed to complete onboarding";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const prev = () => { if (step > 0) { setStep(step - 1); setError(""); } };

  // ---- Provider scoring & filtering ----
  const recommended = getRecommendedProviders(providers, 12);
  // Essentials = the CRITICAL/IMPORTANT picks (electric, internet, USPS, …).
  // Mirrors the mobile onboarding so picking providers isn't a one-by-one chore.
  const essentialRecommended = recommended.filter(
    (p) => p.urgencyTier === "CRITICAL" || p.urgencyTier === "IMPORTANT",
  );
  const unselectedEssentialCount = essentialRecommended.reduce(
    (n, p) => (selectedProviders.has(p.id) ? n : n + 1),
    0,
  );
  // One-tap: add every essential the user hasn't already picked. Purely additive
  // — never deselects, so any extra pick (or a later deselect) is preserved.
  const addAllEssentials = () => {
    setSelectedProviders((prev) => {
      const next = new Map(prev);
      for (const provider of essentialRecommended) {
        if (!next.has(provider.id)) next.set(provider.id, provider);
      }
      return next;
    });
  };

  const filteredProviders = providers.filter((p: ScoredProvider) => {
    if (providerSearch) {
      const q = providerSearch.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q) && !(p.description || "").toLowerCase().includes(q)) return false;
    }
    if (activeCategory && getMergedDisplayCategoryKey(p.category) !== activeCategory) return false;
    return true;
  });

  const groupedProviders = groupByMergedDisplayCategory(filteredProviders);
  const sortedCategories = Object.keys(groupedProviders).sort(
    (a, b) => getMergedDisplayCategoryOrder(a) - getMergedDisplayCategoryOrder(b)
  );

  const allCategories = [...new Set(providers.map((p) => getMergedDisplayCategoryKey(p.category)))].sort(
    (a, b) => getMergedDisplayCategoryOrder(a) - getMergedDisplayCategoryOrder(b)
  );
  const providerEmptyState = getProviderEmptyStateCopy({
    state: address.state || null,
    search: providerSearch,
    hasCategoryFilter: Boolean(activeCategory),
  });
  const providerCategoryLabel = (category: string) =>
    [getMergedDisplayCategoryLabel(category), getMergedDisplaySubcategoryLabel(category)]
      .filter(Boolean)
      .join(" - ");

  // Editorial serif headings carry ONE italic <em> accent (cool gradient via
  // the .h1/.h2 helpers in globals.css). Messages embed the <em> tag.
  const richEm = { em: (chunks: React.ReactNode) => <em>{chunks}</em> };
  // Coach copy is keyed by wizard step (Profile → Address → Services → Moving).
  const coachStep: CoachStep =
    (["profile", "address", "providers", "moving"] as const)[step] ?? "profile";
  const ritualPct = ritualRows.length > 0 ? Math.round((ritualRevealed / ritualRows.length) * 100) : 0;
  const ritualDone = ritualRows.length > 0 && ritualRevealed >= ritualRows.length;
  const ritualStateLabel = address.state || t("aurora_yourState");

  // --- Pro showcase (final-moment, value-first; NO payment step) ---
  // Personalized from the REAL entered move context: origin state (Step 1),
  // destination state (Step 3), and household (profile). Only rendered once a
  // destination state is typed so the headline stays concrete, and never for a
  // user already on a paid plan.
  const proShowcaseCtx = {
    fromState: address.state || null,
    toState: movingForm.state || null,
    hasChildren: profile.hasChildren,
    hasPets: profile.hasPets,
  };
  const proShowcaseContext = hasProShowcaseContext(proShowcaseCtx)
    ? proShowcaseCtx
    : null;
  const proShowcaseFeatures = proShowcaseContext
    ? selectProShowcaseFeatures(proShowcaseContext)
    : [];
  const proShowcaseFromLabel = address.state || t("aurora_yourState");
  const proShowcaseToLabel = movingForm.state || t("aurora_yourState");
  const proShowcaseFeatureLabel = (id: ProShowcaseFeatureId) =>
    t(`proShowcase_feature_${id}`);
  const handleSeePro = () => {
    trackEvent("onboarding_pro_showcase_clicked", { source: "onboarding" });
    router.push("/pricing");
  };

  // --- Common input styles for glass theme ---
  const inputCls = "w-full rounded-xl border border-border bg-foreground/5 px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-tone-orange-br transition";
  const selectCls = "w-full rounded-xl border border-border bg-foreground/5 px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition [&>option]:bg-popover [&>option]:text-popover-foreground";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5";
  const checkboxCls = "w-4 h-4 rounded border-foreground/20 bg-foreground/5 accent-orange-500 cursor-pointer";
  const showLegalGate = legalStepRequested && !legalAcceptedOnServer;

  if (showLegalGate) {
    return (
      <div className="space-y-5">
        {error && (
          <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <GlassCard className="p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-xl bg-tone-orange-bg p-2 text-tone-orange-fg">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Required legal acknowledgements</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Accept these before using LocateFlow.
              </p>
            </div>
          </div>

          <LegalConsentPanel
            consents={legalConsents}
            onChange={setLegalConsents}
          />

          <ObCta
            className="mt-5 w-full"
            onClick={acceptLegal}
            disabled={saving || !hasRequiredLegalConsents(legalConsents)}
            disabledHint={t("cta_hint_legal")}
            loading={saving}
            loadingLabel="Saving..."
          >
            Continue
          </ObCta>
        </GlassCard>
      </div>
    );
  }

  // ── MOVE TEASER takeover ───────────────────────────────────────────────────
  // Value-first preview computed from the entered move data via the same
  // checklist engine the dashboard uses. NO MovingPlan is persisted. Every step
  // + reason comes from the real engine (SERVICE_PRIORITY_MAP / STATE_DMV_
  // DEADLINES) and the user's own data — nothing is invented.
  if (teaser) {
    const { checklist, fromState, toState, moveDate, mode } = teaser;
    const teaserPrimaryAction = getOnboardingTeaserPrimaryAction({ isPremium: mode === "paid" });
    const countdown = getMoveCountdown(moveDate, { state: fromState || null });

    // Top personalized critical steps: nextAction first, then urgent/overdue,
    // then the earliest URGENT/HIGH items — deduped by id, capped at 5.
    const seen = new Set<string>();
    const picked: typeof checklist.urgentItems = [];
    const consider = [
      ...(checklist.nextAction ? [checklist.nextAction] : []),
      ...checklist.urgentItems,
      ...checklist.overdueItems,
      ...checklist.phases.flatMap((p) =>
        p.items.filter((i) => i.priority === "URGENT" || i.priority === "HIGH"),
      ),
    ];
    for (const item of consider) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      picked.push(item);
      if (picked.length >= 5) break;
    }

    const countdownLine =
      countdown.phase === "today"
        ? "Your move is today"
        : countdown.phase === "past"
          ? `Moved ${countdown.absDays} day${countdown.absDays === 1 ? "" : "s"} ago`
          : countdown.absDays === 1
            ? "1 day to go"
            : `${countdown.absDays} days to go`;

    return (
      <div className="space-y-5 pb-24">
        {error && (
          <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Countdown hero */}
        <div className="relative overflow-hidden rounded-2xl border border-tone-orange-br bg-gradient-to-br from-primary/10 via-foreground/[0.03] to-transparent p-6">
          <div className="flex items-center gap-2 text-tone-orange-fg">
            <CalendarClock className="h-4 w-4" />
            <p className="text-[11px] font-semibold uppercase tracking-wider">Your move preview</p>
          </div>
          <h2 className="mt-2 text-3xl font-extrabold text-foreground leading-tight">{countdownLine}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {fromState || "Your state"} → {toState || "your destination"}
          </p>
          <p className="mt-3 text-sm font-medium text-foreground">
            Your {checklist.totalItems}-step personalized {fromState || "origin"} → {toState || "destination"} plan is ready.
          </p>
        </div>

        {/* Top personalized critical steps */}
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-tone-honey-fg" />
            <h3 className="text-sm font-semibold text-foreground">Your top critical steps</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Personalized from what you told us — here&apos;s what would matter most for this move.
          </p>
          <div className="space-y-2">
            {picked.map((item) => {
              // Honest "because…" reason: prefer the engine's computed state note
              // (real DMV deadlines etc.), then a deadline-day note, then the
              // item's own description. Never fabricated.
              const reason =
                item.stateNote ||
                (item.daysUntilDeadline !== null && item.daysUntilDeadline >= 0
                  ? `Deadline in ${item.daysUntilDeadline} day${item.daysUntilDeadline === 1 ? "" : "s"} after your move`
                  : item.description || null);
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border bg-foreground/[0.03]"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-primary">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    {reason && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{reason}</p>
                    )}
                  </div>
                  {(item.priority === "URGENT" || item.isOverdue) && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-destructive">
                      <Clock className="h-3 w-3" /> Urgent
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {checklist.totalItems > picked.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              + {checklist.totalItems - picked.length} more steps in your full plan.
            </p>
          )}
        </GlassCard>

        {teaserPrimaryAction === "create_plan" ? (
          <div className="rounded-2xl border border-tone-orange-br bg-tone-orange-bg p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-tone-orange-br bg-background/40 p-2.5">
                <Truck className="h-5 w-5 text-tone-orange-fg" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-foreground">Continue to your plan</h3>
                <p className="mt-1 text-sm text-tone-orange-fg/90">
                  Create the live moving plan from this preview and keep working from your plan page.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <ObCta
                variant="back"
                backArrow={false}
                onClick={() => setTeaser(null)}
                disabled={saving}
                className="justify-center"
              >
                Edit move details
              </ObCta>
              <ObCta
                onClick={continueFromPaidTeaser}
                loading={saving}
                loadingLabel="Creating Plan..."
              >
                Continue to your plan
              </ObCta>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-tone-orange-br bg-tone-orange-bg p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-tone-orange-br bg-background/40 p-2.5">
                <Lock className="h-5 w-5 text-tone-orange-fg" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-foreground">Unlock your full move plan + tracking</h3>
                <p className="mt-1 text-sm text-tone-orange-fg/90">
                  Individual turns this preview into a live, trackable plan: every step with
                  its deadline, a countdown, your destination-state guide, provider migration,
                  and reminders so nothing slips.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <ObCta
                variant="back"
                backArrow={false}
                onClick={() => finishFromTeaser("dashboard")}
                disabled={saving}
                className="justify-center"
              >
                Keep organizing for free
              </ObCta>
              <ObCta
                onClick={() => finishFromTeaser("upgrade")}
                loading={saving}
                loadingLabel="Finishing..."
              >
                Unlock with Individual
              </ObCta>
            </div>
            <p className="mt-3 text-[11px] text-tone-orange-fg/80">
              You can keep tracking up to 3 addresses, unlimited providers, and bill reminders on the free plan.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    {/* ≥lg this breaks out of the layout's max-w-2xl column into the Aurora
        split-screen: fixed-width brand aside + the existing wizard column 1:1.
        Below lg the wrapper is inert and the wizard renders exactly as before
        (the layout's wordmark header is the slim mobile header). The fixed
        footer lives OUTSIDE this wrapper: the lg translate transform would
        otherwise re-anchor `position: fixed` to the wrapper. */}
    <div className="lg:relative lg:left-1/2 lg:w-[min(100vw_-_3rem,76rem)] lg:-translate-x-1/2">
      <div className="lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <AuroraAside step={step} />
        <div className="space-y-5">
      <ServiceLimitUpsell
        open={Boolean(serviceLimit)}
        details={serviceLimit}
        onClose={() => setServiceLimit(null)}
        returnTo="/onboarding"
      />

      {/* Step Indicator — mobile/tablet only; the aside's vertical rail owns
          step progress on ≥lg. */}
      <div className="flex items-center justify-center gap-1 lg:hidden">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                i < step
                  ? "bg-tone-emerald-bg text-tone-emerald-fg"
                  : i === step
                  ? "bg-tone-orange-bg text-tone-orange-fg ring-1 ring-primary/40"
                  : "bg-foreground/5 text-foreground/40"
              }`}>
                {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-px ${i < step ? "bg-tone-emerald-bg" : "bg-foreground/10"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* AI coach — short, honest "why accurate data on this step improves
          your suggestions" explainer (bundle-3 owner decision). Dismissible
          to a "!" badge; hidden while the starter-plan reveal is playing so
          the ritual keeps the stage. Purely presentational. */}
      {!(step === 2 && ritualActive) && (
        <ObCoach
          key={coachStep}
          eyebrow={t("coach_eyebrow")}
          text={t(COACH_STEP_COPY_KEYS[coachStep])}
          collapsed={coach.collapsed}
          onDismiss={coach.dismiss}
          onReopen={coach.reopen}
          dismissLabel={t("coach_dismiss")}
          reopenLabel={t("coach_reopen")}
        />
      )}

      {/* Step 0: Profile */}
      {step === 0 && (
        <GlassCard className="p-6">
          <h2 className="h2 text-2xl text-foreground mb-1">{t.rich("aurora_step0Title", richEm)}</h2>
          <p className="text-muted-foreground text-sm mb-5">Help us personalize your experience</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="onb-firstName" className={labelCls}>First Name *</label>
                <input id="onb-firstName" aria-required="true" className={inputCls} value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} placeholder="John" />
              </div>
              <div>
                <label htmlFor="onb-lastName" className={labelCls}>Last Name *</label>
                <input id="onb-lastName" aria-required="true" className={inputCls} value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} placeholder="Doe" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="onb-ageRange" className={labelCls}>Age Range</label>
                <select id="onb-ageRange" className={selectCls} value={profile.ageRange} onChange={(e) => setProfile({ ...profile, ageRange: e.target.value })}>
                  <option value="">Select</option>
                  <option value="18-24">18-24</option>
                  <option value="25-34">25-34</option>
                  <option value="35-44">35-44</option>
                  <option value="45-54">45-54</option>
                  <option value="55+">55+</option>
                </select>
              </div>
              <div>
                <label htmlFor="onb-familyStatus" className={labelCls}>Family Status</label>
                <select id="onb-familyStatus" className={selectCls} value={profile.familyStatus} onChange={(e) => setProfile({ ...profile, familyStatus: e.target.value })}>
                  <option value="SINGLE">Single</option>
                  <option value="COUPLE">Couple</option>
                  <option value="FAMILY">Family</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground -mt-2">
              Tap the ones that apply — all optional. We use these only to tailor your checklist.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "hasChildren", label: "Children" },
                { key: "hasPets", label: "Pets" },
                { key: "hasSenior", label: "Senior" },
                { key: "needsStorage", label: "Storage" },
                { key: "hasMotorcycle", label: "Motorcycle" },
                { key: "hasBoatRV", label: "Boat / RV" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border border-border bg-foreground/5 px-3 py-2.5 cursor-pointer hover:bg-foreground/10 transition text-sm text-foreground/80">
                  <input
                    type="checkbox"
                    className={checkboxCls}
                    checked={(profile as any)[key]}
                    onChange={(e) => setProfile({ ...profile, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* Sensitive-category opt-in (GDPR Art. 9 / CCPA sensitive PI).
                Off by default; only unlocks the disability + immigration
                questions when the user explicitly consents. */}
            <div className="rounded-xl border border-border bg-foreground/[0.03] p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className={checkboxCls}
                  checked={profile.sensitiveOptIn ?? false}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setProfile({
                      ...profile,
                      sensitiveOptIn: on,
                      // Opting out wipes any previously collected sensitive
                      // answers so we never retain data without consent.
                      ...(on ? {} : { hasDisability: false, isImmigrant: false, immigrationStatus: "" }),
                    });
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Share accessibility and immigration details <span className="text-muted-foreground font-normal">(optional)</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    These fields are sensitive under US and EU privacy law. They&apos;re never required, never shared, and you can turn this off any time in Settings → Privacy.
                  </p>
                </div>
              </label>

              {profile.sensitiveOptIn ? (
                <div className="space-y-3 pl-8">
                  <label className="flex items-start gap-2 rounded-xl border border-border bg-foreground/5 px-3 py-2.5 cursor-pointer hover:bg-foreground/10 transition text-sm text-foreground/80">
                    <input
                      type="checkbox"
                      className={checkboxCls}
                      checked={profile.hasDisability}
                      onChange={(e) => setProfile({ ...profile, hasDisability: e.target.checked })}
                    />
                    <div className="flex-1">
                      <p>Someone at home has a disability</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Why we ask: so we can suggest accessibility-friendly movers and flag state-level DMV accommodations when you relocate.
                      </p>
                    </div>
                  </label>
                </div>
              ) : null}
            </div>

            {profile.hasChildren && (
              <div>
                <label htmlFor="onb-childrenCount" className={labelCls}>Number of Children</label>
                <input id="onb-childrenCount" className={inputCls} type="number" min="0" max="20" value={profile.childrenCount} onChange={(e) => setProfile({ ...profile, childrenCount: parseInt(e.target.value) || 0 })} />
              </div>
            )}
            <div>
              <label htmlFor="onb-carCount" className={labelCls}>Number of Cars</label>
              <input id="onb-carCount" className={inputCls} type="number" min="0" max="10" value={profile.carCount} onChange={(e) => setProfile({ ...profile, carCount: parseInt(e.target.value) || 0 })} />
            </div>

            {/* Move Type */}
            <div>
              <span id="onb-moveType-label" className={labelCls}>Move Type</span>
              <div role="group" aria-labelledby="onb-moveType-label" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: "PERSONAL", label: "Personal", icon: User },
                  { value: "BUSINESS", label: "Business", icon: Briefcase },
                  { value: "VACATION", label: "Vacation", icon: Palmtree },
                  { value: "MILITARY", label: "Military", icon: Shield },
                ].map((opt) => {
                  const MoveTypeIcon = opt.icon;
                  return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProfile({ ...profile, moveType: opt.value, isMilitary: false })}
                    className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                      profile.moveType === opt.value
                        ? "border-tone-orange-br bg-tone-orange-bg text-tone-orange-fg"
                        : "border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                    }`}
                  >
                    <MoveTypeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {opt.label}
                  </button>
                  );
                })}
              </div>
            </div>

            {/* Immigration Status — only shown when sensitive opt-in is on. */}
            {profile.sensitiveOptIn ? (
              <div className="rounded-xl border border-border bg-foreground/[0.03] p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Immigration status <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Why we ask: some states (CA, NY, WA) have different DMV document rules for new residents depending on visa status. Skip if it doesn&apos;t apply.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 rounded-xl border border-border bg-foreground/5 px-3 py-2.5 cursor-pointer hover:bg-foreground/10 transition text-sm text-foreground/80">
                    <input
                      type="checkbox"
                      className={checkboxCls}
                      checked={profile.isImmigrant}
                      onChange={(e) => setProfile({ ...profile, isImmigrant: e.target.checked, immigrationStatus: e.target.checked ? profile.immigrationStatus : "" })}
                    />
                    <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Immigrant / Visa Holder
                  </label>
                  {profile.isImmigrant && (
                    <select className={selectCls} value={profile.immigrationStatus} onChange={(e) => setProfile({ ...profile, immigrationStatus: e.target.value })}>
                      <option value="">Select status...</option>
                      <option value="GREEN_CARD">Green Card</option>
                      <option value="H1B">H-1B Visa</option>
                      <option value="L1">L-1 Visa</option>
                      <option value="F1">F-1 Student</option>
                      <option value="O1">O-1 Visa</option>
                      <option value="OTHER_VISA">Other Visa</option>
                    </select>
                  )}
                </div>
              </div>
            ) : null}

            {/* Business Owner */}
            {(profile.moveType === "BUSINESS" || profile.moveType === "PERSONAL") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 rounded-xl border border-border bg-foreground/5 px-3 py-2.5 cursor-pointer hover:bg-foreground/10 transition text-sm text-foreground/80">
                    <input
                      type="checkbox"
                      className={checkboxCls}
                      checked={profile.isBusinessOwner}
                      onChange={(e) => setProfile({ ...profile, isBusinessOwner: e.target.checked, businessType: e.target.checked ? profile.businessType : "" })}
                    />
                    <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Business Owner
                </label>
                {profile.isBusinessOwner && (
                  <select className={selectCls} value={profile.businessType} onChange={(e) => setProfile({ ...profile, businessType: e.target.value })}>
                    <option value="">Select type...</option>
                    <option value="LLC">LLC</option>
                    <option value="CORP">Corporation</option>
                    <option value="SOLE_PROP">Sole Proprietorship</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="NONPROFIT">Nonprofit</option>
                  </select>
                )}
              </div>
            )}

          </div>
          {/* Legal consent is collected inline here (mobile parity) instead of a
              separate ?step=legal interstitial. Advancing Step 0 accepts it first
              (next() → acceptLegalInline) because /api/profile requires consent. */}
          {!legalAcceptedOnServer && (
            <div className="mt-5 border-t border-border pt-5">
              <div className="mb-3 flex items-start gap-2">
                <Shield className="h-4 w-4 text-tone-orange-fg mt-0.5 shrink-0" />
                <p className="text-sm font-semibold text-foreground">Required legal acknowledgements</p>
              </div>
              <LegalConsentPanel consents={legalConsents} onChange={setLegalConsents} />
            </div>
          )}
        </GlassCard>
      )}

      {/* Step 1: Address */}
      {step === 1 && (
        <GlassCard className="p-6">
          <h2 className="h2 text-2xl text-foreground mb-1">{t.rich("aurora_step1Title", richEm)}</h2>
          <p className="text-muted-foreground text-sm mb-5">Where do you currently live?</p>
          <div className="space-y-4">
            <div>
              <label htmlFor="onb-addr-nickname" className={labelCls}>Nickname</label>
              <input id="onb-addr-nickname" className={inputCls} placeholder="e.g. Home, Apartment" value={address.nickname} onChange={(e) => updateAddressField("nickname", e.target.value)} />
            </div>
            <AddressAutocompleteInput
              label="Street Address *"
              value={address.street}
              placeholder="123 Main St"
              required
              onValueChange={(value) => updateAddressField("street", value)}
              onSelect={handleAddressAutocompleteSelect}
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="onb-addr-city" className={labelCls}>City *</label>
                <input id="onb-addr-city" aria-required="true" className={inputCls} placeholder="Austin" value={address.city} onChange={(e) => updateAddressField("city", e.target.value)} />
              </div>
              <div>
                <label htmlFor="onb-addr-state" className={labelCls}>State *</label>
                <input id="onb-addr-state" aria-required="true" className={inputCls} maxLength={2} placeholder="TX" value={address.state} onChange={(e) => updateAddressField("state", e.target.value.toUpperCase())} />
              </div>
              <div>
                <label htmlFor="onb-addr-zip" className={labelCls}>ZIP *</label>
                <input id="onb-addr-zip" aria-required="true" className={inputCls} maxLength={10} placeholder="78701" value={address.zip} onChange={(e) => updateAddressField("zip", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="onb-addr-type" className={labelCls}>Type</label>
                <select id="onb-addr-type" className={selectCls} value={address.type} onChange={(e) => updateAddressField("type", e.target.value)}>
                  <option value="HOME">Home</option>
                  <option value="WORK">Work</option>
                  <option value="VACATION">Vacation</option>
                  <option value="TEMPORARY">Temporary</option>
                  <option value="STORAGE">Storage</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="onb-addr-ownership" className={labelCls}>Ownership</label>
                <select id="onb-addr-ownership" className={selectCls} value={address.ownership} onChange={(e) => updateAddressField("ownership", e.target.value)}>
                  <option value="OWNER">Owner</option>
                  <option value="RENTER">Renter</option>
                  <option value="FAMILY">Family</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="onb-addr-startDate" className={labelCls}>Move-in Date</label>
                <input id="onb-addr-startDate" className={inputCls} type="date" value={address.startDate} onChange={(e) => updateAddressField("startDate", e.target.value)} />
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Step 2: HONEST "compiling your starter plan" ritual. The rows below
          are the top REAL recommendations already fetched for this address —
          the same list the picker renders next. No accounts, inboxes, or
          emails are scanned, and the copy says so explicitly. */}
      {step === 2 && ritualActive && (
        <GlassCard className="p-6">
          <div role="status" aria-live="polite">
          <div className="flex items-center gap-5">
            <div className="relative h-[92px] w-[92px] shrink-0">
              <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
                <circle cx="46" cy="46" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
                <circle
                  cx="46" cy="46" r="40" fill="none"
                  stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${(2 * Math.PI * 40 * ritualPct) / 100} ${2 * Math.PI * 40}`}
                  transform="rotate(-90 46 46)"
                  style={{ transition: "stroke-dasharray .45s ease" }}
                />
              </svg>
              {/* Raccoon studies the directory inside the progress ring —
                  the design's staged-scan look, still 100% honest copy. */}
              <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <RaccoonReading size={52} />
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="h2 text-2xl text-foreground">
                {ritualDone ? t.rich("aurora_ritualDoneTitle", richEm) : t.rich("aurora_ritualTitle", richEm)}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {ritualDone
                  ? t("aurora_ritualDoneSub", { count: ritualRows.length, state: ritualStateLabel })
                  : t("aurora_ritualSub", { state: ritualStateLabel })}
              </p>
              {/* Progress dots — one per assembled recommendation row. */}
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {ritualRows.map((row, i) => (
                    <span
                      key={row.id}
                      className={`ob-ritual-dot h-1.5 w-5 rounded-full ${
                        i < ritualRevealed ? "bg-primary" : "bg-foreground/10"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {ritualPct}%
                </span>
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {ritualRows.map((provider, i) => (
              <div
                key={provider.id}
                className={`flex items-center gap-3 rounded-xl border border-border bg-foreground/[0.03] p-3 transition-all duration-500 ${
                  i < ritualRevealed ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                }`}
              >
                <OnboardingProviderLogo provider={provider} isSelected={false} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{provider.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{providerCategoryLabel(provider.category)}</p>
                </div>
                <CheckCircle2
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 text-tone-emerald-fg ${
                    i < ritualRevealed ? "ob-ritual-check" : "opacity-0"
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={finishRitual}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              {t("aurora_ritualSkip")}
            </button>
          </div>
          </div>
        </GlassCard>
      )}

      {/* Step 2: Services */}
      {step === 2 && !ritualActive && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="h2 text-2xl text-foreground">{t.rich("aurora_step2Title", richEm)}</h2>
              <p className="text-sm text-muted-foreground">
                Choose a listed provider or add a local/custom provider later to create a tracked service.
              </p>
              <p className="mt-1 text-xs text-foreground/45">
                Showing unverified directory entries for <span className="text-tone-orange-fg font-medium">{address.state || "all states"}</span>.
              </p>
            </div>
            {selectedProviders.size > 0 && (
              <span className="px-3 py-1 rounded-full bg-tone-orange-bg text-tone-orange-fg text-xs font-medium">
                {selectedProviders.size} selected
              </span>
            )}
          </div>

          <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-3">
            <p className="text-xs font-semibold text-tone-honey-fg dark:text-tone-honey-fg">Listed providers, manual tracking only</p>
            <p className="mt-1 text-[11px] leading-relaxed text-tone-honey-fg/80 dark:text-tone-honey-fg/75">
              Listed providers are directory entries, not proof of activation at your address. Adding one creates a LocateFlow service record; it does not update your address with the provider.
            </p>
          </div>

          {/* One-tap essentials + still-needed nudge (picking providers one-by-one
              is the highest-friction part of activation; mobile proved this). */}
          {(essentialRecommended.length > 0 || missingCritical.length > 0) && (
            <div className="rounded-xl border border-tone-orange-br bg-tone-orange-bg/40 p-3 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                {missingCritical.length > 0 ? (
                  <p className="text-xs text-foreground">
                    <span className="font-semibold">You still need:</span> {missingCritical.slice(0, 5).join(", ")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">You&apos;ve got the essentials covered.</p>
                )}
              </div>
              {essentialRecommended.length > 0 && (
                <button
                  type="button"
                  onClick={addAllEssentials}
                  disabled={unselectedEssentialCount === 0}
                  className="shrink-0 rounded-lg border border-tone-orange-br bg-tone-orange-fg text-white text-xs font-semibold px-3 py-2 hover:opacity-90 transition disabled:opacity-50"
                >
                  {unselectedEssentialCount === 0
                    ? "Essentials added ✓"
                    : `Add all essentials (${unselectedEssentialCount})`}
                </button>
              )}
            </div>
          )}

          {/* Selected chips */}
          {selectedProviders.size > 0 && (
            <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-tone-orange-bg border border-tone-orange-br">
              {Array.from(selectedProviders.values()).map((p) => (
                <button key={p.id} onClick={() => toggleProvider(p)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-tone-orange-fg text-white text-xs font-medium hover:opacity-90 transition">
                  {p.name} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-xl border border-border bg-foreground/5 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              placeholder="Search listed providers..."
              value={providerSearch}
              onChange={(e) => setProviderSearch(e.target.value)}
            />
          </div>

          {/* Category filter – collapsed by default */}
          <div>
            <button
              onClick={() => setShowCategories(!showCategories)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition"
            >
              {showCategories ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showCategories ? "Hide categories" : "Browse by category"}
              <span className="text-foreground/45">({allCategories.length})</span>
            </button>
            {showCategories && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    !activeCategory ? "bg-tone-orange-fg text-white" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                  }`}
                >All ({providers.length})</button>
                {allCategories.map((cat) => {
                  const count = providers.filter((p) => getMergedDisplayCategoryKey(p.category) === cat).length;
                  return (
                    <button key={cat}
                      onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        activeCategory === cat ? "bg-tone-orange-fg text-white" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <CategoryIcon category={cat} className="h-3.5 w-3.5" />
                        {getMergedDisplayCategoryLabel(cat)} ({count})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recommended Section */}
          {!loadingProviders && !providerSearch && !activeCategory && recommended.length > 0 && (
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-tone-honey-fg" />
                <h3 className="text-sm font-semibold text-foreground">Recommended Listed Providers</h3>
                <span className="text-[10px] text-foreground/45 ml-auto">Manual tracking</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recommended.map((provider) => {
                  const isSelected = selectedProviders.has(provider.id);
                  return (
                    <button key={`rec-${provider.id}`} type="button" onClick={() => toggleProvider(provider)}
                      className={`group relative text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "border-tone-orange-br bg-tone-orange-bg"
                          : "border-border bg-foreground/[0.02] hover:bg-foreground/5 hover:border-border"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-tone-orange-fg" />}
                      <div className="flex items-center gap-3">
                        <OnboardingProviderLogo provider={provider} isSelected={isSelected} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-foreground truncate pr-6">{provider.name}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {(provider.matchReasons.length > 0 ? provider.matchReasons : [providerCategoryLabel(provider.category)]).slice(0, 2).map((reason, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-tone-orange-bg text-tone-orange-fg border border-tone-orange-br">
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </GlassCard>
          )}

          {/* Provider categories – collapsed accordion */}
          {loadingProviders ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-tone-orange-fg" />
              <span className="ml-2 text-muted-foreground text-sm">Loading providers...</span>
            </div>
          ) : sortedCategories.length === 0 ? (
            <div className="rounded-2xl border border-border bg-foreground/5 p-6 text-center">
              <Building2 className="mx-auto mb-3 h-9 w-9 text-foreground/40" />
              <h3 className="text-sm font-semibold text-foreground">{providerEmptyState.title}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {providerEmptyState.description}
              </p>
              <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
                <ObCta onClick={next} loading={saving} loadingLabel="Saving...">
                  Continue without listed providers
                </ObCta>
                <p className="text-xs text-foreground/45">
                  Add local/custom providers later from Services &gt; Add Service.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedCategories.map((cat) => {
                const items = groupedProviders[cat];
                const isOpen = expandedCats.has(cat);
                const selectedInCat = items.filter((p: ScoredProvider) => selectedProviders.has(p.id)).length;
                return (
                  <div key={cat} className="rounded-xl border border-border overflow-hidden">
                    <button
                      onClick={() => toggleCat(cat)}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-foreground/[0.02] hover:bg-foreground/5 transition text-left"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-foreground/5 text-muted-foreground">
                        <CategoryIcon category={cat} className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium text-foreground/80 flex-1">{getMergedDisplayCategoryLabel(cat)}</span>
                      <span className="text-[10px] text-foreground/45">{items.length}</span>
                      {selectedInCat > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-tone-orange-bg text-tone-orange-fg text-[10px] font-medium">{selectedInCat}</span>
                      )}
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-foreground/40" /> : <ChevronDown className="h-3.5 w-3.5 text-foreground/40" />}
                    </button>
                    {isOpen && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3 pt-1">
                        {items.map((provider: ScoredProvider) => {
                          const isSelected = selectedProviders.has(provider.id);
                          const bd = billingData[provider.id];
                          return (
                            <div key={provider.id} className={`rounded-xl border transition-all ${
                              isSelected
                                ? "border-tone-orange-br bg-tone-orange-bg"
                                : "border-border bg-foreground/[0.02] hover:bg-foreground/5"
                            }`}>
                              <button type="button" onClick={() => toggleProvider(provider)}
                                className="group relative text-left p-3 w-full"
                              >
                                {isSelected && <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-tone-orange-fg" />}
                                <div className="flex items-center gap-3">
                                  <OnboardingProviderLogo provider={provider} isSelected={isSelected} />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm text-foreground truncate pr-5">{provider.name}</p>
                                    {getMergedDisplaySubcategoryLabel(provider.category) && (
                                      <p className="text-[10px] text-foreground/45 truncate">{getMergedDisplaySubcategoryLabel(provider.category)}</p>
                                    )}
                                    {provider.description && (
                                      <p className="text-[11px] text-foreground/45 truncate">{provider.description}</p>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                        provider.scope === "FEDERAL" ? "bg-tone-sky-bg text-tone-sky-fg" : "bg-tone-emerald-bg text-tone-emerald-fg"
                                      }`}>
                                        {provider.scope === "FEDERAL" ? "Federal" : provider.states.join(", ")}
                                      </span>
                                      {provider.website && (
                                        <span className="text-[9px] text-foreground/45 flex items-center gap-0.5">
                                          <Globe className="h-2.5 w-2.5" />
                                          {provider.website.replace(/https?:\/\/(www\.)?/, "").split("/")[0]}
                                        </span>
                                      )}
                                      {bd?.monthlyCost && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-tone-emerald-bg text-tone-emerald-fg font-medium">
                                          ${bd.monthlyCost}/mo
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                              {isSelected && (
                                <div className="flex items-center gap-2 px-3 pb-2.5 pt-0" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <span className="text-[10px] text-foreground/45 shrink-0">$</span>
                                    <input
                                      type="number" step="0.01" placeholder="Monthly cost"
                                      className="h-7 w-full text-xs rounded-lg border border-border bg-foreground/5 px-2 text-foreground placeholder:text-foreground/35 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                      value={bd?.monthlyCost || ""}
                                      onChange={(e) => setBillingData((prev) => ({ ...prev, [provider.id]: { monthlyCost: e.target.value, billingCycle: prev[provider.id]?.billingCycle || "MONTHLY" } }))}
                                    />
                                  </div>
                                  <select
                                    className="h-7 text-[10px] rounded-lg border border-border bg-foreground/5 px-1 text-foreground/80 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    value={bd?.billingCycle || "MONTHLY"}
                                    onChange={(e) => setBillingData((prev) => ({ ...prev, [provider.id]: { monthlyCost: prev[provider.id]?.monthlyCost || "", billingCycle: e.target.value } }))}
                                  >
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="QUARTERLY">Quarterly</option>
                                    <option value="YEARLY">Yearly</option>
                                    <option value="ONE_TIME">One-time</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Moving */}
      {step === 3 && (
        <GlassCard className="p-6">
          <h2 className="h2 text-2xl text-foreground mb-1">{t.rich("aurora_step3Title", richEm)}</h2>
          <p className="text-muted-foreground text-sm mb-5">
            {isPremium
              ? "If yes, we'll generate a personalized checklist with tasks and deadlines. If not, you can add one any time from the Moving tab."
              : "If yes, we'll build a personalized preview of your move plan — your countdown and top critical steps. If not, you can organize your home now and plan a move any time."}
          </p>

          {wantsToMove === null && (
            <div className="flex flex-col items-center gap-4">
              <Truck className="h-14 w-14 text-tone-orange-fg/30" />
              <div className="flex items-center gap-3">
                <ObCta onClick={() => setWantsToMove(true)} arrow={false}>
                  <Truck className="h-4 w-4" aria-hidden="true" /> Yes, plan my move
                </ObCta>
                <ObCta variant="back" backArrow={false} onClick={() => { setWantsToMove(false); }}>
                  Not right now
                </ObCta>
              </div>
            </div>
          )}

          {wantsToMove === false && (
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-tone-emerald-fg/50 mb-3" />
              <p className="text-muted-foreground text-sm mb-1">No problem! You can create a moving plan anytime.</p>
              <p className="text-foreground/40 text-xs">Go to Moving section from the sidebar when you&apos;re ready.</p>
              <ObCta
                className="mt-5"
                onClick={finishOnboarding}
                loading={saving}
                loadingLabel="Finishing..."
              >
                Go to Dashboard
              </ObCta>
            </div>
          )}

          {wantsToMove === true && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-tone-orange-fg" />
                <h3 className="text-sm font-semibold text-foreground">Where are you moving to?</h3>
              </div>
              <AddressAutocompleteInput
                label="Street Address"
                value={movingForm.street}
                placeholder="123 New St (optional)"
                onValueChange={(value) => updateMovingField("street", value)}
                onSelect={handleMovingAutocompleteSelect}
              />
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label htmlFor="onb-move-city" className={labelCls}>City *</label>
                  <input id="onb-move-city" aria-required="true" className={inputCls} value={movingForm.city} onChange={(e) => updateMovingField("city", e.target.value)} placeholder="Austin" />
                </div>
                <div>
                  <label htmlFor="onb-move-state" className={labelCls}>State *</label>
                  <input id="onb-move-state" aria-required="true" className={inputCls} value={movingForm.state} maxLength={2} onChange={(e) => updateMovingField("state", e.target.value.toUpperCase().slice(0, 2))} placeholder="TX" />
                </div>
                <div>
                  <label htmlFor="onb-move-zip" className={labelCls}>ZIP *</label>
                  <input id="onb-move-zip" aria-required="true" className={inputCls} value={movingForm.zip} onChange={(e) => updateMovingField("zip", e.target.value)} placeholder="78701" />
                </div>
              </div>
              <div>
                <label htmlFor="onb-move-date" className={labelCls}>Move Date *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 pointer-events-none" />
                  <input id="onb-move-date" aria-required="true" type="date" className={`${inputCls} pl-10`} value={movingForm.moveDate} onChange={(e) => updateMovingField("moveDate", e.target.value)} />
                </div>
              </div>

              {/* Aspirational "what Pro unlocks for YOUR move" showcase — built
                  from the user's REAL entered context (origin → destination
                  state + household). SHOWCASE, not a paywall: the only action is
                  a quiet "See Pro" link to /pricing; the primary "Preview /
                  Create plan" CTA below proceeds normally. Shown only once a
                  destination state is typed so the copy stays concrete; never
                  shown to users already on a paid plan. NO payment step here. */}
              {!isPremium && proShowcaseContext && (
                <ObProShowcase
                  eyebrow={t("proShowcase_eyebrow")}
                  headline={t.rich("proShowcase_headline", {
                    ...richEm,
                    from: proShowcaseFromLabel,
                    to: proShowcaseToLabel,
                  })}
                  features={proShowcaseFeatures}
                  featureLabel={proShowcaseFeatureLabel}
                  footnote={t("proShowcase_footnote")}
                  seeProLabel={t("proShowcase_cta")}
                  onSeePro={handleSeePro}
                />
              )}

              <div className="flex items-center gap-3 pt-2">
                <ObCta
                  className="flex-1"
                  onClick={finishOnboarding}
                  loading={saving}
                  loadingLabel={
                    isPremium && uxOnboardingTeaserVariant !== "variant"
                      ? "Creating Plan..."
                      : "Building preview..."
                  }
                >
                  {isPremium && uxOnboardingTeaserVariant !== "variant" ? <>Create Plan &amp; Go</> : <>Preview my move plan</>}
                </ObCta>
                <ObCta variant="back" backArrow={false} onClick={() => { setWantsToMove(null); }}>
                  Cancel
                </ObCta>
              </div>
            </div>
          )}
        </GlassCard>
      )}

        </div>
      </div>
    </div>

      {/* Sticky Navigation Footer — on lg the controls align under the wizard
          column (the empty first grid cell mirrors the aside width). */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="backdrop-blur-xl border-t border-border" style={{ background: "color-mix(in srgb, var(--surface) 80%, transparent)" }}>
          <div className="max-w-2xl mx-auto px-4 py-3 lg:max-w-[min(100vw_-_3rem,76rem)] lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
            <div className="hidden lg:block" aria-hidden="true" />
            <div className="flex items-center justify-between">
              {/* Unified hierarchy: Primary (filled) > Back (quiet ghost) >
                  Skip (lowest, mono link). Disabled/click semantics are
                  byte-identical to the buttons these replace. */}
              <ObCta variant="back" onClick={prev} disabled={step === 0 || saving}>
                Back
              </ObCta>
              <div className="flex items-center gap-3">
                {step === 2 && (
                  <ObCta variant="skip" onClick={next} disabled={saving}>
                    Skip
                  </ObCta>
                )}
                {step < 3 && (
                  <ObCta
                    onClick={next}
                    loading={saving}
                    loadingLabel="Saving..."
                    disabled={saving || (step === 0 && !legalAcceptedOnServer && !hasRequiredLegalConsents(legalConsents))}
                    disabledHint={step === 0 ? t("cta_hint_legal") : undefined}
                  >
                    Continue
                  </ObCta>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
