"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Home, Briefcase, Palmtree, Star, Edit, Trash2, Zap, Eye, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";

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
  services?: { id: string; monthlyCost?: number }[];
}

export function AddressesClient({ initial }: { initial: AddressItem[] }) {
  const router = useRouter();
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
      const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        toast.success("Address deleted");
      } else {
        toast.error("Failed to delete address");
      }
    } catch {
      toast.error("Failed to delete address");
    }
    setDeletingId(null);
    setDeleteConfirm(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm(null);
  };

  const totalMonthly = addresses.reduce(
    (sum, a) => sum + (a.services?.reduce((s: number, sv: any) => s + (sv.monthlyCost || 0), 0) || 0),
    0,
  );
  const totalServices = addresses.reduce((sum, a) => sum + (a.services?.length || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Addresses</h1>
          <p className="text-white/40 mt-1">
            {addresses.length} address{addresses.length !== 1 ? "es" : ""} · {totalServices} services · ${totalMonthly.toLocaleString()}/mo
          </p>
        </div>
        <Link href="/addresses/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition">
            <Plus className="h-4 w-4" /> Add Address
          </button>
        </Link>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No addresses yet"
          description="Add your first address to start tracking services and expenses."
          actionLabel="Add Address"
          actionHref="/addresses/new"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => {
            const TypeIcon = typeIcons[address.type] || MapPin;
            const servicesCount = address.services?.length || 0;
            const monthlyCost = address.services?.reduce((sum: number, s: any) => sum + (s.monthlyCost || 0), 0) || 0;
            const isDeleting = deletingId === address.id;
            const isConfirming = deleteConfirm === address.id;

            return (
              <div
                key={address.id}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 hover:bg-white/[0.07] transition-all cursor-pointer group relative"
                onClick={() => router.push(`/addresses/${address.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 group-hover:bg-orange-500 group-hover:border-orange-500 transition-colors">
                      <TypeIcon className="h-5 w-5 text-orange-400 group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white flex items-center gap-2">
                        {address.nickname || "Address"}
                        {address.isPrimary && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                      </h3>
                      <p className="text-sm text-white/35">
                        {address.street}, {address.city}, {address.state} {address.zip}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${
                      address.ownership === "OWNER"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    }`}
                  >
                    {address.ownership === "OWNER" ? "Owner" : "Renter"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm border-t border-white/5 pt-3 mb-3">
                  <div className="flex items-center gap-4">
                    <span className="text-white/40">
                      <span className="font-medium text-white/70">{servicesCount}</span> services
                    </span>
                    <span className="text-white/40">
                      <span className="font-semibold text-emerald-400">${monthlyCost.toLocaleString()}</span>/mo
                    </span>
                  </div>
                  <span className="text-xs text-white/25">
                    Since {new Date(address.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 border-t border-white/5 pt-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => router.push(`/addresses/${address.id}`)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/40 hover:text-white hover:bg-white/5 transition"
                  >
                    <Eye className="h-3 w-3" />Details
                  </button>
                  <button
                    onClick={() => router.push(`/addresses/${address.id}/edit`)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/40 hover:text-orange-400 hover:bg-orange-500/10 transition"
                  >
                    <Edit className="h-3 w-3" />Edit
                  </button>
                  <button
                    onClick={() => router.push(`/services/new`)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
                  >
                    <Zap className="h-3 w-3" />Add Service
                  </button>

                  <div className="flex-1" />

                  {!isConfirming ? (
                    <button
                      onClick={(e) => handleDelete(address.id, e)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/20 hover:text-red-400 hover:bg-red-500/10 transition"
                      aria-label="Delete address"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleDelete(address.id, e)}
                        disabled={isDeleting}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Confirm
                      </button>
                      <button
                        onClick={cancelDelete}
                        className="px-2 py-1 rounded-lg text-[11px] text-white/40 hover:text-white hover:bg-white/5 transition"
                      >
                        Cancel
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
