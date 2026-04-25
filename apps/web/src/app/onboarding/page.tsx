"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  groupByMergedDisplayCategory,
} from "@/lib/recommendation-engine";
import type { ScoredProvider } from "@/lib/recommendation-engine";
import {
  clearPendingLegalConsentsFromSession,
  createAcceptedLegalConsents,
  getDefaultLegalConsents,
  hasRequiredLegalConsents,
  readPendingLegalConsentsFromSession,
} from "@/lib/legal";
import { LegalConsentPanel } from "@/components/legal/legal-consent-panel";
import { buildOnboardingProfilePayload } from "@/lib/onboarding-profile-payload";
import { applyAddressAutocompleteResult, clearAddressAutocompleteMetadata, type AddressAutocompleteResult } from "@/lib/shared-address-autocomplete";

const STEPS = [
  { icon: User, label: "Profile" },
  { icon: MapPin, label: "Address" },
  { icon: Zap, label: "Services" },
  { icon: Truck, label: "Moving" },
];

// --- Glass card wrapper ---
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl ${className}`}>
      {children}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [legalConsents, setLegalConsents] = useState(() => getDefaultLegalConsents());

  // Redirect to dashboard if user already completed onboarding
  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((data) => {
      if (data.onboardingCompleted === true) {
        router.replace("/dashboard");
        return;
      }
      if (data.legalConsents) {
        setLegalConsents(getDefaultLegalConsents(data.legalConsents));
        return;
      }
      const pending = readPendingLegalConsentsFromSession();
      if (pending) setLegalConsents(pending);
    }).catch(() => {});
  }, [router]);

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
  const [selectedProviders, setSelectedProviders] = useState<Map<string, ScoredProvider>>(new Map());
  const [providerSearch, setProviderSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

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
    if (!hasRequiredLegalConsents(legalConsents)) {
      setError("You must accept the Terms of Use and Legal Disclaimer before continuing.");
      return false;
    }
    setError("");
    setSaving(true);
    try {
      const acceptedLegalConsents = createAcceptedLegalConsents(legalConsents);
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOnboardingProfilePayload(profile, acceptedLegalConsents)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save profile");
      }
      clearPendingLegalConsentsFromSession();
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
        if (res.ok) saved++;
      }
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

  const next = async () => {
    let ok = true;
    if (step === 0) ok = await saveProfile();
    else if (step === 1) ok = await saveAddress();
    else if (step === 2) ok = await saveServices();
    if (!ok) return;
    if (step < 3) { setStep(step + 1); setError(""); }
    else router.push("/dashboard");
  };

  const finishOnboarding = async () => {
    const planId = await saveMovingPlan();
    if (planId === false) return;
    if (typeof planId === "string") {
      router.push(`/moving/${planId}`);
      return;
    }
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

  // --- Common input styles for glass theme ---
  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition";
  const selectCls = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition [&>option]:bg-slate-800 [&>option]:text-white";
  const labelCls = "block text-xs font-medium text-white/60 mb-1.5";
  const checkboxCls = "w-4 h-4 rounded border-white/20 bg-white/5 accent-orange-500 cursor-pointer";

  return (
    <div className="space-y-5">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                i < step
                  ? "bg-emerald-500/20 text-emerald-400"
                  : i === step
                  ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40"
                  : "bg-white/5 text-white/30"
              }`}>
                {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-px ${i < step ? "bg-emerald-500/40" : "bg-white/10"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 0: Profile */}
      {step === 0 && (
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Your Profile</h2>
          <p className="text-white/40 text-sm mb-5">Help us personalize your experience</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>First Name *</label>
                <input className={inputCls} value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} placeholder="John" />
              </div>
              <div>
                <label className={labelCls}>Last Name *</label>
                <input className={inputCls} value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} placeholder="Doe" />
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

            <p className="text-xs text-white/40 -mt-2">
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
                <label key={key} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 cursor-pointer hover:bg-white/10 transition text-sm text-white/70">
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
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
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
                  <p className="text-sm font-semibold text-white">
                    Share accessibility and immigration details <span className="text-white/40 font-normal">(optional)</span>
                  </p>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">
                    These fields are sensitive under US and EU privacy law. They&apos;re never required, never shared, and you can turn this off any time in Settings → Privacy.
                  </p>
                </div>
              </label>

              {profile.sensitiveOptIn ? (
                <div className="space-y-3 pl-8">
                  <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 cursor-pointer hover:bg-white/10 transition text-sm text-white/70">
                    <input
                      type="checkbox"
                      className={checkboxCls}
                      checked={profile.hasDisability}
                      onChange={(e) => setProfile({ ...profile, hasDisability: e.target.checked })}
                    />
                    <div className="flex-1">
                      <p>Someone at home has a disability</p>
                      <p className="mt-0.5 text-[11px] text-white/40">
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
                  { value: "PERSONAL", label: "🏠 Personal" },
                  { value: "BUSINESS", label: "💼 Business" },
                  { value: "VACATION", label: "🌴 Vacation" },
                  { value: "MILITARY", label: "🎖️ Military" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProfile({ ...profile, moveType: opt.value, ...(opt.value === "MILITARY" ? { isMilitary: true } : {}) })}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                      profile.moveType === opt.value
                        ? "border-orange-500 bg-orange-500/20 text-orange-300"
                        : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Immigration Status — only shown when sensitive opt-in is on. */}
            {profile.sensitiveOptIn ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-white">Immigration status <span className="text-white/40 font-normal">(optional)</span></p>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">
                    Why we ask: some states (CA, NY, WA) have different DMV document rules for new residents depending on visa status. Skip if it doesn&apos;t apply.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 cursor-pointer hover:bg-white/10 transition text-sm text-white/70">
                    <input
                      type="checkbox"
                      className={checkboxCls}
                      checked={profile.isImmigrant}
                      onChange={(e) => setProfile({ ...profile, isImmigrant: e.target.checked, immigrationStatus: e.target.checked ? profile.immigrationStatus : "" })}
                    />
                    🌍 Immigrant / Visa Holder
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
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 cursor-pointer hover:bg-white/10 transition text-sm text-white/70">
                  <input
                    type="checkbox"
                    className={checkboxCls}
                    checked={profile.isBusinessOwner}
                    onChange={(e) => setProfile({ ...profile, isBusinessOwner: e.target.checked, businessType: e.target.checked ? profile.businessType : "" })}
                  />
                  🏢 Business Owner
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

            <LegalConsentPanel
              consents={legalConsents}
              onChange={setLegalConsents}
              className="pt-2"
            />
          </div>
        </GlassCard>
      )}

      {/* Step 1: Address */}
      {step === 1 && (
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Your Primary Address</h2>
          <p className="text-white/40 text-sm mb-5">Where do you currently live?</p>
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
                <input className={inputCls} placeholder="Austin" value={address.city} onChange={(e) => updateAddressField("city", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>State *</label>
                <input className={inputCls} maxLength={2} placeholder="TX" value={address.state} onChange={(e) => updateAddressField("state", e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className={labelCls}>ZIP *</label>
                <input className={inputCls} maxLength={10} placeholder="78701" value={address.zip} onChange={(e) => updateAddressField("zip", e.target.value)} />
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
              <h2 className="text-lg font-semibold text-white">Choose Your Providers</h2>
              <p className="text-sm text-white/40">
                Showing for <span className="text-orange-400 font-medium">{address.state || "all states"}</span>
              </p>
            </div>
            {selectedProviders.size > 0 && (
              <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-medium">
                {selectedProviders.size} selected
              </span>
            )}
          </div>

          {/* Selected chips */}
          {selectedProviders.size > 0 && (
            <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
              {Array.from(selectedProviders.values()).map((p) => (
                <button key={p.id} onClick={() => toggleProvider(p)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition">
                  {p.name} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition"
              placeholder="Search providers..."
              value={providerSearch}
              onChange={(e) => setProviderSearch(e.target.value)}
            />
          </div>

          {/* Category filter – collapsed by default */}
          <div>
            <button
              onClick={() => setShowCategories(!showCategories)}
              className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition"
            >
              {showCategories ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showCategories ? "Hide categories" : "Browse by category"}
              <span className="text-white/30">({allCategories.length})</span>
            </button>
            {showCategories && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                    !activeCategory ? "bg-orange-500 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >All ({providers.length})</button>
                {allCategories.map((cat) => {
                  const count = providers.filter((p) => getMergedDisplayCategoryKey(p.category) === cat).length;
                  return (
                    <button key={cat}
                      onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        activeCategory === cat ? "bg-orange-500 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
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
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Recommended for You</h3>
                <span className="text-[10px] text-white/30 ml-auto">Based on your profile</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recommended.map((provider) => {
                  const isSelected = selectedProviders.has(provider.id);
                  return (
                    <button key={`rec-${provider.id}`} type="button" onClick={() => toggleProvider(provider)}
                      className={`group relative text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "border-orange-500/50 bg-orange-500/10"
                          : "border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-orange-400" />}
                      <div className="flex items-center gap-3">
                        <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                          isSelected ? "bg-orange-500 text-white" : "bg-white/5 text-white/60"
                        }`}>{provider.name.charAt(0)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-white truncate pr-6">{provider.name}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {(provider.matchReasons.length > 0 ? provider.matchReasons : [getMergedDisplayCategoryLabel(provider.category)]).slice(0, 2).map((reason, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-300/60 border border-orange-500/10">
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
              <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
              <span className="ml-2 text-white/40 text-sm">Loading providers...</span>
            </div>
          ) : sortedCategories.length === 0 ? (
            <div className="text-center py-12 text-white/40 text-sm">No providers found.</div>
          ) : (
            <div className="space-y-2">
              {sortedCategories.map((cat) => {
                const items = groupedProviders[cat];
                const isOpen = expandedCats.has(cat);
                const selectedInCat = items.filter((p: ScoredProvider) => selectedProviders.has(p.id)).length;
                return (
                  <div key={cat} className="rounded-xl border border-white/5 overflow-hidden">
                    <button
                      onClick={() => toggleCat(cat)}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-white/[0.02] hover:bg-white/5 transition text-left"
                    >
                      <span className="text-base">{getMergedDisplayCategoryIcon(cat)}</span>
                      <span className="text-sm font-medium text-white/80 flex-1">{getMergedDisplayCategoryLabel(cat)}</span>
                      <span className="text-[10px] text-white/30">{items.length}</span>
                      {selectedInCat > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-medium">{selectedInCat}</span>
                      )}
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
                    </button>
                    {isOpen && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3 pt-1">
                        {items.map((provider: ScoredProvider) => {
                          const isSelected = selectedProviders.has(provider.id);
                          const bd = billingData[provider.id];
                          return (
                            <div key={provider.id} className={`rounded-xl border transition-all ${
                              isSelected
                                ? "border-orange-500/50 bg-orange-500/10"
                                : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                            }`}>
                              <button type="button" onClick={() => toggleProvider(provider)}
                                className="group relative text-left p-3 w-full"
                              >
                                {isSelected && <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-orange-400" />}
                                <div className="flex items-center gap-3">
                                  <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                                    isSelected ? "bg-orange-500 text-white" : "bg-white/5 text-white/50"
                                  }`}>{provider.name.charAt(0)}</div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm text-white truncate pr-5">{provider.name}</p>
                                    {provider.description && (
                                      <p className="text-[11px] text-white/30 truncate">{provider.description}</p>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                        provider.scope === "FEDERAL" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300"
                                      }`}>
                                        {provider.scope === "FEDERAL" ? "Federal" : provider.states.join(", ")}
                                      </span>
                                      {provider.website && (
                                        <span className="text-[9px] text-white/20 flex items-center gap-0.5">
                                          <Globe className="h-2.5 w-2.5" />
                                          {provider.website.replace(/https?:\/\/(www\.)?/, "").split("/")[0]}
                                        </span>
                                      )}
                                      {bd?.monthlyCost && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
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
                                    <span className="text-[10px] text-white/30 shrink-0">$</span>
                                    <input
                                      type="number" step="0.01" placeholder="Monthly cost"
                                      className="h-7 w-full text-xs rounded-lg border border-white/10 bg-white/5 px-2 text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                                      value={bd?.monthlyCost || ""}
                                      onChange={(e) => setBillingData((prev) => ({ ...prev, [provider.id]: { monthlyCost: e.target.value, billingCycle: prev[provider.id]?.billingCycle || "MONTHLY" } }))}
                                    />
                                  </div>
                                  <select
                                    className="h-7 text-[10px] rounded-lg border border-white/10 bg-white/5 px-1 text-white/60 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
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
          <h2 className="text-lg font-semibold text-white mb-1">Do you have a move planned?</h2>
          <p className="text-white/40 text-sm mb-5">
            If yes, we&apos;ll generate a personalized checklist with tasks and deadlines. If not, you can add one any time from the Moving tab.
          </p>

          {wantsToMove === null && (
            <div className="flex flex-col items-center gap-4">
              <Truck className="h-14 w-14 text-orange-400/30" />
              <div className="flex gap-3">
                <button
                  onClick={() => setWantsToMove(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition"
                >
                  <Truck className="h-4 w-4" /> Yes, plan my move
                </button>
                <button
                  onClick={() => { setWantsToMove(false); }}
                  className="px-5 py-3 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition"
                >Not right now</button>
              </div>
            </div>
          )}

          {wantsToMove === false && (
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-400/50 mb-3" />
              <p className="text-white/60 text-sm mb-1">No problem! You can create a moving plan anytime.</p>
              <p className="text-white/30 text-xs">Go to Moving section from the sidebar when you&apos;re ready.</p>
              <button
                onClick={finishOnboarding}
                disabled={saving}
                className="mt-5 flex items-center gap-2 mx-auto px-6 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Finishing...</> : <>Go to Dashboard <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          )}

          {wantsToMove === true && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-orange-400" />
                <h3 className="text-sm font-semibold text-white">Where are you moving to?</h3>
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
                  <input className={inputCls} value={movingForm.city} onChange={(e) => updateMovingField("city", e.target.value)} placeholder="Austin" />
                </div>
                <div>
                  <label className={labelCls}>State *</label>
                  <input className={inputCls} value={movingForm.state} maxLength={2} onChange={(e) => updateMovingField("state", e.target.value.toUpperCase().slice(0, 2))} placeholder="TX" />
                </div>
                <div>
                  <label className={labelCls}>ZIP *</label>
                  <input className={inputCls} value={movingForm.zip} onChange={(e) => updateMovingField("zip", e.target.value)} placeholder="78701" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Move Date *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                  <input type="date" className={`${inputCls} pl-10`} value={movingForm.moveDate} onChange={(e) => updateMovingField("moveDate", e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={finishOnboarding}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Creating Plan...</> : <>Create Plan & Go <ArrowRight className="h-4 w-4" /></>}
                </button>
                <button
                  onClick={() => { setWantsToMove(null); }}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition"
                >Cancel</button>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* Sticky Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="backdrop-blur-xl border-t border-white/5" style={{ background: "color-mix(in srgb, var(--surface) 80%, transparent)" }}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <button
              onClick={prev}
              disabled={step === 0 || saving}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >Back</button>
            <div className="flex items-center gap-2">
              {step === 2 && (
                <button
                  onClick={next}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition"
                >Skip</button>
              )}
              {step < 3 && (
                <button
                  onClick={next}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
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
