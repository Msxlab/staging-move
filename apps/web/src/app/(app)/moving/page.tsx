import Link from "next/link";
import { Plus, Sparkles, Truck, Calendar, ArrowRight } from "lucide-react";
import { headers } from "next/headers";
import { EmptyState } from "@/components/shared/empty-state";
import { RaccoonReading } from "@/components/illustrations/RaccoonReading";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { getTranslations, getLocale } from "next-intl/server";
import { CONSUMER_FREE_FLAG, normalizeMovingPlanStatus } from "@locateflow/shared";
import { canCreateMovingPlan } from "@/lib/plan-limits";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  planLimitScopeForDataScope,
  resolveWorkspaceDataScope,
  scopedRecordWhere,
} from "@/lib/workspace-data-scope";

export const dynamic = "force-dynamic";

export default async function MovingPage() {
  const userId = await requireDbUserId();
  const request = new Request("http://locateflow.local", { headers: await headers() });
  const scope = await resolveWorkspaceDataScope(request, userId);
  // Server-side translations — the status badge labels re-compute per
  // request so Spanish users see "Planificando" instead of "Planning".
  const t = await getTranslations("moving");
  const tEmpty = await getTranslations("empty");
  const td = await getTranslations("dashboard");
  const locale = await getLocale();

  // Staging runs the consumer-free pivot: if entitlement data is stale, keep
  // the visible action on the move-plan path instead of sending users to billing.
  // Fail open on gate errors — the API stays the enforcement point, and a
  // transient failure must never lock paid users out of plan creation.
  const consumerFree = await isFeatureEnabled(CONSUMER_FREE_FLAG, { userId }).catch(() => false);
  let canStartPlan = consumerFree;
  if (!consumerFree) {
    try {
      const gate = await canCreateMovingPlan(userId, planLimitScopeForDataScope(scope));
      canStartPlan = gate.allowed;
    } catch {
      canStartPlan = true;
    }
  }
  const newPlanHref = "/moving/new";
  const newPlanLabel = canStartPlan ? t("newPlanTitle") : td("commandCenter_freeCta");

  const statusBadge: Record<string, { label: string; cls: string }> = {
    PLANNING: { label: t("status_planning"), cls: "bg-foreground/5 text-muted-foreground border-border" },
    IN_PROGRESS: { label: t("status_inProgress"), cls: "bg-tone-cyan-bg text-tone-cyan-fg border-tone-cyan-br" },
    COMPLETED: { label: t("status_complete"), cls: "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br" },
    CANCELED: { label: t("status_canceled"), cls: "bg-destructive/10 text-destructive border-destructive" },
  };

  const plans = await prisma.movingPlan.findMany({
    where: scopedRecordWhere(scope, { deletedAt: null }, { childSelfOnly: true }),
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
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {t.rich("titleRich", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Link
          href={newPlanHref}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground text-sm font-medium shadow-sm hover:opacity-90 transition"
        >
          {canStartPlan ? <Plus className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} {newPlanLabel}
        </Link>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={Truck}
          illustration={<RaccoonReading size={148} className="text-foreground/45" />}
          title={tEmpty("movingPlans")}
          description={canStartPlan ? tEmpty("movingPlansDescription") : td("commandCenter_freeBody")}
          actionLabel={canStartPlan ? tEmpty("startMove") : td("commandCenter_freeCta")}
          actionHref={newPlanHref}
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
              <Link key={plan.id} href={`/moving/plan/${plan.id}`}>
                <div className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-all cursor-pointer mb-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-mono">
                          {new Date(plan.moveDate).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground flex items-center gap-2 flex-wrap">
                        <span className="truncate max-w-[200px]">{fromLabel}</span>
                        <ArrowRight className="h-4 w-4 text-foreground/40 shrink-0" />
                        <span className="truncate max-w-[200px]">{toLabel}</span>
                      </h3>
                    </div>
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full border font-medium ${status.cls}`}>
                      {status.label}
                    </span>
                  </div>
                  {normalizedStatus === "IN_PROGRESS" && daysUntil > 0 && (
                    <p className="font-mono text-xs text-primary font-medium">{t("daysUntilMove", { days: daysUntil })}</p>
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
