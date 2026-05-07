"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight, User, MapPin, Zap, Truck, CheckCircle2, AlertCircle,
  Loader2, Globe, Phone, Search, Building2, Shield, X, ChevronDown, ChevronUp, Sparkles, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { AddressAutocompleteInput } from "@/components/address/address-autocomplete-input";
import {
  getRecommendedProviders,
  getMergedDisplayCategoryIcon,
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
import { LegalConsentPanel } from "@/components/legal/legal-consent-panel";
import { buildOnboardingProfilePayload } from "@/lib/onboarding-profile-payload";
import { getProviderEmptyStateCopy } from "@/lib/provider-empty-state";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/shared-address-autocomplete";
import {
  ServiceLimitUpsell,
  type ServiceLimitDetails,
} from "@/components/shared/service-limit-upsell";
import { trackEvent } from "@/lib/analytics";

const STEPS = [
  { icon: User, label: "Profile" },
  { icon: MapPin, label: "Address" },
  { icon: Zap, label: "Services" },
  { icon: Truck, label: "Moving" },
];

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

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [serviceLimit, setServiceLimit] = useState<ServiceLimitDetails | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [legalConsents, setLegalConsents] = useState(() => getDefaultLegalConsents());
  const [legalAcceptedOnServer, setLegalAcceptedOnServer] = useState(false);
  const legalStepRequested = searchParams.get("step") === "legal";

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
          router.replace("/dashboard");
          return;
        }

        const hasLegal = hasRequiredLegalConsents(data.legalConsents);
        setLegalAcceptedOnServer(hasLegal);
        if (data.legalConsents) {
          setLegalConsents(getDefaultLegalConsents(data.legalConsents));
        }

        if (!hasLegal) {
          if (!legalStepRequested) {
            router.replace("/onboarding?step=legal");
          }
          return;
        }

        if (legalStepRequested) {
          router.replace("/onboarding");
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

  // Step 0 â€“ Profile
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

  // Step 1 â€“ Address
  const [address, setAddress] = useState({
    nickname: "", street: "", city: "", state: "", zip: "",
    country: "USA", type: "HOME", ownership: "RENTER", startDate: new Date().toISOString().slice(0, 10),
    formattedAddress: null as string | null,
    placeId: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [createdAddressId, setCreatedAddressId] = useState<string | null>(null);

  // Step 2 â€“ Providers
  const [providers, setProviders] = useState<ScoredProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<Map<string, ScoredProvider>>(new Map());
  const [providerSearch, setProviderSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Step 3 â€“ Moving plan
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
      if (address.state) params.set("state", address.state);
      if (address.zip) params.set("zip", address.zip);
      const res = await fetch(`/api/providers/recommendations?${params.toString()}`);
      const data = await res.json();
      setProviders(data.allProviders || []);
    } catch {
      setProviders([]);
    } finally {
      setLoadingProviders(false);
    }
  }, [address.state, address.zip]);

  useEffect(() => {
    if (step === 2) fetchProviders();
  }, [step, fetchProviders]);

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
    if (!movingForm.city.trim() || !movingForm.state.trim() || !movingForm.zip.trim() || !movingForm.moveDate) {
      setError("Please fill in destination city, state, ZIP, and move date.");
      return false;
    }
    if (movingForm.state.length !== 2) {
      setError("State must be a 2-letter code.");
      return false;
    }
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

  const recordOnboardingProgress = async (event: "SERVICES_SKIPPED" | "MOVING_SKIPPED" | "COMPLETED") => {
    await fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
    }).catch(() => null);
  };

  const next = async () => {
    let ok = true;
    if (step === 0) ok = await saveProfile();
    else if (step === 1) ok = await saveAddress();
    else if (step === 2) {
      const selectedCount = selectedProviders.size;
      ok = await saveServices();
      if (ok && selectedCount === 0) {
        await recordOnboardingProgress("SERVICES_SKIPPED");
      }
    }
    if (!ok) return;
    if (step < 3) { setStep(step + 1); setError(""); }
    else router.push("/dashboard");
  };

  const finishOnboarding = async () => {
    const planId = await saveMovingPlan();
    if (planId === false) return;
    if (typeof planId === "string") {
      trackEvent("moving_plan_started", { source: "onboarding" });
      await recordOnboardingProgress("COMPLETED");
      trackEvent("onboarding_completed", { created_moving_plan: true });
      router.push(`/moving/${planId}`);
      return;
    }
    await recordOnboardingProgress("MOVING_SKIPPED");
    await recordOnboardingProgress("COMPLETED");
    trackEvent("onboarding_completed", { created_moving_plan: false });
    router.push("/dashboard");
  };

  const prev = () => { if (step > 0) { setStep(step - 1); setError(""); } };

  // ---- Provider scoring & filtering ----
  const recommended = getRecommendedProviders(providers, 12);

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

          <button
            type="button"
            onClick={acceptLegal}
            disabled={saving || !hasRequiredLegalConsents(legalConsents)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-tone-orange-fg px-6 py-2.5 text-sm font-medium text-white transition hover:bg-tone-orange-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ServiceLimitUpsell
        open={Boolean(serviceLimit)}
        details={serviceLimit}
        onClose={() => setServiceLimit(null)}
        returnTo="/onboarding"
      />

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-1">
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

      {/* Step 0: Profile */}
      {step === 0 && (
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Your Profile</h2>
          <p className="text-muted-foreground text-sm mb-5">Help us personalize your experience</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>First Name *</label>
                <input aria-required="true" className={inputCls} value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} placeholder="John" />
              </div>
              <div>
                <label className={labelCls}>Last Name *</label>
                <input aria-required="true" className={inputCls} value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} placeholder="Doe" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Age Range</label>
                <select className={selectCls} value={profile.ageRange} onChange={(e) => setProfile({ ...profile, ageRange: e.target.value })}>
                  <option value="">Select</option>
                  <option value="18-24">18-24</option>
                  <option value="25-34">25-34</option>
                  <option value="35-44">35-44</option>
                  <option value="45-54">45-54</option>
                  <option value="55+">55+</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Family Status</label>
                <select className={selectCls} value={profile.familyStatus} onChange={(e) => setProfile({ ...profile, familyStatus: e.target.value })}>
                  <option value="SINGLE">Single</option>
                  <option value="COUPLE">Couple</option>
                  <option value="FAMILY">Family</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground -mt-2">
              Tap the ones that apply â€” all optional. We use these only to tailor your checklist.
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
                    These fields are sensitive under US and EU privacy law. They&apos;re never required, never shared, and you can turn this off any time in Settings â†’ Privacy.
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
                <label className={labelCls}>Number of Children</label>
                <input className={inputCls} type="number" min="0" max="20" value={profile.childrenCount} onChange={(e) => setProfile({ ...profile, childrenCount: parseInt(e.target.value) || 0 })} />
              </div>
            )}
            <div>
              <label className={labelCls}>Number of Cars</label>
              <input className={inputCls} type="number" min="0" max="10" value={profile.carCount} onChange={(e) => setProfile({ ...profile, carCount: parseInt(e.target.value) || 0 })} />
            </div>

            {/* Move Type */}
            <div>
              <label className={labelCls}>Move Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: "PERSONAL", label: "ðŸ  Personal" },
                  { value: "BUSINESS", label: "ðŸ’¼ Business" },
                  { value: "VACATION", label: "ðŸŒ´ Vacation" },
                  { value: "MILITARY", label: "ðŸŽ–ï¸ Military" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProfile({ ...profile, moveType: opt.value, ...(opt.value === "MILITARY" ? { isMilitary: true } : {}) })}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                      profile.moveType === opt.value
                        ? "border-tone-orange-br bg-tone-orange-bg text-tone-orange-fg"
                        : "border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Immigration Status â€” only shown when sensitive opt-in is on. */}
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
                    ðŸŒ Immigrant / Visa Holder
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
                  ðŸ¢ Business Owner
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
        </GlassCard>
      )}

      {/* Step 1: Address */}
      {step === 1 && (
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Your Primary Address</h2>
          <p className="text-muted-foreground text-sm mb-5">Where do you currently live?</p>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Nickname</label>
              <input className={inputCls} placeholder="e.g. Home, Apartment" value={address.nickname} onChange={(e) => updateAddressField("nickname", e.target.value)} />
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
                <label className={labelCls}>City *</label>
                <input aria-required="true" className={inputCls} placeholder="Austin" value={address.city} onChange={(e) => updateAddressField("city", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>State *</label>
                <input aria-required="true" className={inputCls} maxLength={2} placeholder="TX" value={address.state} onChange={(e) => updateAddressField("state", e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className={labelCls}>ZIP *</label>
                <input aria-required="true" className={inputCls} maxLength={10} placeholder="78701" value={address.zip} onChange={(e) => updateAddressField("zip", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Type</label>
                <select className={selectCls} value={address.type} onChange={(e) => updateAddressField("type", e.target.value)}>
                  <option value="HOME">Home</option>
                  <option value="WORK">Work</option>
                  <option value="VACATION">Vacation</option>
                  <option value="TEMPORARY">Temporary</option>
                  <option value="STORAGE">Storage</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Ownership</label>
                <select className={selectCls} value={address.ownership} onChange={(e) => updateAddressField("ownership", e.target.value)}>
                  <option value="OWNER">Owner</option>
                  <option value="RENTER">Renter</option>
                  <option value="FAMILY">Family</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Move-in Date</label>
                <input className={inputCls} type="date" value={address.startDate} onChange={(e) => updateAddressField("startDate", e.target.value)} />
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Step 2: Services */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Choose Listed Providers</h2>
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

          {/* Selected chips */}
          {selectedProviders.size > 0 && (
            <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-tone-orange-bg border border-tone-orange-br">
              {Array.from(selectedProviders.values()).map((p) => (
                <button key={p.id} onClick={() => toggleProvider(p)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-tone-orange-fg text-white text-xs font-medium hover:bg-tone-orange-bg transition">
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

          {/* Category filter â€“ collapsed by default */}
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
                    >{getMergedDisplayCategoryIcon(cat)} {getMergedDisplayCategoryLabel(cat)} ({count})</button>
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

          {/* Provider categories â€“ collapsed accordion */}
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
                <button
                  type="button"
                  onClick={next}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-tone-orange-fg px-4 py-2 text-sm font-medium text-white transition hover:bg-tone-orange-bg disabled:opacity-50"
                >
                  Continue without listed providers <ArrowRight className="h-4 w-4" />
                </button>
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
                      <span className="text-base">{getMergedDisplayCategoryIcon(cat)}</span>
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
          <h2 className="text-lg font-semibold text-foreground mb-1">Do you have a move planned?</h2>
          <p className="text-muted-foreground text-sm mb-5">
            If yes, we&apos;ll generate a personalized checklist with tasks and deadlines. If not, you can add one any time from the Moving tab.
          </p>

          {wantsToMove === null && (
            <div className="flex flex-col items-center gap-4">
              <Truck className="h-14 w-14 text-tone-orange-fg/30" />
              <div className="flex gap-3">
                <button
                  onClick={() => setWantsToMove(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:bg-tone-orange-bg transition"
                >
                  <Truck className="h-4 w-4" /> Yes, plan my move
                </button>
                <button
                  onClick={() => { setWantsToMove(false); }}
                  className="px-5 py-3 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition"
                >Not right now</button>
              </div>
            </div>
          )}

          {wantsToMove === false && (
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-tone-emerald-fg/50 mb-3" />
              <p className="text-muted-foreground text-sm mb-1">No problem! You can create a moving plan anytime.</p>
              <p className="text-foreground/40 text-xs">Go to Moving section from the sidebar when you&apos;re ready.</p>
              <button
                onClick={finishOnboarding}
                disabled={saving}
                className="mt-5 flex items-center gap-2 mx-auto px-6 py-2.5 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:bg-tone-orange-bg transition disabled:opacity-50"
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Finishing...</> : <>Go to Dashboard <ArrowRight className="h-4 w-4" /></>}
              </button>
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
                  <label className={labelCls}>City *</label>
                  <input aria-required="true" className={inputCls} value={movingForm.city} onChange={(e) => updateMovingField("city", e.target.value)} placeholder="Austin" />
                </div>
                <div>
                  <label className={labelCls}>State *</label>
                  <input aria-required="true" className={inputCls} value={movingForm.state} maxLength={2} onChange={(e) => updateMovingField("state", e.target.value.toUpperCase().slice(0, 2))} placeholder="TX" />
                </div>
                <div>
                  <label className={labelCls}>ZIP *</label>
                  <input aria-required="true" className={inputCls} value={movingForm.zip} onChange={(e) => updateMovingField("zip", e.target.value)} placeholder="78701" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Move Date *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 pointer-events-none" />
                  <input aria-required="true" type="date" className={`${inputCls} pl-10`} value={movingForm.moveDate} onChange={(e) => updateMovingField("moveDate", e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={finishOnboarding}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:bg-tone-orange-bg transition disabled:opacity-50"
                >
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Creating Plan...</> : <>Create Plan & Go <ArrowRight className="h-4 w-4" /></>}
                </button>
                <button
                  onClick={() => { setWantsToMove(null); }}
                  className="px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition"
                >Cancel</button>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* Sticky Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="backdrop-blur-xl border-t border-border" style={{ background: "color-mix(in srgb, var(--surface) 80%, transparent)" }}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={prev}
              disabled={step === 0 || saving}
              className="px-5 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >Back</button>
            <div className="flex items-center gap-2">
              {step === 2 && (
                <button
                  onClick={next}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition"
                >Skip</button>
              )}
              {step < 3 && (
                <button
                  onClick={next}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:bg-tone-orange-bg transition disabled:opacity-50"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                  ) : (
                    <>Continue<ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
