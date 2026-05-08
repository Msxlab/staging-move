import Link from "next/link";
import { Plus, Truck, Calendar, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { getTranslations, getLocale } from "next-intl/server";
import { normalizeMovingPlanStatus } from "@locateflow/shared";

export const dynamic = "force-dynamic";

export default async function MovingPage() {
  const userId = await requireDbUserId();
  // Server-side translations — the status badge labels re-compute per
  // request so Spanish users see "Planificando" instead of "Planning".
  const t = await getTranslations("moving");
  const tEmpty = await getTranslations("empty");
  const locale = await getLocale();

  const statusBadge: Record<string, { label: string; cls: string }> = {
    PLANNING: { label: t("status_planning"), cls: "bg-foreground/5 text-muted-foreground border-border" },
    IN_PROGRESS: { label: t("status_inProgress"), cls: "bg-tone-cyan-bg text-tone-cyan-fg border-tone-cyan-br" },
    COMPLETED: { label: t("status_complete"), cls: "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br" },
    CANCELED: { label: t("status_canceled"), cls: "bg-destructive/10 text-destructive border-destructive" },
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Link href="/moving/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:bg-tone-orange-bg transition">
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
            const normalizedStatus = normalizeMovingPlanStatus(plan.status);
            const status = statusBadge[normalizedStatus] || statusBadge.PLANNING;
            const fromLabel = plan.fromAddress ? plan.fromAddress.street.split(",")[0] : t("fromAddress");
            const toLabel = plan.toAddress ? plan.toAddress.street.split(",")[0] : t("toAddress");
            const daysUntil = Math.ceil((new Date(plan.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

            return (
              <Link key={plan.id} href={`/moving/${plan.id}`}>
                <div className="glass-card p-5 hover:bg-foreground/[0.07] transition-all cursor-pointer mb-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(plan.moveDate).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
                        <span className="truncate max-w-[200px]">{fromLabel}</span>
                        <ArrowRight className="h-4 w-4 text-foreground/40 shrink-0" />
                        <span className="truncate max-w-[200px]">{toLabel}</span>
                      </h3>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${status.cls}`}>
                      {status.label}
                    </span>
                  </div>
                  {normalizedStatus === "IN_PROGRESS" && daysUntil > 0 && (
                    <p className="text-xs text-tone-orange-fg font-medium">{t("daysUntilMove", { days: daysUntil })}</p>
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
