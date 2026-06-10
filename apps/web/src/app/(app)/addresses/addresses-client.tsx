"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Home, Briefcase, Palmtree, Star, Edit, Trash2, Zap, Eye, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { RaccoonReading } from "@/components/illustrations/RaccoonReading";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { monthlyAmountForCycle } from "@/lib/budget-planning";

const typeIcons: Record<string, React.ElementType> = {
  HOME: Home,
  WORK: Briefcase,
  VACATION: Palmtree,
};

export interface AddressItem {
  id: string;
  type: string;
  nickname?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isPrimary: boolean;
  ownership: string;
  startDate: string;
  services?: { id: string; monthlyCost?: number; billingCycle?: string | null }[];
}

export function AddressesClient({ initial }: { initial: AddressItem[] }) {
  const router = useRouter();
  const t = useTranslations("addresses");
  const tCommon = useTranslations("common");
  const tEmpty = useTranslations("empty");
  const tToast = useTranslations("toast");
  const tServices = useTranslations("services");
  const locale = useLocale();
  const [addresses, setAddresses] = useState<AddressItem[]>(initial);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        toast.success(tToast("deleted"));
      } else {
        toast.error(tToast("deleteFailed"));
      }
    } catch {
      toast.error(tToast("deleteFailed"));
    }
    setDeletingId(null);
    setDeleteConfirm(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm(null);
  };

  // Normalize each service's per-cycle cost to its true monthly value so a
  // yearly/quarterly service isn't counted as if it were billed every month
  // (ONE_TIME → 0). Mirrors the budget engine; keeps this figure consistent
  // with /budget instead of inflating it.
  const totalMonthly = addresses.reduce(
    (sum, a) =>
      sum + (a.services?.reduce((s: number, sv: any) => s + monthlyAmountForCycle(sv.monthlyCost || 0, sv.billingCycle), 0) || 0),
    0,
  );
  const totalServices = addresses.reduce((sum, a) => sum + (a.services?.length || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">
            {addresses.length} · {totalServices} · {
              new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(totalMonthly)
            }
          </p>
        </div>
        <Link href="/addresses/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:opacity-90 transition">
            <Plus className="h-4 w-4" /> {t("newTitle")}
          </button>
        </Link>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          illustration={<RaccoonReading size={148} className="text-foreground/45" />}
          title={tEmpty("addresses")}
          description={tEmpty("addressesDescription")}
          actionLabel={tEmpty("addAddress")}
          actionHref="/addresses/new"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => {
            const TypeIcon = typeIcons[address.type] || MapPin;
            const servicesCount = address.services?.length || 0;
            const monthlyCost = address.services?.reduce((sum: number, s: any) => sum + monthlyAmountForCycle(s.monthlyCost || 0, s.billingCycle), 0) || 0;
            const isDeleting = deletingId === address.id;
            const isConfirming = deleteConfirm === address.id;

            return (
              <div
                key={address.id}
                className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5 hover:bg-foreground/[0.07] transition-all cursor-pointer group relative"
                onClick={() => router.push(`/addresses/${address.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-tone-orange-bg border border-tone-orange-br group-hover:bg-tone-orange-fg group-hover:border-tone-orange-br transition-colors">
                      <TypeIcon className="h-5 w-5 text-tone-orange-fg group-hover:text-foreground transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                        {address.nickname || t("title")}
                        {address.isPrimary && <Star className="h-3.5 w-3.5 text-tone-honey-fg fill-warning" />}
                      </h3>
                      <p className="text-sm text-foreground/35">
                        {address.street}, {address.city}, {address.state} {address.zip}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${
                      address.ownership === "OWNER"
                        ? "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br"
                        : "bg-tone-cyan-bg text-tone-cyan-fg border-tone-cyan-br"
                    }`}
                  >
                    {address.ownership === "OWNER" ? t("ownership_owner") : t("ownership_renter")}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm border-t border-border pt-3 mb-3">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground/80">{servicesCount}</span>
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-tone-emerald-fg">
                        {new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(monthlyCost)}
                      </span>
                    </span>
                  </div>
                  <span className="text-xs text-foreground/35">
                    {new Date(address.startDate).toLocaleDateString(locale, { month: "short", year: "numeric" })}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => router.push(`/addresses/${address.id}`)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition"
                  >
                    <Eye className="h-3 w-3" />{tCommon("details")}
                  </button>
                  <button
                    onClick={() => router.push(`/addresses/${address.id}/edit`)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-tone-orange-fg hover:bg-tone-orange-bg transition"
                  >
                    <Edit className="h-3 w-3" />{tCommon("edit")}
                  </button>
                  <button
                    onClick={() => router.push(`/services/new`)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-tone-emerald-fg hover:bg-tone-emerald-bg transition"
                  >
                    <Zap className="h-3 w-3" />{tServices("newTitle")}
                  </button>

                  <div className="flex-1" />

                  {!isConfirming ? (
                    <button
                      onClick={(e) => handleDelete(address.id, e)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-foreground/30 hover:text-destructive hover:bg-destructive/10 transition"
                      aria-label={t("deleteAddress")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleDelete(address.id, e)}
                        disabled={isDeleting}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-destructive text-white hover:bg-destructive/80 transition disabled:opacity-50"
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        {tCommon("confirm")}
                      </button>
                      <button
                        onClick={cancelDelete}
                        className="px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition"
                      >
                        {tCommon("cancel")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
