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
  groupByMergedDisplayCategory,
} from "@/lib/recommendation-engine";
import type { ScoredProvider } from "@/lib/recommendation-engine";

const BILLING_CYCLES = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "ONE_TIME", label: "One-time" },
];

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

  // Billing expansion per provider
  const [billingExpanded, setBillingExpanded] = useState<Set<string>>(new Set());
  const [billingData, setBillingData] = useState<Record<string, {
    monthlyCost: string; billingCycle: string; accountNumber: string;
    billingDay: string; notes: string;
  }>>({});

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
        if (res.ok) success++; else failed++;
      } catch { failed++; }
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
      setError(`${failed} service${failed > 1 ? "s" : ""} failed to save.`);
    }
  };

  const selectedCount = selectedProviders.size;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/services">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Add Services</h1>
          <p className="text-sm text-white/40">Select providers and register them to your address</p>
        </div>
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
            <h2 className="font-semibold text-sm text-white">Select Address</h2>
          </div>
          <Link href="/addresses/new" className="text-xs text-orange-400 hover:underline">+ Add New</Link>
        </div>
        {addresses.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <MapPin className="h-8 w-8 text-white/15 mx-auto mb-2" />
            <p className="text-sm text-white/40">No addresses yet.</p>
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
                      : "border-white/[0.06] bg-white/[0.02] hover:border-orange-500/30 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${isActive ? "bg-orange-500" : "bg-white/5 border border-white/10"}`}>
                      <TypeIcon className={`h-4 w-4 ${isActive ? "text-white" : "text-white/30"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`font-semibold text-sm truncate ${isActive ? "text-white" : "text-white/70 group-hover:text-white"}`}>
                          {a.nickname || `${a.city}, ${a.state}`}
                        </p>
                        {a.isPrimary && <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                      </div>
                      <p className="text-xs text-white/30 truncate mt-0.5">{a.street}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-white/25">{a.city}, {a.state} {a.zip}</span>
                        {serviceCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10">
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
              <h2 className="text-lg font-semibold text-white">Choose Your Providers</h2>
              <p className="text-sm text-white/40">
                Showing for <span className="text-orange-400 font-medium">{addr?.state || "all states"}</span>
              </p>
            </div>
            {selectedCount > 0 && (
              <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-medium">
                {selectedCount} selected
              </span>
            )}
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition"
              placeholder="Search providers..."
              value={providerSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProviderSearch(e.target.value)}
            />
          </div>

          {/* Category filter */}
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
                >All ({allProviders.length})</button>
                {allCategories.map((cat) => {
                  const count = allProviders.filter((p) => getMergedDisplayCategoryKey(p.category) === cat).length;
                  return (
                    <button key={cat}
                      onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        activeCategory === cat ? "bg-violet-500 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                      }`}
                    >{getMergedDisplayCategoryIcon(cat)} {getMergedDisplayCategoryLabel(cat)} ({count})</button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recommended Section (same as wizard) */}
          {!loadingProviders && !providerSearch && !activeCategory && recommended.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
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
                          ? "border-violet-500/50 bg-violet-500/10"
                          : "border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-orange-400" />}
                      <div className="flex items-center gap-3">
                        {provider.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={provider.logoUrl}
                            alt=""
                            className="shrink-0 w-9 h-9 rounded-lg object-contain bg-white/5"
                          />
                        ) : (
                          <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                            isSelected ? "bg-violet-500 text-white" : "bg-white/5 text-white/60"
                          }`}>{provider.name.charAt(0)}</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-white truncate pr-6">{provider.name}</p>
                          <p className="text-[11px] text-white/40 truncate">
                            {provider.matchReasons?.[0] || getMergedDisplayCategoryLabel(provider.category)}
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
              <span className="ml-2 text-white/40 text-sm">Loading providers...</span>
            </div>
          ) : sortedCategories.length === 0 ? (
            <div className="text-center py-12 text-white/40 text-sm">No providers found.</div>
          ) : (
            <div className="space-y-2">
              {sortedCategories.map((cat) => {
                const items = groupedProviders[cat];
                const isOpen = expandedCats.has(cat);
                const selectedInCat = items.filter((p) => selectedProviders.has(p.id)).length;
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
                        <span className="px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-medium">{selectedInCat}</span>
                      )}
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
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
                                  : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="absolute top-2.5 right-2.5 h-4 w-4 text-orange-400" />}
                              <div className="flex items-center gap-3">
                                {provider.logoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={provider.logoUrl}
                                    alt=""
                                    className="shrink-0 w-9 h-9 rounded-lg object-contain bg-white/5"
                                  />
                                ) : (
                                  <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                                    isSelected ? "bg-orange-500 text-white" : "bg-white/5 text-white/50"
                                  }`}>{provider.name.charAt(0)}</div>
                                )}
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
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a1a]/90 backdrop-blur-xl border-t border-white/10 shadow-2xl">
          <div className="max-w-4xl mx-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-white">{selectedCount} provider{selectedCount > 1 ? "s" : ""} selected</h3>
              <button
                onClick={handleSaveAll}
                disabled={saving || !selectedAddress}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : <><CheckCircle2 className="h-4 w-4" />Register {selectedCount > 1 ? "All" : ""}</>}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {Array.from(selectedProviders.entries()).map(([id, p]) => (
                <div key={id} className="flex items-center gap-0 bg-white/5 border border-white/10 rounded-lg pl-3 pr-1 py-1">
                  <span className="text-sm font-medium truncate max-w-[200px] text-white/80">{p.name}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleBilling(id); }}
                    className="p-1 hover:bg-white/5 rounded ml-1" title="Add billing details">
                    <DollarSign className={`h-3.5 w-3.5 ${billingExpanded.has(id) ? "text-orange-400" : "text-white/30"}`} />
                  </button>
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedProviders((prev) => { const n = new Map(prev); n.delete(id); return n; }); }}
                    className="p-1 hover:bg-red-500/10 rounded">
                    <Minus className="h-3.5 w-3.5 text-white/30 hover:text-red-400" />
                  </button>
                  {billingExpanded.has(id) && (
                    <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-2">
                      <input className="h-7 w-20 text-xs rounded-lg border border-white/10 bg-white/5 px-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                        type="number" step="0.01" placeholder="$/mo" value={billingData[id]?.monthlyCost || ""}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBilling(id, "monthlyCost", e.target.value)} />
                      <select className="h-7 text-xs w-24 rounded-lg border border-white/10 bg-white/5 px-1 text-white/60 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
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
