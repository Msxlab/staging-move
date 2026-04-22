import Link from "next/link";
import { Plus, Truck, Calendar, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { getTranslations, getLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function MovingPage() {
  const userId = await requireDbUserId();
  // Server-side translations — the status badge labels re-compute per
  // request so Spanish users see "Planificando" instead of "Planning".
  const t = await getTranslations("moving");
  const tEmpty = await getTranslations("empty");
  const locale = await getLocale();

  const statusBadge: Record<string, { label: string; cls: string }> = {
    PLANNING: { label: t("status_planning"), cls: "bg-white/5 text-white/40 border-white/10" },
    IN_PROGRESS: { label: t("status_inProgress"), cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
    COMPLETED: { label: t("status_complete"), cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    CANCELED: { label: t("status_canceled"), cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  };

  const plans = await prisma.movingPlan.findMany({
    where: { userId, deletedAt: null },
    include: {
      fromAddress: { select: { street: true, city: true, state: true, zip: true } },
      toAddress: { select: { street: true, city: true, state: true, zip: true } },
    },
    orderBy: { moveDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t("title")}</h1>
          <p className="text-white/40 mt-1">{t("subtitle")}</p>
        </div>
        <Link href="/moving/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition">
            <Plus className="h-4 w-4" /> {t("newPlanTitle")}
          </button>
        </Link>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={tEmpty("movingPlans")}
          description={tEmpty("movingPlansDescription")}
          actionLabel={tEmpty("startMove")}
          actionHref="/moving/new"
        />
      ) : (
        <div className="space-y-4">
          {plans.map((plan: any) => {
            const status = statusBadge[plan.status] || statusBadge.PLANNING;
            const fromLabel = plan.fromAddress ? plan.fromAddress.street.split(",")[0] : t("fromAddress");
            const toLabel = plan.toAddress ? plan.toAddress.street.split(",")[0] : t("toAddress");
            const daysUntil = Math.ceil((new Date(plan.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

            return (
              <Link key={plan.id} href={`/moving/${plan.id}`}>
                <div className="glass-card p-5 hover:bg-white/[0.07] transition-all cursor-pointer mb-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-white/40">
                        <Calendar className="h-4 w-4" />
                        {new Date(plan.moveDate).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2 flex-wrap">
                        <span className="truncate max-w-[200px]">{fromLabel}</span>
                        <ArrowRight className="h-4 w-4 text-white/30 shrink-0" />
                        <span className="truncate max-w-[200px]">{toLabel}</span>
                      </h3>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${status.cls}`}>
                      {status.label}
                    </span>
                  </div>
                  {plan.status === "IN_PROGRESS" && daysUntil > 0 && (
                    <p className="text-xs text-orange-400 font-medium">{daysUntil} days until move</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
