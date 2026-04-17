import Link from "next/link";
import { Plus, Truck, Calendar, ArrowRight, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, { label: string; cls: string }> = {
  PLANNING: { label: "Planning", cls: "bg-white/5 text-white/40 border-white/10" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  COMPLETED: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  CANCELED: { label: "Canceled", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default async function MovingPage() {
  const userId = await requireDbUserId();

  const plans = await prisma.movingPlan.findMany({
    where: { userId, deletedAt: null },
    include: {
      fromAddress: { select: { street: true, city: true, state: true, zip: true } },
      toAddress: { select: { street: true, city: true, state: true, zip: true } },
      tasks: { select: { id: true, completed: true } },
      boxes: { select: { id: true, isPacked: true } },
    },
    orderBy: { moveDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Moving Plans</h1>
          <p className="text-white/40 mt-1">Plan and track your relocations</p>
        </div>
        <Link href="/moving/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition">
            <Plus className="h-4 w-4" /> New Moving Plan
          </button>
        </Link>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No moving plans yet"
          description="Create a moving plan to start tracking your relocation."
          actionLabel="New Moving Plan"
          actionHref="/moving/new"
        />
      ) : (
        <div className="space-y-4">
          {plans.map((plan: any) => {
            const status = statusBadge[plan.status] || statusBadge.PLANNING;
            const totalTasks = plan.tasks?.length || 0;
            const completedTasks = plan.tasks?.filter((t: any) => t.completed).length || 0;
            const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
            const boxesCount = plan.boxes?.length || 0;
            const packedBoxes = plan.boxes?.filter((b: any) => b.isPacked).length || 0;
            const fromLabel = plan.fromAddress ? plan.fromAddress.street.split(",")[0] : "Origin";
            const toLabel = plan.toAddress ? plan.toAddress.street.split(",")[0] : "Destination";

            return (
              <Link key={plan.id} href={`/moving/${plan.id}`}>
                <div className="glass-card p-5 hover:bg-white/[0.07] transition-all cursor-pointer mb-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-white/40">
                        <Calendar className="h-4 w-4" />
                        Move Date: {new Date(plan.moveDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
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

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-white/50">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        Tasks
                      </span>
                      <span className="font-medium text-white/70">{completedTasks} / {totalTasks}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-cyan-500 rounded-full transition-all"
                        style={{ width: `${taskProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-white/40">
                    <span className="flex items-center gap-1.5">
                      <Truck className="h-4 w-4" />
                      Boxes: {packedBoxes}/{boxesCount} packed
                    </span>
                    {plan.status === "IN_PROGRESS" && (
                      <span className="text-xs text-orange-400 font-medium">
                        {Math.ceil((new Date(plan.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days until move
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
