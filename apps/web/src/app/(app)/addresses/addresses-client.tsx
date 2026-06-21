"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Home, Briefcase, Palmtree, Star, Edit, Trash2, Zap, Eye, Loader2, ArrowRight, Bell } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { RaccoonReading } from "@/components/illustrations/RaccoonReading";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { monthlyAmountForCycle } from "@/lib/budget-planning";
import { normalizeMovingPlanStatus } from "@locateflow/shared";

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

/** Lightweight slice of GET /api/moving consumed by the transit hero. The
 *  route returns full plans; only these fields are read here. */
interface ActiveMovePlan {
  id: string;
  status: string;
  moveDate: string;
  fromAddressId?: string | null;
  toAddressId?: string | null;
  fromAddress?: { id?: string; city?: string; state?: string } | null;
  toAddress?: { id?: string; city?: string; state?: string } | null;
}

/** Per-address health ring (mirrors the mobile hub's linked-services ring):
 *  hand-rolled SVG — arc = this address's share of all active tracked
 *  accounts, count centered. Warn tint when accounts linger at a move origin. */
function AddressHealthRing({ count, total, warn, label }: { count: number; total: number; warn?: boolean; label: string }) {
  const size = 44;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? count / total : 0;
  return (
    <div className="relative h-11 w-11 shrink-0" role="img" aria-label={label} title={label}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
        {count > 0 && (
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={warn ? "hsl(var(--destructive))" : "var(--sage)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(c * share, stroke)} ${c}`}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{count}</span>
    </div>
  );
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
  // Active moving plan (PLANNING / IN_PROGRESS) powering the move-in-transit
  // hero. Best-effort: /api/moving is the same light list call the dashboard
  // and the mobile hub already make — any failure simply hides the hero and
  // never blocks the addresses grid.
  const [activeMove, setActiveMove] = useState<ActiveMovePlan | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/moving")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const plans: ActiveMovePlan[] = data?.plans || [];
        setActiveMove(
          plans.find((p) => {
            const s = normalizeMovingPlanStatus(p.status);
            return s === "PLANNING" || s === "IN_PROGRESS";
          }) || null,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  // ── Move-in-transit hero (mirrors mobile P1-E's derivation) ──
  // Progress = share of the move's tracked services already at the NEW
  // address, computed from the active plan (/api/moving) plus the per-address
  // service lists this page already loads — same old/new split as the move
  // screen's "Set up at new / Still at old" panels.
  const transitFrom = activeMove
    ? addresses.find((a) => a.id === (activeMove.fromAddressId || activeMove.fromAddress?.id))
    : undefined;
  const transitTo = activeMove
    ? addresses.find((a) => a.id === (activeMove.toAddressId || activeMove.toAddress?.id))
    : undefined;
  const transitStillAtOld = transitFrom?.services?.length || 0;
  const transitAtNew = transitTo?.services?.length || 0;
  const transitTotal = transitStillAtOld + transitAtNew;
  const transitPct = transitTotal > 0 ? Math.round((transitAtNew / transitTotal) * 100) : 0;
  const transitFromCity = activeMove?.fromAddress?.city || transitFrom?.city || "—";
  const transitFromState = activeMove?.fromAddress?.state || transitFrom?.state || "";
  const transitToCity = activeMove?.toAddress?.city || transitTo?.city || "—";
  const transitToState = activeMove?.toAddress?.state || transitTo?.state || "";

  const formattedMonthly = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(totalMonthly);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-border/70 bg-card/70 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-primary">Address command</p>
              <h1 className="h1 text-2xl text-foreground md:text-3xl">
                {t.rich("titleEditorial", { em: (chunks) => <em>{chunks}</em> })}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("formSubtitle")}</p>
            </div>
          </div>
          <Link
            href="/addresses/new"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {t("newTitle")}
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background/55 p-3">
            <p className="text-lg font-bold text-foreground">{addresses.length}</p>
            <p className="text-xs font-semibold uppercase text-muted-foreground">addresses</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/55 p-3">
            <p className="text-lg font-bold text-foreground">{totalServices}</p>
            <p className="text-xs font-semibold uppercase text-muted-foreground">services</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/55 p-3">
            <p className="text-lg font-bold text-foreground">{formattedMonthly}</p>
            <p className="text-xs font-semibold uppercase text-muted-foreground">monthly</p>
          </div>
        </div>
      </section>

      {/* Move-in-transit hero — route nodes old → new + sage→primary progress */}
      {activeMove && (
        <Link
          href={`/moving/plan/${activeMove.id}`}
          aria-label={t("transit_aria", { from: transitFromCity, to: transitToCity })}
          className="block rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5 hover:bg-foreground/[0.07] transition-all"
        >
          <p className="text-[11px] font-semibold uppercase text-primary">{t("transit_kicker")}</p>
          <div className="my-3 flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-foreground">
                {transitFromCity}
                {transitFromState ? `, ${transitFromState}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-foreground/35">{t("transit_fromRole")}</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ArrowRight className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 text-right">
              <p className="truncate text-base font-semibold text-foreground">
                {transitToCity}
                {transitToState ? `, ${transitToState}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-foreground/35">{t("transit_toRole")}</p>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${transitPct}%`,
                background: "linear-gradient(90deg, var(--sage), hsl(var(--primary)))",
              }}
            />
          </div>
          <p className="mt-2.5 text-xs text-foreground/35">
            {t("transit_progress", {
              pct: transitPct,
              date: new Date(activeMove.moveDate).toLocaleDateString(locale, { month: "short", day: "numeric" }),
            })}
            {" - "}
            {transitStillAtOld > 0 ? (
              <span className="font-medium text-destructive">{t("transit_stillAtOld", { count: transitStillAtOld })}</span>
            ) : (
              t("transit_allMoved")
            )}
          </p>
        </Link>
      )}

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
            // Origin of the active move with accounts left behind → warn tint
            // on the ring plus the "still active here" signal line.
            const isMoveOrigin = !!transitFrom && transitFrom.id === address.id;

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
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${
                        address.ownership === "OWNER"
                          ? "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br"
                          : "bg-tone-cyan-bg text-tone-cyan-fg border-tone-cyan-br"
                      }`}
                    >
                      {address.ownership === "OWNER" ? t("ownership_owner") : t("ownership_renter")}
                    </span>
                    <AddressHealthRing
                      count={servicesCount}
                      total={totalServices}
                      warn={isMoveOrigin && servicesCount > 0}
                      label={t("healthRing", { count: servicesCount })}
                    />
                  </div>
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

                {isMoveOrigin && servicesCount > 0 && (
                  <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <Bell className="h-3.5 w-3.5 shrink-0" />
                    {t("signal_stillHere", { count: servicesCount })}
                  </div>
                )}

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
