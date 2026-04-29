"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, Globe, Building2,
  ChevronDown, ChevronUp, Star, Sparkles, X, Loader2,
  Search, MapPin, DollarSign, Home, Minus,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  getRecommendedProviders,
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryKey,
  getMergedDisplayCategoryLabel,
  getMergedDisplayCategoryOrder,
  getMergedDisplaySubcategoryLabel,
  groupByMergedDisplayCategory,
  PROVIDER_CATEGORY_OPTIONS,
} from "@/lib/recommendation-engine";
import type { ScoredProvider } from "@/lib/recommendation-engine";
import { getProviderEmptyStateCopy } from "@/lib/provider-empty-state";
import {
  ServiceLimitUpsell,
  type ServiceLimitDetails,
} from "@/components/shared/service-limit-upsell";
import { ServiceUsageIndicator } from "@/components/shared/service-usage-indicator";

const BILLING_CYCLES = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "ONE_TIME", label: "One-time" },
];

const CUSTOM_PROVIDER_CATEGORY_OPTIONS = [
  { value: "OTHER", label: "Other", icon: "", order: 999 },
  ...PROVIDER_CATEGORY_OPTIONS,
].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

// ─── Types ──────────────────────────────────────────────────────────────────

interface AddressOption {
  id: string; nickname?: string; street: string; city: string; state: string; zip: string;
  type: string; isPrimary: boolean; ownership: string;
  services?: { id: string }[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function NewServicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromServiceId = searchParams.get("fromServiceId") || "";
  const prefillProviderId = searchParams.get("providerId") || "";
  const prefillCategory = searchParams.get("category") || "";

  // Address state
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>("");

  // Provider state — fetch ALL at once like wizard
  const [allProviders, setAllProviders] = useState<ScoredProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [showCategories, setShowCategories] = useState(false);

  // Multi-select
  const [selectedProviders, setSelectedProviders] = useState<Map<string, ScoredProvider>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceLimit, setServiceLimit] = useState<ServiceLimitDetails | null>(null);
  const [showCustomProvider, setShowCustomProvider] = useState(false);
  const [customProvider, setCustomProvider] = useState({
    name: "",
    category: prefillCategory || "OTHER",
    providerType: "OTHER",
    website: "",
    phone: "",
    email: "",
    notes: "",
  });

  // Billing expansion per provider
  const [billingExpanded, setBillingExpanded] = useState<Set<string>>(new Set());
  const [billingData, setBillingData] = useState<Record<string, {
    monthlyCost: string; billingCycle: string; accountNumber: string;
    billingDay: string; notes: string;
  }>>({});

  // User pref: hide cost UI when the user has opted out of budget tracking
  const [showBudget, setShowBudget] = useState<boolean>(true);
  useEffect(() => {
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.showBudget === "boolean") setShowBudget(d.showBudget); })
      .catch(() => {});
  }, []);

  // Fetch addresses — auto-select primary or first
  useEffect(() => {
    fetch("/api/addresses")
      .then((r) => r.json())
      .then((d) => {
        const addrs = d.addresses || [];
        setAddresses(addrs);
        if (addrs.length > 0) {
          const primary = addrs.find((a: AddressOption) => a.isPrimary);
          setSelectedAddress(primary ? primary.id : addrs[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch scored providers for selected address
  useEffect(() => {
    const addr = addresses.find((a) => a.id === selectedAddress);
    if (!addr) { setAllProviders([]); return; }
    setLoadingProviders(true);
    const params = new URLSearchParams();
    params.set("addressId", addr.id);
    fetch(`/api/providers/recommendations?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setAllProviders(d.allProviders || []))
      .catch(() => setAllProviders([]))
      .finally(() => setLoadingProviders(false));
  }, [selectedAddress, addresses]);

  // Pre-fill from migration flow: auto-select recommended provider and filter to category
  useEffect(() => {
    if (prefillCategory) {
      setActiveCategory(getMergedDisplayCategoryKey(prefillCategory));
    }
  }, [prefillCategory]);

  useEffect(() => {
    if (!prefillProviderId || allProviders.length === 0) return;
    const match = allProviders.find((p) => p.id === prefillProviderId);
    if (match && !selectedProviders.has(match.id)) {
      setSelectedProviders((prev) => {
        const next = new Map(prev);
        next.set(match.id, match);
        return next;
      });
    }
  }, [prefillProviderId, allProviders, selectedProviders]);

  const addr = addresses.find((a) => a.id === selectedAddress);

  // ── Filtering & grouping ──
  const recommended = getRecommendedProviders(allProviders, 12);

  const filteredProviders = allProviders.filter((p: ScoredProvider) => {
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
  const allCategories = [...new Set(allProviders.map((p) => getMergedDisplayCategoryKey(p.category)))].sort(
    (a, b) => getMergedDisplayCategoryOrder(a) - getMergedDisplayCategoryOrder(b)
  );
  const providerEmptyState = getProviderEmptyStateCopy({
    state: addr?.state || null,
    search: providerSearch,
    hasCategoryFilter: Boolean(activeCategory),
  });
  const providerCategoryLabel = (category: string) =>
    [getMergedDisplayCategoryLabel(category), getMergedDisplaySubcategoryLabel(category)]
      .filter(Boolean)
      .join(" - ");

  // Toggle provider in multi-select
  const toggleProvider = useCallback((provider: ScoredProvider) => {
    setSelectedProviders((prev) => {
      const next = new Map(prev);
      if (next.has(provider.id)) {
        next.delete(provider.id);
      } else {
        next.set(provider.id, provider);
      }
      return next;
    });
  }, []);

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // Toggle billing expansion
  const toggleBilling = (id: string) => {
    setBillingExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateBilling = (id: string, field: string, value: string) => {
    const defaults = { monthlyCost: "", billingCycle: "MONTHLY", accountNumber: "", billingDay: "", notes: "" };
    setBillingData((prev) => ({
      ...prev,
      [id]: { ...defaults, ...(prev[id] || {}), [field]: value },
    }));
  };

  // Save ALL selected providers as services (batch)
  const handleSaveAll = async () => {
    if (!selectedAddress) { setError("Please select an address."); return; }
    if (selectedProviders.size === 0) { setError("Please select at least one provider."); return; }
    setSaving(true);
    setError(null);
    let success = 0;
    let failed = 0;
    let firstError: string | null = null;
    for (const [id, p] of selectedProviders) {
      const b = billingData[id] || {};
      const payload: any = {
        addressId: selectedAddress,
        providerId: p.id,
        category: p.category || "OTHER",
        providerName: p.name,
        website: p.website || "",
        phone: p.phone || "",
      };
      if (fromServiceId) {
        payload.previousServiceId = fromServiceId;
        payload.migrationAction = "NEW";
      }
      if (b.monthlyCost) payload.monthlyCost = parseFloat(b.monthlyCost);
      if (b.billingDay) payload.billingDay = parseInt(b.billingDay);
      if (b.billingCycle) payload.billingCycle = b.billingCycle;
      if (b.accountNumber) payload.accountNumber = b.accountNumber;
      if (b.notes) payload.notes = b.notes;
      try {
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          success++;
        } else {
          failed++;
          const next = await res.json().catch(() => null);
          firstError ||= resolveServiceMutationError(next, "A selected provider could not be added.");
          if (next?.upgradeRequired || typeof next?.code === "string") {
            break;
          }
        }
      } catch {
        failed++;
        firstError ||= "A selected provider could not be added.";
      }
    }
    // If user arrived via a SWITCH flow, mark the old service accordingly
    if (success > 0 && fromServiceId) {
      try {
        await fetch(`/api/services/${fromServiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ migrationAction: "SWITCH" }),
        });
      } catch {}
    }
    setSaving(false);
    if (success > 0) {
      toast.success(`${success} service${success > 1 ? "s" : ""} added!`);
      router.push("/services");
    }
    if (failed > 0) {
      setError(firstError || `${failed} service${failed > 1 ? "s" : ""} failed to save.`);
      if (success === 0) {
        toast.error(firstError || "Selected providers could not be added.");
      }
    }
  };

  const handleAddCustomProvider = async () => {
    if (!selectedAddress) { setError("Please select an address."); return; }
    if (!customProvider.name.trim()) { setError("Provider name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const providerRes = await fetch("/api/custom-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customProvider),
      });
      const providerData = await providerRes.json();
      if (!providerRes.ok) throw new Error(providerData.error || "Failed to add custom provider");

      const serviceRes = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: selectedAddress,
          customProviderId: providerData.provider.id,
          category: providerData.provider.category || "OTHER",
          providerName: providerData.provider.name,
          website: providerData.provider.website || "",
          phone: providerData.provider.phone || "",
          email: providerData.provider.email || "",
          notes: customProvider.notes || "User-added provider. Manual tracking only.",
        }),
      });
      const serviceData = await serviceRes.json();
      if (!serviceRes.ok) throw new Error(resolveServiceMutationError(serviceData, "Failed to attach custom provider"));
      toast.success("Custom provider added for local tracking");
      router.push("/services");
    } catch (error: any) {
      setError(error?.message || "Failed to add custom provider");
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selectedProviders.size;

  const resolveServiceMutationError = (data: any, fallback: string) => {
    if (data?.code === "EMAIL_VERIFICATION_REQUIRED" && data.redirectTo) {
      router.push(data.redirectTo);
      return data.error || "Verify your email before adding services.";
    }
    if (data?.code === "SERVICE_LIMIT_REACHED" || data?.code === "SETUP_SERVICE_LIMIT_REACHED") {
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
      return data.error || "You have reached the active service limit for your plan.";
    }
    if (data?.code === "SUBSCRIPTION_REQUIRED" || data?.code === "TRIAL_EXPIRED") {
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
      return data.error || "A subscription is required to add more services.";
    }
    if (data?.code === "DUPLICATE_ACTIVE_SERVICE") {
      return data.error || "You already track this provider for that address.";
    }
    return data?.error || fallback;
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      <ServiceLimitUpsell
        open={Boolean(serviceLimit)}
        details={serviceLimit}
        onClose={() => setServiceLimit(null)}
        returnTo="/services/new"
      />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/services">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Add Services</h1>
          <p className="text-sm text-muted-foreground">
            Choose a listed provider or add a local/custom provider to create a tracked service.
          </p>
        </div>
        {serviceLimit && typeof serviceLimit.current === "number" && typeof serviceLimit.limit === "number" ? (
          <ServiceUsageIndicator current={serviceLimit.current} limit={serviceLimit.limit} />
        ) : null}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── Address Selection ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-orange-400" />
            <h2 className="font-semibold text-sm text-foreground">Select Address</h2>
          </div>
          <Link href="/addresses/new" className="text-xs text-orange-400 hover:underline">+ Add New</Link>
        </div>
        {addresses.length === 0 ? (
          <div className="rounded-2xl border border-border bg-foreground/5 p-6 text-center">
            <MapPin className="h-8 w-8 text-foreground/25 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No addresses yet.</p>
            <Link href="/addresses/new" className="text-sm text-orange-400 hover:underline mt-1 inline-block">Add your first address</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {addresses.map((a) => {
              const isActive = selectedAddress === a.id;
              const serviceCount = a.services?.length || 0;
              const TypeIcon = a.type === "WORK" ? Building2 : a.type === "VACATION" ? Star : Home;
              return (
                <button key={a.id} type="button" onClick={() => setSelectedAddress(a.id)}
                  className={`text-left p-4 rounded-xl border transition-all group ${
                    isActive
                      ? "border-orange-500/40 bg-orange-500/10 shadow-lg shadow-orange-500/10 ring-1 ring-orange-500/30"
                      : "border-foreground/[0.06] bg-foreground/[0.02] hover:border-orange-500/30 hover:bg-foreground/[0.05]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${isActive ? "bg-orange-500" : "bg-foreground/5 border border-border"}`}>
                      <TypeIcon className={`h-4 w-4 ${isActive ? "text-foreground" : "text-foreground/40"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`font-semibold text-sm truncate ${isActive ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"}`}>
                          {a.nickname || `${a.city}, ${a.state}`}
                        </p>
                        {a.isPrimary && <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                      </div>
                      <p className="text-xs text-foreground/40 truncate mt-0.5">{a.street}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-foreground/35">{a.city}, {a.state} {a.zip}</span>
                        {serviceCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-foreground/40 border border-border">
                            {serviceCount} service{serviceCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    {isActive && <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Provider section (only when address selected) ── */}
      {selectedAddress && (
        <div className="space-y-4">
          {/* Header with selected count */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Choose Listed Providers</h2>
              <p className="text-sm text-muted-foreground">
                Showing unverified directory entries for <span className="text-orange-400 font-medium">{addr?.state || "all states"}</span>
              </p>
            </div>
            {selectedCount > 0 && (
              <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-medium">
                {selectedCount} selected
              </span>
            )}
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Listed providers, manual tracking only</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-100/75">
              Listed providers are directory entries, not proof of activation at your address. Adding one creates a LocateFlow service record; it does not update your address with the provider.
            </p>
          </div>

          {/* Selected chips */}
          {selectedCount > 0 && (
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-xl border border-border bg-foreground/5 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition"
              placeholder="Search listed providers..."
              value={providerSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProviderSearch(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Add a local/custom provider</p>
                <p className="text-xs text-muted-foreground mt-1">
                  For dentists, gyms, local utilities, healthcare, and other private records. This creates a tracked service for manual follow-up only.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomProvider((value) => !value)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-200 text-xs hover:bg-cyan-500/30"
              >
                {showCustomProvider ? "Hide" : "Add local/custom"}
              </button>
            </div>
            {showCustomProvider && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <input className="rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40" placeholder="Provider name"
                  value={customProvider.name}
                  onChange={(e) => setCustomProvider((prev) => ({ ...prev, name: e.target.value }))}
                />
                <select className="rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground"
                  value={customProvider.category}
                  onChange={(e) => setCustomProvider((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {CUSTOM_PROVIDER_CATEGORY_OPTIONS.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.icon ? `${category.icon} ` : ""}{category.label}
                    </option>
                  ))}
                </select>
                <select className="rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground"
                  value={customProvider.providerType}
                  onChange={(e) => setCustomProvider((prev) => ({ ...prev, providerType: e.target.value }))}
                >
                  {["OTHER", "LOCAL_BUSINESS", "PROFESSIONAL_SERVICE", "HEALTHCARE", "LEGAL", "DENTAL", "PHYSICAL_THERAPY", "GYM"].map((type) => (
                    <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <input className="rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40" placeholder="Phone"
                  value={customProvider.phone}
                  onChange={(e) => setCustomProvider((prev) => ({ ...prev, phone: e.target.value }))}
                />
                <input className="rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40" placeholder="Website"
                  value={customProvider.website}
                  onChange={(e) => setCustomProvider((prev) => ({ ...prev, website: e.target.value }))}
                />
                <input className="rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40" placeholder="Email"
                  value={customProvider.email}
                  onChange={(e) => setCustomProvider((prev) => ({ ...prev, email: e.target.value }))}
                />
                <textarea className="sm:col-span-2 rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40" placeholder="Notes"
                  value={customProvider.notes}
                  onChange={(e) => setCustomProvider((prev) => ({ ...prev, notes: e.target.value }))}
                />
                <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">This creates a private user-added provider and a LocateFlow service record. It does not update any external account.</p>
                  <button type="button" disabled={saving} onClick={handleAddCustomProvider}
                    className="px-3 py-2 rounded-xl bg-cyan-500 text-white text-xs font-medium hover:bg-cyan-600 disabled:opacity-50">
                    {saving ? "Adding..." : "Add custom provider"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Category filter */}
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
                    !activeCategory ? "bg-orange-500 text-white" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                  }`}
                >All ({allProviders.length})</button>
                {allCategories.map((cat) => {
                  const count = allProviders.filter((p) => getMergedDisplayCategoryKey(p.category) === cat).length;
                  return (
                    <button key={cat}
                      onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        activeCategory === cat ? "bg-violet-500 text-white" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                      }`}
                    >{getMergedDisplayCategoryIcon(cat)} {getMergedDisplayCategoryLabel(cat)} ({count})</button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recommended Section (same as wizard) */}
          {!loadingProviders && !providerSearch && !activeCategory && recommended.length > 0 && (
            <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-amber-400" />
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
                          ? "border-violet-500/50 bg-violet-500/10"
                          : "border-border bg-foreground/[0.02] hover:bg-foreground/5 hover:border-border"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-orange-400" />}
                      <div className="flex items-center gap-3">
                        {provider.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={provider.logoUrl}
                            alt=""
                            className="shrink-0 w-9 h-9 rounded-lg object-contain bg-foreground/5"
                          />
                        ) : (
                          <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                            isSelected ? "bg-violet-500 text-white" : "bg-foreground/5 text-muted-foreground"
                          }`}>{provider.name.charAt(0)}</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-foreground truncate pr-6">{provider.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {provider.matchReasons?.[0] || providerCategoryLabel(provider.category)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Provider categories — accordion (same as wizard) */}
          {loadingProviders ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
              <span className="ml-2 text-muted-foreground text-sm">Loading providers...</span>
            </div>
          ) : sortedCategories.length === 0 ? (
            <div className="rounded-2xl border border-border bg-foreground/5 p-6 text-center">
              <Building2 className="mx-auto mb-3 h-9 w-9 text-foreground/40" />
              <h3 className="text-sm font-semibold text-foreground">{providerEmptyState.title}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{providerEmptyState.description}</p>
              <button
                type="button"
                onClick={() => setShowCustomProvider(true)}
                className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600"
              >
                Add local/custom provider
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedCategories.map((cat) => {
                const items = groupedProviders[cat];
                const isOpen = expandedCats.has(cat);
                const selectedInCat = items.filter((p) => selectedProviders.has(p.id)).length;
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
                        <span className="px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-medium">{selectedInCat}</span>
                      )}
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-foreground/40" /> : <ChevronDown className="h-3.5 w-3.5 text-foreground/40" />}
                    </button>
                    {isOpen && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3 pt-1">
                        {items.map((provider) => {
                          const isSelected = selectedProviders.has(provider.id);
                          return (
                            <button key={provider.id} type="button" onClick={() => toggleProvider(provider)}
                              className={`group relative text-left p-3 rounded-xl border transition-all ${
                                isSelected
                                  ? "border-orange-500/50 bg-orange-500/10"
                                  : "border-border bg-foreground/[0.02] hover:bg-foreground/5"
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-orange-400" />}
                              <div className="flex items-center gap-3">
                                {provider.logoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={provider.logoUrl}
                                    alt=""
                                    className="shrink-0 w-9 h-9 rounded-lg object-contain bg-foreground/5"
                                  />
                                ) : (
                                  <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                                    isSelected ? "bg-orange-500 text-white" : "bg-foreground/5 text-muted-foreground"
                                  }`}>{provider.name.charAt(0)}</div>
                                )}
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
                                      provider.scope === "FEDERAL" ? "bg-blue-500/20 text-blue-300" : "bg-emerald-500/20 text-emerald-300"
                                    }`}>
                                      {provider.scope === "FEDERAL" ? "Federal" : provider.states.join(", ")}
                                    </span>
                                    {provider.website && (
                                      <span className="text-[9px] text-foreground/45 flex items-center gap-0.5">
                                        <Globe className="h-2.5 w-2.5" />
                                        {provider.website.replace(/https?:\/\/(www\.)?/, "").split("/")[0]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
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

      {/* ── Floating bottom bar ── */}
      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-xl">
          <div className="mx-auto max-w-4xl space-y-3 p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {selectedCount} listed provider{selectedCount > 1 ? "s" : ""} selected
                </h3>
                <p className="text-[11px] text-foreground/55">
                  Adding creates LocateFlow service records only.
                </p>
              </div>
              <button
                onClick={handleSaveAll}
                disabled={saving || !selectedAddress}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : <><CheckCircle2 className="h-4 w-4" />Add as service{selectedCount > 1 ? "s" : ""}</>}
              </button>
            </div>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {Array.from(selectedProviders.entries()).map(([id, p]) => (
                <div key={id} className="flex min-w-0 flex-wrap items-center gap-1 rounded-lg border border-border bg-foreground/5 py-1 pl-3 pr-1">
                  <span className="max-w-[180px] truncate text-sm font-medium text-foreground/85 sm:max-w-[220px]">{p.name}</span>
                  {showBudget && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleBilling(id); }}
                      className="rounded p-1 hover:bg-foreground/5" title="Add billing details">
                      <DollarSign className={`h-3.5 w-3.5 ${billingExpanded.has(id) ? "text-orange-400" : "text-foreground/45"}`} />
                    </button>
                  )}
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedProviders((prev) => { const n = new Map(prev); n.delete(id); return n; }); }}
                    className="rounded p-1 hover:bg-red-500/10">
                    <Minus className="h-3.5 w-3.5 text-foreground/45 hover:text-red-400" />
                  </button>
                  {showBudget && billingExpanded.has(id) && (
                    <div className="flex min-w-full items-center gap-1.5 border-t border-border pt-1 sm:ml-1 sm:min-w-0 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
                      <input className="h-7 w-20 text-xs rounded-lg border border-border bg-foreground/5 px-2 text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        type="number" step="0.01" placeholder="$/mo" value={billingData[id]?.monthlyCost || ""}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBilling(id, "monthlyCost", e.target.value)} />
                      <select className="h-7 w-24 rounded-lg border border-border bg-foreground/5 px-1 text-xs text-foreground/80 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        value={billingData[id]?.billingCycle || "MONTHLY"}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateBilling(id, "billingCycle", e.target.value)}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        {BILLING_CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
