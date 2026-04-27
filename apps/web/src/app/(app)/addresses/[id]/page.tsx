"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft, Home, Briefcase, Palmtree, Calendar, Edit, Zap, Star,
  Trash2, MapPin, Globe, Phone, DollarSign, ChevronRight, CheckCircle2,
  Loader2, Plus, X, Search, ExternalLink, Check, Truck,
} from "lucide-react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/lib/utils";
import { LoadingSpinner } from "@/components/shared/loading-state";
import { toast } from "sonner";

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
}

interface AddressDetail {
  id: string; type: string; nickname?: string; street: string; street2?: string;
  city: string; state: string; zip: string; isPrimary: boolean; ownership: string;
  startDate: string; services: ServiceItem[];
}

export default function AddressDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tToast = useTranslations("toast");
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
    const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success(tToast("deleted")); router.push("/addresses"); }
    else { toast.error(tToast("deleteFailed")); setDeleting(false); }
  };

  const handleBulkDelete = async () => {
    if (bulkSelected.size === 0) return;
    setDeletingBulk(true);
    let deleted = 0;
    for (const sid of bulkSelected) {
      try {
        const res = await fetch(`/api/services/${sid}`, { method: "DELETE" });
        if (res.ok) deleted++;
      } catch { /* skip */ }
    }
    if (address) {
      setAddress({ ...address, services: address.services.filter((s) => !bulkSelected.has(s.id)) });
    }
    setBulkSelected(new Set());
    setBulkMode(false);
    setDeletingBulk(false);
    toast.success(tToast("servicesRemoved", { count: deleted }));
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
      const res = await fetch(`/api/services/${sid}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      if (address) {
        setAddress({ ...address, services: address.services.filter((s) => s.id !== sid) });
      }
      toast.success(tToast("serviceRemoved"));
    } catch {
      toast.error(tToast("serviceRemoveFailed"));
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
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition">
            <ArrowLeft className="h-4 w-4" />{tCommon("back")}
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{address.nickname || t("detail_defaultName")}</h1>
            {address.isPrimary && <Star className="h-4 w-4 text-amber-400 fill-amber-400" />}
          </div>
          <p className="text-sm text-white/40">{address.street}, {address.city}, {address.state} {address.zip}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/moving/new?from=${address.id}`}>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition">
              <Truck className="h-3.5 w-3.5" />{t("detail_moveFromHere")}
            </button>
          </Link>
          <Link href={`/addresses/${address.id}/edit`}>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/5 transition">
              <Edit className="h-3.5 w-3.5" />{tCommon("edit")}
            </button>
          </Link>
        </div>
      </div>

      {/* Address Info Card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <TypeIcon className="h-6 w-6 text-orange-400" />
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">{t("detail_label_type")}</p>
              <p className="text-sm font-medium text-white mt-0.5">{address.type}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">{t("detail_label_ownership")}</p>
              <p className="text-sm font-medium text-white mt-0.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  address.ownership === "OWNER" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                }`}>{address.ownership === "OWNER" ? t("detail_owner") : t("detail_renter")}</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">{t("detail_label_moveIn")}</p>
              <p className="text-sm font-medium text-white mt-0.5 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-white/30" />
                {new Date(address.startDate).toLocaleDateString(locale === "es" ? "es-US" : "en-US", { month: "short", year: "numeric" })}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">{t("detail_label_monthlyCost")}</p>
              <p className="text-sm font-bold text-emerald-400 mt-0.5">
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
            <Zap className="h-4 w-4 text-orange-400" />
            <h2 className="text-lg font-semibold text-white">{t("detail_servicesTitle")}</h2>
            <span className="text-xs text-white/30">({address.services.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {address.services.length > 0 && (
              <button
                onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  bulkMode ? "bg-red-500/10 text-red-400 border border-red-500/20" : "text-white/40 hover:text-white hover:bg-white/5"
                }`}
              >{bulkMode ? tCommon("cancel") : t("detail_bulkEdit")}</button>
            )}
            <Link href="/services/new">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition">
                <Plus className="h-3 w-3" />{t("detail_addService")}
              </button>
            </Link>
          </div>
        </div>

        {/* Bulk action bar */}
        {bulkMode && bulkSelected.size > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/20">
            <span className="text-sm text-red-400">{t("detail_selectedCount", { count: bulkSelected.size })}</span>
            <button
              onClick={handleBulkDelete}
              disabled={deletingBulk}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition disabled:opacity-50"
            >
              {deletingBulk ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              {t("detail_deleteSelected")}
            </button>
          </div>
        )}

        {/* Search services */}
        {address.services.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              placeholder={t("detail_searchPlaceholder")}
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
            />
          </div>
        )}

        {/* Services grouped by category */}
        {address.services.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <Zap className="h-8 w-8 text-white/10 mx-auto mb-2" />
            <p className="text-sm text-white/40">{t("detail_noServices")}</p>
            <Link href="/services/new" className="text-sm text-orange-400 hover:underline mt-1 inline-block">{t("detail_noServicesCta")}</Link>
          </div>
        ) : sortedGroups.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-4">{t("detail_noMatch")}</p>
        ) : (
          <div className="space-y-3">
            {sortedGroups.map((prefix) => {
              const items = grouped[prefix];
              return (
                <div key={prefix} className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-base">{groupIcons[prefix] || "📋"}</span>
                    <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide">{groupLabels[prefix] || prefix}</h3>
                    <span className="text-[10px] text-white/20">{items.length}</span>
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
                            isChecked ? "border-red-500/30 bg-red-500/5" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {bulkMode && (
                              <button onClick={() => toggleBulk(service.id)} className="shrink-0">
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                                  isChecked ? "border-red-500 bg-red-500" : "border-white/20 bg-white/5"
                                }`}>
                                  {isChecked && <CheckCircle2 className="h-3 w-3 text-white" />}
                                </div>
                              </button>
                            )}
                            <div className="shrink-0 w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-sm">
                              {meta?.icon || "📋"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm text-white truncate">{service.providerName}</p>
                                {!bulkMode && (
                                  <Link href={`/services/${service.id}`}>
                                    <ChevronRight className="h-3.5 w-3.5 text-white/20 opacity-0 group-hover:opacity-100 transition shrink-0" />
                                  </Link>
                                )}
                              </div>
                              <p className="text-[11px] text-white/35">{meta?.label || service.category.replace(/_/g, " ")}</p>
                            </div>
                            <div className="text-right shrink-0 flex items-center gap-2">
                              {/* Inline cost edit */}
                              {isEditingCost ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-white/30 text-xs">$</span>
                                  <input
                                    autoFocus
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-20 rounded-lg border border-orange-500/30 bg-white/5 px-2 py-1 text-sm text-white text-right focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                                    value={editingCostValue}
                                    onChange={(e) => setEditingCostValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") saveCost(service.id); if (e.key === "Escape") setEditingCostId(null); }}
                                  />
                                  <button onClick={() => saveCost(service.id)} disabled={isSavingCost}
                                    className="p-1 rounded-md bg-orange-500 text-white hover:bg-orange-600 transition disabled:opacity-50">
                                    {isSavingCost ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  </button>
                                  <button onClick={() => setEditingCostId(null)} className="p-1 rounded-md text-white/30 hover:text-white hover:bg-white/5 transition">
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
                                    <p className="text-sm font-semibold text-white/70 group-hover/cost:text-orange-400 transition">
                                      {formatCurrency(service.monthlyCost)}<span className="text-white/30">{t("detail_perMo")}</span>
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-white/20 group-hover/cost:text-orange-400 transition flex items-center gap-0.5">
                                      <DollarSign className="h-3 w-3" />{t("detail_setCost")}
                                    </p>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Quick actions row */}
                          {!bulkMode && (
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity">
                              {service.website && (
                                <a href={service.website.startsWith("http") ? service.website : `https://${service.website}`} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-white/30 hover:text-white hover:bg-white/5 transition">
                                  <ExternalLink className="h-2.5 w-2.5" />
                                  {service.website.replace(/https?:\/\/(www\.)?/, "").split("/")[0]}
                                </a>
                              )}
                              <Link href={`/services/${service.id}`}>
                                <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-white/30 hover:text-orange-400 hover:bg-orange-500/10 transition">
                                  <Edit className="h-2.5 w-2.5" />Edit
                                </button>
                              </Link>
                              <div className="flex-1" />
                              {!isConfirmDel ? (
                                <button onClick={() => handleSingleDelete(service.id)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-white/15 hover:text-red-400 hover:bg-red-500/10 transition">
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleSingleDelete(service.id)} disabled={isDeletingSvc}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50">
                                    {isDeletingSvc ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
                                    {tCommon("delete")}
                                  </button>
                                  <button onClick={() => setDeleteSvcConfirm(null)}
                                    className="px-2 py-1 rounded-md text-[10px] text-white/30 hover:text-white hover:bg-white/5 transition">
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
          <div className="flex items-center justify-between px-2 pt-2 border-t border-white/5">
            <span className="text-sm font-medium text-white/50">{t("detail_totalMonthly")}</span>
            <span className="text-lg font-bold text-emerald-400">{formatCurrency(totalMonthlyCost)}{t("detail_perMo")}</span>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.02] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-red-400">{t("detail_dangerZone")}</h3>
        <p className="text-xs text-white/30">{t("detail_dangerDescription", { count: address.services.length })}</p>
        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-1.5 rounded-xl border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition">
            {t("detail_deleteAddressBtn")}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition disabled:opacity-50">
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              {t("detail_confirmDelete")}
            </button>
            <button onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-xl border border-white/10 text-white/40 text-xs hover:text-white hover:bg-white/5 transition">
              {tCommon("cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
