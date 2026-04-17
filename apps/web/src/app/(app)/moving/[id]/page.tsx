"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, CheckCircle2, Circle, Package, Truck, Trash2, MapPin, Clock, AlertTriangle, Plus, Loader2, X, Repeat, ArrowRightLeft, PlusCircle, XCircle, Shield } from "lucide-react";
import Link from "next/link";
import { LoadingSpinner } from "@/components/shared/loading-state";
import { toast } from "sonner";

const priorityColors: Record<string, string> = {
  URGENT: "text-red-400",
  HIGH: "text-amber-400",
  MEDIUM: "text-cyan-400",
  LOW: "text-white/30",
};

const statusBadge: Record<string, { label: string; cls: string }> = {
  PLANNING: { label: "Planning", cls: "bg-white/5 text-white/40 border-white/10" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  COMPLETED: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  CANCELED: { label: "Canceled", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

interface PlanDetail {
  id: string;
  moveDate: string;
  status: string;
  fromAddress: { street: string; city: string; state: string; zip: string };
  toAddress: { street: string; city: string; state: string; zip: string };
  tasks: { id: string; title: string; category: string; dueDate: string; priority: string; completed: boolean; templateId?: string }[];
  boxes: { id: string; boxNumber: number; label: string; room: string; isPacked: boolean; isFragile?: boolean; contents?: string }[];
}

export default function MovingPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", category: "General", priority: "MEDIUM", dueDate: "" });
  const [migration, setMigration] = useState<any>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const fetchMigration = async (planId: string) => {
    setMigrationLoading(true);
    try {
      const r = await fetch(`/api/moving/migration?planId=${planId}`);
      const m = await r.json();
      setMigration(m.analysis || null);
    } catch {} finally {
      setMigrationLoading(false);
    }
  };

  useEffect(() => {
    fetch(`/api/moving/${id}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => {
        setPlan(data.plan);
        if (data.plan && (data.plan.status === "PLANNING" || data.plan.status === "IN_PROGRESS")) {
          void fetchMigration(data.plan.id);
        }
      })
      .catch(() => router.push("/moving"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const confirmAction = async (serviceId: string, action: "KEEP" | "TRANSFER" | "SWITCH" | "CANCEL") => {
    setConfirming(serviceId);
    try {
      const res = await fetch(`/api/services/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ migrationAction: action }),
      });
      if (res.ok) {
        toast.success(`Marked as ${action.toLowerCase()}`);
        if (plan) await fetchMigration(plan.id);
      } else {
        toast.error("Failed to save choice");
      }
    } catch {
      toast.error("Failed to save choice");
    } finally {
      setConfirming(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/moving/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Plan deleted"); router.push("/moving"); }
    else { toast.error("Failed to delete"); setDeleting(false); }
  };

  const handleStatusChange = async (status: string) => {
    try {
      const res = await fetch(`/api/moving/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setPlan((prev) => prev ? { ...prev, status } : prev);
    } catch {}
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    setToggling(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed }),
      });
      if (res.ok) {
        setPlan((prev) => prev ? {
          ...prev,
          tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, completed: !completed } : t),
        } : prev);
      }
    } catch {}
    setToggling(null);
  };

  if (loading || !plan) return <LoadingSpinner />;

  const completedTasks = plan.tasks.filter((t) => t.completed).length;
  const packedBoxes = plan.boxes.filter((b) => b.isPacked).length;
  const daysUntilMove = Math.ceil((new Date(plan.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const taskPct = plan.tasks.length > 0 ? (completedTasks / plan.tasks.length) * 100 : 0;
  const boxPct = plan.boxes.length > 0 ? (packedBoxes / plan.boxes.length) * 100 : 0;
  const status = statusBadge[plan.status] || statusBadge.PLANNING;
  const isInterstateMove = plan.fromAddress.state !== plan.toAddress.state;
  const moveScopeLabel = isInterstateMove ? "Interstate move" : "Intrastate move";
  const focusLabel = isInterstateMove
    ? "Prioritize DMV, voter registration, taxes, and provider switches across state lines."
    : "Focus on utilities, local provider transfers, and address updates within the same state.";
  const upcomingTasks = plan.tasks.filter((task) => {
    if (task.completed || !task.dueDate) return false;
    const dueAt = new Date(task.dueDate).getTime();
    return dueAt <= Date.now() + (14 * 24 * 60 * 60 * 1000);
  }).length;
  const migrationSummaryLabel = migration
    ? `${migration.summary.transfers} transfer · ${migration.summary.switches} switch · ${migration.summary.newNeeded} new`
    : "Migration guidance appears after we analyze services on your origin address.";

  // Group boxes by room
  const boxesByRoom: Record<string, typeof plan.boxes> = {};
  plan.boxes.forEach((b) => {
    const room = b.room || "Unassigned";
    if (!boxesByRoom[room]) boxesByRoom[room] = [];
    boxesByRoom[room].push(b);
  });
  const rooms = Object.entries(boxesByRoom).sort(([a], [b]) => a.localeCompare(b));

  // Group tasks by category
  const tasksByCat: Record<string, typeof plan.tasks> = {};
  plan.tasks.forEach((t) => {
    const cat = t.category || "General";
    if (!tasksByCat[cat]) tasksByCat[cat] = [];
    tasksByCat[cat].push(t);
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/moving">
            <button className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              {plan.fromAddress.city} <ArrowRight className="h-4 w-4 text-white/30" /> {plan.toAddress.city}
            </h1>
            <p className="text-sm text-white/40 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {daysUntilMove > 0 ? `${daysUntilMove} days until move` : "Move date passed"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] px-2 py-1 rounded-full border font-medium ${status.cls}`}>
            {status.label}
          </span>
          {plan.status === "PLANNING" && (
            <button onClick={() => handleStatusChange("IN_PROGRESS")} className="px-3 py-1.5 rounded-xl bg-cyan-500 text-white text-xs font-medium hover:bg-cyan-600 transition">
              Start Moving
            </button>
          )}
          {plan.status === "IN_PROGRESS" && (
            <button onClick={() => handleStatusChange("COMPLETED")} className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition">
              Mark Complete
            </button>
          )}
        </div>
      </div>

      {/* Address cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "From", addr: plan.fromAddress, color: "red" },
          { label: "To", addr: plan.toAddress, color: "emerald" },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl border border-${item.color}-500/20 bg-${item.color}-500/5 backdrop-blur-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className={`h-4 w-4 text-${item.color}-400`} />
              <span className={`text-xs font-medium text-${item.color}-400`}>{item.label}</span>
            </div>
            <p className="text-sm font-medium text-white">{item.addr.street}</p>
            <p className="text-xs text-white/40">{item.addr.city}, {item.addr.state} {item.addr.zip}</p>
          </div>
        ))}
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 text-center">
          <Calendar className="h-6 w-6 mx-auto text-orange-400 mb-1" />
          <p className="text-2xl font-bold text-white">{new Date(plan.moveDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
          <p className="text-[11px] text-white/40">Move Date</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />Tasks</span>
            <span className="text-sm font-bold text-white">{completedTasks}/{plan.tasks.length}</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-emerald-500 rounded-full transition-all" style={{ width: `${taskPct}%` }} />
          </div>
          <p className="text-[10px] text-white/25 mt-1 text-right">{Math.round(taskPct)}%</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40 flex items-center gap-1"><Package className="h-3.5 w-3.5 text-amber-400" />Boxes</span>
            <span className="text-sm font-bold text-white">{packedBoxes}/{plan.boxes.length}</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all" style={{ width: `${boxPct}%` }} />
          </div>
          <p className="text-[10px] text-white/25 mt-1 text-right">{Math.round(boxPct)}%</p>
        </div>
      </div>

      {/* Move Scope Summary */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/30 mb-1">Move scope</p>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-white">{moveScopeLabel}</h3>
              <span className={`text-[10px] px-2 py-1 rounded-full border font-medium ${isInterstateMove ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"}`}>
                {plan.fromAddress.state} → {plan.toAddress.state}
              </span>
            </div>
            <p className="text-sm text-white/40 mt-2 max-w-2xl">{focusLabel}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 min-w-[180px]">
            <p className="text-[10px] uppercase tracking-wider text-white/25">Upcoming focus</p>
            <p className="text-xl font-semibold text-white mt-1">{upcomingTasks}</p>
            <p className="text-xs text-white/35">task{upcomingTasks === 1 ? "" : "s"} due in the next 14 days</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Route</p>
            <p className="text-sm font-medium text-white">{plan.fromAddress.city}, {plan.fromAddress.state} → {plan.toAddress.city}, {plan.toAddress.state}</p>
            <p className="text-xs text-white/35 mt-1">Your checklist adapts to this route automatically.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Service migration</p>
            <p className="text-sm font-medium text-white">{migrationSummaryLabel}</p>
            <p className="text-xs text-white/35 mt-1">Provider recommendations update as your origin services change.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Checklist posture</p>
            <p className="text-sm font-medium text-white">{isInterstateMove ? "Higher compliance workload" : "Operational move workflow"}</p>
            <p className="text-xs text-white/35 mt-1">{isInterstateMove ? "Expect more identity, vehicle, and state transition tasks." : "Expect more transfer, scheduling, and utility coordination tasks."}</p>
          </div>
        </div>
      </div>

      {/* Migration Panel */}
      {(migration || migrationLoading) && (
        <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent backdrop-blur-xl overflow-hidden">
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <ArrowRightLeft className="h-4 w-4 text-orange-400" />
              <h3 className="text-sm font-semibold text-white">Service Migration Plan</h3>
              {migration && (
                <span className="ml-auto text-[10px] text-white/30">
                  {plan?.fromAddress?.state} → {plan?.toAddress?.state}
                </span>
              )}
            </div>
            {migration && (
              <p className="text-xs text-white/40">
                {migration.summary.total} services analyzed · {migration.summary.switches} need switching · {migration.summary.newNeeded} new needed
              </p>
            )}
          </div>

          {migrationLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
              <span className="text-xs text-white/40">Analyzing your services...</span>
            </div>
          ) : migration ? (
            <div className="px-5 pb-5 space-y-4">
              {/* KEEP */}
              {migration.keeps.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Keep ({migration.keeps.length})</span>
                    <span className="text-[10px] text-white/20">Update address only</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {migration.keeps.map((item: any, i: number) => {
                      const sid = item.currentService?.id;
                      const confirmed = item.currentService?.migrationAction === "KEEP";
                      const busy = confirming === sid;
                      return (
                        <div key={`keep-${i}`} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                          <span className="text-base">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/70 truncate">{item.currentService?.providerName}</p>
                            <p className="text-[10px] text-white/25 truncate">{item.note}</p>
                          </div>
                          {confirmed ? (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />Confirmed
                            </span>
                          ) : sid ? (
                            <button onClick={() => confirmAction(sid, "KEEP")} disabled={busy}
                              className="shrink-0 px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-medium hover:bg-emerald-500/30 transition disabled:opacity-50">
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TRANSFER */}
              {migration.transfers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Repeat className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">Transfer ({migration.transfers.length})</span>
                    <span className="text-[10px] text-white/20">Same provider, new state</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {migration.transfers.map((item: any, i: number) => {
                      const sid = item.currentService?.id;
                      const confirmed = item.currentService?.migrationAction === "TRANSFER";
                      const busy = confirming === sid;
                      return (
                        <div key={`transfer-${i}`} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                          <span className="text-base">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/70 truncate">{item.currentService?.providerName}</p>
                            <p className="text-[10px] text-white/25 truncate">{item.note}</p>
                          </div>
                          {confirmed ? (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] text-cyan-400 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />Confirmed
                            </span>
                          ) : sid ? (
                            <button onClick={() => confirmAction(sid, "TRANSFER")} disabled={busy}
                              className="shrink-0 px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-[10px] font-medium hover:bg-cyan-500/30 transition disabled:opacity-50">
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SWITCH */}
              {migration.switches.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Switch ({migration.switches.length})</span>
                    <span className="text-[10px] text-white/20">Provider change needed</span>
                  </div>
                  <div className="space-y-1.5">
                    {migration.switches.map((item: any, i: number) => {
                      const sid = item.currentService?.id;
                      const confirmed = item.currentService?.migrationAction === "SWITCH";
                      const busy = confirming === sid;
                      const newHref = sid
                        ? `/services/new?fromServiceId=${sid}&category=${encodeURIComponent(item.category)}${item.recommendedProvider ? `&providerId=${item.recommendedProvider.id}` : ""}`
                        : `/services/new`;
                      return (
                        <div key={`switch-${i}`} className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                          <span className="text-base">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm text-white/50 line-through truncate">{item.currentService?.providerName}</p>
                              <ArrowRight className="h-3 w-3 text-amber-400 shrink-0" />
                              <p className="text-sm font-medium text-amber-300 truncate">{item.recommendedProvider?.name || "Find new"}</p>
                            </div>
                            <p className="text-[10px] text-white/25 truncate mt-0.5">{item.note}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {confirmed ? (
                              <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" />Confirmed
                              </span>
                            ) : sid ? (
                              <button onClick={() => confirmAction(sid, "SWITCH")} disabled={busy}
                                className="px-2 py-1 rounded-lg bg-white/5 text-white/50 text-[10px] font-medium hover:bg-white/10 transition disabled:opacity-50">
                                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                              </button>
                            ) : null}
                            <Link href={newHref}>
                              <button className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-medium hover:bg-amber-500/30 transition">
                                Select
                              </button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* NEW */}
              {migration.newNeeded.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <PlusCircle className="h-3.5 w-3.5 text-orange-400" />
                    <span className="text-[11px] font-medium text-orange-400 uppercase tracking-wider">New Needed ({migration.newNeeded.length})</span>
                    <span className="text-[10px] text-white/20">Services you'll need</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {migration.newNeeded.map((item: any, i: number) => {
                      const newHref = `/services/new?category=${encodeURIComponent(item.category)}${item.recommendedProvider ? `&providerId=${item.recommendedProvider.id}` : ""}`;
                      return (
                        <div key={`new-${i}`} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/10">
                          <span className="text-base">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/70 truncate">{item.categoryLabel}</p>
                            {item.recommendedProvider && (
                              <p className="text-[10px] text-orange-300 truncate">Rec: {item.recommendedProvider.name}</p>
                            )}
                          </div>
                          <Link href={newHref}>
                            <button className="shrink-0 px-2 py-1 rounded-lg bg-orange-500/20 text-orange-300 text-[10px] font-medium hover:bg-orange-500/30 transition">
                              Browse
                            </button>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CANCEL */}
              {migration.cancels.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-[11px] font-medium text-red-400 uppercase tracking-wider">Cancel ({migration.cancels.length})</span>
                    <span className="text-[10px] text-white/20">No longer needed</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {migration.cancels.map((item: any, i: number) => {
                      const sid = item.currentService?.id;
                      const confirmed = item.currentService?.migrationAction === "CANCEL";
                      const busy = confirming === sid;
                      return (
                        <div key={`cancel-${i}`} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-red-500/5 border border-red-500/10">
                          <span className="text-base">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/50 truncate">{item.currentService?.providerName}</p>
                            <p className="text-[10px] text-white/25 truncate">{item.note}</p>
                          </div>
                          {confirmed ? (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] text-red-400 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />Confirmed
                            </span>
                          ) : sid ? (
                            <button onClick={() => confirmAction(sid, "CANCEL")} disabled={busy}
                              className="shrink-0 px-2 py-1 rounded-lg bg-red-500/20 text-red-300 text-[10px] font-medium hover:bg-red-500/30 transition disabled:opacity-50">
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {migration.summary.total === 0 && (
                <p className="text-xs text-white/30 text-center py-4">No services to migrate. Add services to your origin address first.</p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Tasks — grouped by category */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="text-sm font-semibold text-white">Checklist</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${showAddTask ? "bg-orange-500/20 text-orange-400" : "text-white/40 hover:text-white hover:bg-white/5"}`}
            >
              {showAddTask ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showAddTask ? "Cancel" : "Add Task"}
            </button>
            <Link href={`/moving/${plan.id}/tasks`}>
              <button className="text-xs text-orange-400 hover:text-orange-300 transition">View All</button>
            </Link>
          </div>
        </div>

        {/* Inline Add Task Form */}
        {showAddTask && (
          <div className="mx-5 mb-4 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
            <input
              placeholder="Task title..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTask.title.trim()) {
                  (async () => {
                    setAddingTask(true);
                    try {
                      const res = await fetch("/api/tasks", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...newTask, movingPlanId: plan.id }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setPlan((prev) => prev ? { ...prev, tasks: [...prev.tasks, { ...data.task, completed: false }] } : prev);
                        setNewTask({ title: "", category: "General", priority: "MEDIUM", dueDate: "" });
                        toast.success("Task added");
                      } else { toast.error("Failed to add task"); }
                    } catch { toast.error("Failed to add task"); }
                    setAddingTask(false);
                  })();
                }
              }}
            />
            <div className="flex gap-2 flex-wrap">
              <select
                value={newTask.category}
                onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/60 focus:outline-none"
              >
                {["General", "Documents", "Utilities", "Government", "Packing", "Cleaning", "Financial", "Healthcare", "Kids"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/60 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/60 focus:outline-none"
              />
              <button
                onClick={async () => {
                  if (!newTask.title.trim()) return;
                  setAddingTask(true);
                  try {
                    const res = await fetch("/api/tasks", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ...newTask, movingPlanId: plan.id }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setPlan((prev) => prev ? { ...prev, tasks: [...prev.tasks, { ...data.task, completed: false }] } : prev);
                      setNewTask({ title: "", category: "General", priority: "MEDIUM", dueDate: "" });
                      toast.success("Task added");
                    } else { toast.error("Failed to add task"); }
                  } catch { toast.error("Failed to add task"); }
                  setAddingTask(false);
                }}
                disabled={addingTask || !newTask.title.trim()}
                className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition disabled:opacity-50 ml-auto"
              >
                {addingTask ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
              </button>
            </div>
          </div>
        )}

        <div className="px-5 pb-5 space-y-4">
          {plan.tasks.length === 0 && !showAddTask ? (
            <p className="text-xs text-white/30 text-center py-4">No tasks yet — click Add Task to get started</p>
          ) : plan.tasks.length === 0 ? null : (
            Object.entries(tasksByCat).map(([cat, tasks]) => (
              <div key={cat}>
                <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">{cat}</p>
                <div className="space-y-1">
                  {tasks.map((task) => {
                    const tid = task.templateId || "";
                    const migBadge = tid.startsWith("MIG_KEEP_") ? { label: "Keep", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" }
                      : tid.startsWith("MIG_TRANSFER_") ? { label: "Transfer", cls: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20" }
                      : tid.startsWith("MIG_SWITCH_") ? { label: "Switch", cls: "bg-amber-500/15 text-amber-400 border-amber-500/20" }
                      : tid.startsWith("MIG_CANCEL_") ? { label: "Cancel", cls: "bg-red-500/15 text-red-400 border-red-500/20" }
                      : null;
                    return (
                    <button
                      key={task.id}
                      onClick={() => toggleTask(task.id, task.completed)}
                      disabled={toggling === task.id}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition text-left group"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className={`h-4 w-4 shrink-0 ${priorityColors[task.priority]}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm ${task.completed ? "line-through text-white/25" : "text-white/80"}`}>{task.title}</p>
                          {migBadge && (
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${migBadge.cls}`}>{migBadge.label}</span>
                          )}
                        </div>
                        {task.dueDate && (
                          <p className="text-[10px] text-white/20">Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                        )}
                      </div>
                      {task.priority === "URGENT" && !task.completed && (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      )}
                    </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Boxes — grouped by room */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="text-sm font-semibold text-white">Boxes by Room</h3>
          <Link href={`/moving/${plan.id}/boxes`}>
            <button className="text-xs text-orange-400 hover:text-orange-300 transition">Manage Boxes</button>
          </Link>
        </div>
        <div className="px-5 pb-5 space-y-4">
          {plan.boxes.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-4">No boxes yet</p>
          ) : (
            rooms.map(([room, boxes]) => {
              const roomPacked = boxes.filter((b) => b.isPacked).length;
              return (
                <div key={room}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider">{room}</p>
                    <span className="text-[10px] text-white/20">{roomPacked}/{boxes.length} packed</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {boxes.map((box) => (
                      <div key={box.id} className={`p-3 rounded-xl border text-center transition ${
                        box.isPacked
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-white/10 bg-white/[0.02]"
                      }`}>
                        <p className="font-bold text-sm text-white">#{box.boxNumber}</p>
                        <p className="text-[11px] font-medium truncate text-white/60">{box.label}</p>
                        <div className="flex items-center justify-center gap-1 mt-1.5">
                          {box.isFragile && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Fragile</span>
                          )}
                          <span className={`text-[8px] px-1 py-0.5 rounded border ${
                            box.isPacked
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-white/5 text-white/30 border-white/10"
                          }`}>
                            {box.isPacked ? "Packed" : "Open"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete */}
      <div className="flex justify-end">
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-white/20 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />Delete Plan
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30">Delete this plan and all data?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-xl text-xs bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </button>
            <button onClick={() => setDeleteConfirm(false)} className="px-3 py-1.5 rounded-xl text-xs text-white/30 hover:text-white hover:bg-white/5 transition">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
