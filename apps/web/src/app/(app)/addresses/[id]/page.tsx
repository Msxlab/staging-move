"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowLeft, Home, Briefcase, Palmtree, Calendar, Edit, Zap, Star,
  Trash2, MapPin, Globe, Phone, DollarSign, ChevronRight, CheckCircle2,
  Loader2, Plus, X, Search, ExternalLink, Check, Truck,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { LoadingSpinner } from "@/components/shared/loading-state";
import { toast } from "sonner";
import { ServiceLogoMark } from "@/components/services/service-logo-mark";

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  GOVERNMENT_POSTAL: { label: "Mail & Postal", icon: "📬" }, GOVERNMENT_TAX: { label: "Tax (IRS)", icon: "🧾" },
  GOVERNMENT_DMV: { label: "DMV", icon: "🪪" }, GOVERNMENT_BENEFITS: { label: "Benefits", icon: "🏛️" },
  GOVERNMENT_VOTER: { label: "Voter Registration", icon: "🗳️" }, GOVERNMENT_ID: { label: "Passport / ID", icon: "🪪" },
  GOVERNMENT_HEALTH: { label: "Healthcare.gov", icon: "🏥" }, GOVERNMENT_EDUCATION: { label: "Education / FAFSA", icon: "🎓" },
  GOVERNMENT_IMMIGRATION: { label: "Immigration", icon: "🌍" }, GOVERNMENT_HOUSING: { label: "Housing (HUD)", icon: "🏘️" },
  GOVERNMENT_EMERGENCY: { label: "Emergency (FEMA)", icon: "🚨" }, GOVERNMENT_OTHER: { label: "Gov. Other", icon: "🏛️" },
  UTILITY_ELECTRIC: { label: "Electric", icon: "⚡" }, UTILITY_GAS: { label: "Gas", icon: "🔥" },
  UTILITY_WATER: { label: "Water", icon: "💧" }, UTILITY_INTERNET: { label: "Internet", icon: "🌐" },
  UTILITY_PHONE: { label: "Phone", icon: "📱" }, UTILITY_CABLE: { label: "Cable / TV", icon: "📺" },
  UTILITY_TRASH: { label: "Trash & Waste", icon: "🗑️" }, UTILITY_SEWER: { label: "Sewer", icon: "🚰" },
  FINANCIAL_BANK: { label: "Banks", icon: "🏦" }, FINANCIAL_CREDIT_CARD: { label: "Credit Cards", icon: "💳" },
  FINANCIAL_INSURANCE_AUTO: { label: "Auto Insurance", icon: "🚗" }, FINANCIAL_INSURANCE_HOME: { label: "Home Insurance", icon: "🏠" },
  FINANCIAL_INSURANCE_HEALTH: { label: "Health Insurance", icon: "🏥" }, FINANCIAL_MORTGAGE: { label: "Mortgage", icon: "🔑" },
  FINANCIAL_LOAN: { label: "Loans", icon: "💰" }, HOUSING_RENT: { label: "Rent / Mortgage", icon: "🏘️" },
  HOUSING_STORAGE: { label: "Storage", icon: "📦" }, HOUSING_HOA: { label: "HOA", icon: "🏢" },
  HOUSING_LAWN_CARE: { label: "Lawn Care", icon: "🌿" }, HOUSING_PEST_CONTROL: { label: "Pest Control", icon: "🐛" },
  HEALTHCARE_DOCTORS: { label: "Doctors", icon: "🩺" },
  HEALTHCARE_DENTIST: { label: "Dentist", icon: "🦷" }, HEALTHCARE_PHARMACY: { label: "Pharmacy", icon: "💊" },
  HEALTHCARE_VET: { label: "Veterinary", icon: "🐾" }, TRANSPORTATION_TOLL: { label: "Toll Pass", icon: "🛣️" },
  TRANSPORTATION_TRANSIT: { label: "Transit", icon: "🚌" }, KIDS_SCHOOL: { label: "Schools", icon: "🏫" },
  KIDS_DAYCARE: { label: "Daycare", icon: "👶" }, FITNESS_GYM: { label: "Fitness & Gym", icon: "💪" },
  SHOPPING_SUBSCRIPTION: { label: "Subscriptions", icon: "📦" }, SHOPPING_RETAIL: { label: "Shopping", icon: "🛒" },
};

const typeIcons: Record<string, React.ElementType> = { HOME: Home, WORK: Briefcase, VACATION: Palmtree };

interface ServiceItem {
  id: string; providerName: string; category: string; monthlyCost: number;
  website?: string | null; phone?: string | null; isActive?: boolean;
  billingCycle?: string | null; billingDay?: number | null; accountNumber?: string | null;
  provider?: { id?: string; name?: string | null; logoUrl?: string | null } | null;
  customProvider?: { id?: string; name?: string | null } | null;
  providerLogoUrl?: string | null;
  logoUrl?: string | null;
}

interface AddressDetail {
  id: string; type: string; nickname?: string; street: string; street2?: string;
  city: string; state: string; zip: string; isPrimary: boolean; ownership: string;
  startDate: string; services: ServiceItem[];
}

function serviceRemoveErrorMessage(data: any, fallback: string): string {
  switch (data?.code) {
    case "UNAUTHORIZED":
      return data?.error || "Please sign in again.";
    case "EMAIL_VERIFICATION_REQUIRED":
      return data?.error || "Please verify your email to manage services.";
    case "FORBIDDEN":
      return data?.error || "You don't have permission to remove this service.";
    case "NOT_FOUND":
      return data?.error || "Service not found.";
    case "INVALID_CONTENT_TYPE":
      return "Could not remove this service. Please refresh and try again.";
    default:
      return data?.error || fallback;
  }
}

export default function AddressDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("addresses");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("toast");
  const locale = useLocale();
  const id = params.id as string;
  const [address, setAddress] = useState<AddressDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editingCostValue, setEditingCostValue] = useState("");
  const [savingCostId, setSavingCostId] = useState<string | null>(null);
  const [deletingSvcId, setDeletingSvcId] = useState<string | null>(null);
  const [deleteSvcConfirm, setDeleteSvcConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/addresses/${id}`)
      .then((res) => { if (!res.ok) throw new Error("Not found"); return res.json(); })
      .then((data) => setAddress(data.address))
      .catch(() => router.push("/addresses"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/addresses/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({}),
    });
    if (res.ok) { toast.success(tToast("deleted")); router.push("/addresses"); }
    else { toast.error(tToast("deleteFailed")); setDeleting(false); }
  };

  const handleBulkDelete = async () => {
    if (bulkSelected.size === 0) return;
    setDeletingBulk(true);
    const removedIds = new Set<string>();
    let firstError: string | null = null;
    for (const sid of bulkSelected) {
      try {
        const res = await fetch(`/api/services/${sid}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({}),
        });
        if (res.ok) removedIds.add(sid);
        else {
          const data = await res.json().catch(() => ({}));
          firstError ||= serviceRemoveErrorMessage(data, tToast("serviceRemoveFailed"));
          if (data?.code === "UNAUTHORIZED") {
            router.push(`/sign-in?redirect=${encodeURIComponent(`/addresses/${id}`)}`);
            break;
          }
          if (data?.code === "EMAIL_VERIFICATION_REQUIRED") {
            router.push(data.redirectTo || `/verify-email?redirect=${encodeURIComponent(`/addresses/${id}`)}`);
            break;
          }
        }
      } catch { /* skip */ }
    }
    if (address && removedIds.size > 0) {
      setAddress({ ...address, services: address.services.filter((s) => !removedIds.has(s.id)) });
    }
    setBulkSelected(new Set());
    setBulkMode(false);
    setDeletingBulk(false);
    if (removedIds.size > 0) toast.success(tToast("servicesRemoved", { count: removedIds.size }));
    const failedCount = bulkSelected.size - removedIds.size;
    if (failedCount > 0 && !firstError) {
      firstError = `${failedCount} service${failedCount === 1 ? "" : "s"} could not be removed. Please try again.`;
    }
    if (firstError) toast.error(firstError);
  };

  const toggleBulk = (sid: string) => {
    setBulkSelected((prev) => {
      const n = new Set(prev);
      if (n.has(sid)) n.delete(sid); else n.add(sid);
      return n;
    });
  };

  const startEditCost = (svc: ServiceItem) => {
    setEditingCostId(svc.id);
    setEditingCostValue(String(svc.monthlyCost || 0));
  };

  const saveCost = async (sid: string) => {
    const val = parseFloat(editingCostValue);
    if (isNaN(val) || val < 0) { toast.error(tToast("invalidCost")); return; }
    setSavingCostId(sid);
    try {
      const res = await fetch(`/api/services/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyCost: val }),
      });
      if (!res.ok) throw new Error();
      if (address) {
        setAddress({
          ...address,
          services: address.services.map((s) => s.id === sid ? { ...s, monthlyCost: val } : s),
        });
      }
      toast.success(tToast("costUpdated"));
    } catch {
      toast.error(tToast("costUpdateFailed"));
    }
    setSavingCostId(null);
    setEditingCostId(null);
  };

  const handleSingleDelete = async (sid: string) => {
    if (deleteSvcConfirm !== sid) { setDeleteSvcConfirm(sid); return; }
    setDeletingSvcId(sid);
    try {
      const res = await fetch(`/api/services/${sid}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.code === "EMAIL_VERIFICATION_REQUIRED") {
          router.push(data.redirectTo || `/verify-email?redirect=${encodeURIComponent(`/addresses/${id}`)}`);
          return;
        }
        if (data?.code === "UNAUTHORIZED") {
          router.push(`/sign-in?redirect=${encodeURIComponent(`/addresses/${id}`)}`);
          return;
        }
        throw new Error(serviceRemoveErrorMessage(data, tToast("serviceRemoveFailed")));
      }
      if (address) {
        setAddress({ ...address, services: address.services.filter((s) => s.id !== sid) });
      }
      toast.success(tToast("serviceRemoved"));
    } catch (error: any) {
      toast.error(error?.message || tToast("serviceRemoveFailed"));
    }
    setDeletingSvcId(null);
    setDeleteSvcConfirm(null);
  };

  if (loading || !address) return <LoadingSpinner />;

  const TypeIcon = typeIcons[address.type] || MapPin;
  const totalMonthlyCost = address.services.reduce((sum, s) => sum + (s.monthlyCost || 0), 0);

  // Group services by category prefix
  const grouped: Record<string, ServiceItem[]> = {};
  const filteredServices = serviceSearch
    ? address.services.filter((s) => s.providerName.toLowerCase().includes(serviceSearch.toLowerCase()))
    : address.services;
  for (const s of filteredServices) {
    const prefix = s.category.split("_")[0];
    if (!grouped[prefix]) grouped[prefix] = [];
    grouped[prefix].push(s);
  }
  const groupOrder = ["GOVERNMENT", "UTILITY", "FINANCIAL", "HOUSING", "HEALTHCARE", "TRANSPORTATION", "KIDS", "FITNESS", "SHOPPING", "OTHER"];
  const sortedGroups = Object.keys(grouped).sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b));

  const groupLabels: Record<string, string> = {
    GOVERNMENT: t("detail_group_government"),
    UTILITY: t("detail_group_utility"),
    FINANCIAL: t("detail_group_financial"),
    HOUSING: t("detail_group_housing"),
    HEALTHCARE: t("detail_group_healthcare"),
    TRANSPORTATION: t("detail_group_transportation"),
    KIDS: t("detail_group_kids"),
    FITNESS: t("detail_group_fitness"),
    SHOPPING: t("detail_group_shopping"),
  };
  const groupIcons: Record<string, string> = {
    GOVERNMENT: "🏛️", UTILITY: "⚡", FINANCIAL: "💳", HOUSING: "🏠", HEALTHCARE: "🏥",
    TRANSPORTATION: "🚗", KIDS: "👶", FITNESS: "💪", SHOPPING: "🛒",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/addresses">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
            <ArrowLeft className="h-4 w-4" />{tCommon("back")}
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{address.nickname || t("detail_defaultName")}</h1>
            {address.isPrimary && <Star className="h-4 w-4 text-tone-honey-fg fill-amber-400" />}
          </div>
          <p className="text-sm text-muted-foreground">{address.street}, {address.city}, {address.state} {address.zip}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/moving/new?from=${address.id}`}>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:bg-tone-orange-bg transition">
              <Truck className="h-3.5 w-3.5" />{t("detail_moveFromHere")}
            </button>
          </Link>
          <Link href={`/addresses/${address.id}/edit`}>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
              <Edit className="h-3.5 w-3.5" />{tCommon("edit")}
            </button>
          </Link>
        </div>
      </div>

      {/* Address Info Card */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-tone-orange-bg border border-tone-orange-br">
            <TypeIcon className="h-6 w-6 text-tone-orange-fg" />
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider">{t("detail_label_type")}</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{address.type}</p>
            </div>
            <div>
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider">{t("detail_label_ownership")}</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  address.ownership === "OWNER" ? "bg-tone-emerald-bg text-tone-emerald-fg border border-tone-emerald-br" : "bg-tone-cyan-bg text-tone-cyan-fg border border-tone-cyan-br"
                }`}>{address.ownership === "OWNER" ? t("detail_owner") : t("detail_renter")}</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider">{t("detail_label_moveIn")}</p>
              <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-foreground/40" />
                {new Date(address.startDate).toLocaleDateString(locale === "es" ? "es-US" : "en-US", { month: "short", year: "numeric" })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider">{t("detail_label_monthlyCost")}</p>
              <p className="text-sm font-bold text-tone-emerald-fg mt-0.5">
                <DollarSign className="h-3 w-3 inline" />{totalMonthlyCost.toLocaleString()}{t("detail_perMo")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-tone-orange-fg" />
            <h2 className="text-lg font-semibold text-foreground">{t("detail_servicesTitle")}</h2>
            <span className="text-xs text-foreground/40">({address.services.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {address.services.length > 0 && (
              <button
                onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  bulkMode ? "bg-destructive/10 text-destructive border border-destructive" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >{bulkMode ? tCommon("cancel") : t("detail_bulkEdit")}</button>
            )}
            <Link href="/services/new">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:bg-tone-orange-bg transition">
                <Plus className="h-3 w-3" />{t("detail_addService")}
              </button>
            </Link>
          </div>
        </div>

        {/* Bulk action bar */}
        {bulkMode && bulkSelected.size > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive">
            <span className="text-sm text-destructive">{t("detail_selectedCount", { count: bulkSelected.size })}</span>
            <button
              onClick={handleBulkDelete}
              disabled={deletingBulk}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive text-white text-xs font-medium hover:bg-destructive/80 transition disabled:opacity-50"
            >
              {deletingBulk ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              {t("detail_deleteSelected")}
            </button>
          </div>
        )}

        {/* Search services */}
        {address.services.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <input
              placeholder={t("detail_searchPlaceholder")}
              className="w-full rounded-xl border border-border bg-foreground/5 pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
            />
          </div>
        )}

        {/* Services grouped by category */}
        {address.services.length === 0 ? (
          <div className="rounded-2xl border border-border bg-foreground/5 p-8 text-center">
            <Zap className="h-8 w-8 text-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("detail_noServices")}</p>
            <Link href="/services/new" className="text-sm text-tone-orange-fg hover:underline mt-1 inline-block">{t("detail_noServicesCta")}</Link>
          </div>
        ) : sortedGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("detail_noMatch")}</p>
        ) : (
          <div className="space-y-3">
            {sortedGroups.map((prefix) => {
              const items = grouped[prefix];
              return (
                <div key={prefix} className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-base">{groupIcons[prefix] || "📋"}</span>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{groupLabels[prefix] || prefix}</h3>
                    <span className="text-[10px] text-foreground/30">{items.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((service) => {
                      const meta = CATEGORY_META[service.category];
                      const isChecked = bulkSelected.has(service.id);
                      const isEditingCost = editingCostId === service.id;
                      const isSavingCost = savingCostId === service.id;
                      const isConfirmDel = deleteSvcConfirm === service.id;
                      const isDeletingSvc = deletingSvcId === service.id;
                      return (
                        <div
                          key={service.id}
                          className={`group rounded-xl border p-3.5 transition-all ${
                            isChecked ? "border-destructive/30 bg-destructive/5" : "border-border bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-border"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {bulkMode && (
                              <button onClick={() => toggleBulk(service.id)} className="shrink-0">
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                                  isChecked ? "border-destructive bg-destructive" : "border-foreground/20 bg-foreground/5"
                                }`}>
                                  {isChecked && <CheckCircle2 className="h-3 w-3 text-foreground" />}
                                </div>
                              </button>
                            )}
                            <ServiceLogoMark service={service} className="w-9 h-9 rounded-lg" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm text-foreground truncate">{service.providerName}</p>
                                {!bulkMode && (
                                  <Link href={`/services/${service.id}`}>
                                    <ChevronRight className="h-3.5 w-3.5 text-foreground/30 opacity-0 group-hover:opacity-100 transition shrink-0" />
                                  </Link>
                                )}
                              </div>
                              <p className="text-[11px] text-foreground/35">{meta?.label || service.category.replace(/_/g, " ")}</p>
                            </div>
                            <div className="text-right shrink-0 flex items-center gap-2">
                              {/* Inline cost edit */}
                              {isEditingCost ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-foreground/40 text-xs">$</span>
                                  <input
                                    autoFocus
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-20 rounded-lg border border-tone-orange-br bg-foreground/5 px-2 py-1 text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    value={editingCostValue}
                                    onChange={(e) => setEditingCostValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") saveCost(service.id); if (e.key === "Escape") setEditingCostId(null); }}
                                  />
                                  <button onClick={() => saveCost(service.id)} disabled={isSavingCost}
                                    className="p-1 rounded-md bg-tone-orange-fg text-white hover:bg-tone-orange-bg transition disabled:opacity-50">
                                    {isSavingCost ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  </button>
                                  <button onClick={() => setEditingCostId(null)} className="p-1 rounded-md text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEditCost(service)}
                                  className="text-right group/cost"
                                  title={t("detail_editCostTitle")}
                                >
                                  {(service.monthlyCost || 0) > 0 ? (
                                    <p className="text-sm font-semibold text-foreground/80 group-hover/cost:text-tone-orange-fg transition">
                                      {formatCurrency(service.monthlyCost)}<span className="text-foreground/40">{t("detail_perMo")}</span>
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-foreground/30 group-hover/cost:text-tone-orange-fg transition flex items-center gap-0.5">
                                      <DollarSign className="h-3 w-3" />{t("detail_setCost")}
                                    </p>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Quick actions row */}
                          {!bulkMode && (
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-foreground/[0.03] opacity-0 group-hover:opacity-100 transition-opacity">
                              {service.website && (
                                <a href={service.website.startsWith("http") ? service.website : `https://${service.website}`} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition">
                                  <ExternalLink className="h-2.5 w-2.5" />
                                  {service.website.replace(/https?:\/\/(www\.)?/, "").split("/")[0]}
                                </a>
                              )}
                              <Link href={`/services/${service.id}`}>
                                <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-foreground/40 hover:text-tone-orange-fg hover:bg-tone-orange-bg transition">
                                  <Edit className="h-2.5 w-2.5" />Edit
                                </button>
                              </Link>
                              <div className="flex-1" />
                              {!isConfirmDel ? (
                                <button onClick={() => handleSingleDelete(service.id)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-foreground/25 hover:text-destructive hover:bg-destructive/10 transition">
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleSingleDelete(service.id)} disabled={isDeletingSvc}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-destructive text-white hover:bg-destructive/80 transition disabled:opacity-50">
                                    {isDeletingSvc ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
                                    Remove
                                  </button>
                                  <button onClick={() => setDeleteSvcConfirm(null)}
                                    className="px-2 py-1 rounded-md text-[10px] text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition">
                                    {tCommon("cancel")}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Total */}
        {address.services.length > 0 && (
          <div className="flex items-center justify-between px-2 pt-2 border-t border-border">
            <span className="text-sm font-medium text-muted-foreground">{t("detail_totalMonthly")}</span>
            <span className="text-lg font-bold text-tone-emerald-fg">{formatCurrency(totalMonthlyCost)}{t("detail_perMo")}</span>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-destructive/10 bg-destructive/[0.02] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-destructive">{t("detail_dangerZone")}</h3>
        <p className="text-xs text-foreground/40">{t("detail_dangerDescription", { count: address.services.length })}</p>
        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-1.5 rounded-xl border border-destructive text-destructive text-xs font-medium hover:bg-destructive/10 transition">
            {t("detail_deleteAddressBtn")}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive text-white text-xs font-medium hover:bg-destructive/80 transition disabled:opacity-50">
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              {t("detail_confirmDelete")}
            </button>
            <button onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-xl border border-border text-muted-foreground text-xs hover:text-foreground hover:bg-foreground/5 transition">
              {tCommon("cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
