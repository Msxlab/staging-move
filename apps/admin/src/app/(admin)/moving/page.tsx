"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Truck,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  User,
  Eye,
  ChevronDown,
  ChevronRight,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: string;
  status: string;
  moveDate: string;
  isTemporary: boolean;
  estimatedDuration: number | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  fromAddress: { street: string; city: string; state: string; zip: string; _count?: { services: number } };
  toAddress: { street: string; city: string; state: string; zip: string; _count?: { services: number } };
  moveTasks?: Array<{
    id: string;
    actionType: string;
    status: string;
    confidence: string;
    title: string;
    dueDate: string | null;
    provider?: { id: string; name: string; scope: string } | null;
    customProvider?: { id: string; name: string; providerType: string } | null;
    destinationProvider?: { id: string; name: string; scope: string } | null;
  }>;
  _count?: { moveTasks: number };
}

interface Stats {
  total: number;
  planning: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  thisMonth: number;
}

const EMPTY_STATS: Stats = {
  total: 0,
  planning: 0,
  inProgress: 0,
  completed: 0,
  cancelled: 0,
  thisMonth: 0,
};

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br",
  IN_PROGRESS: "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br",
  COMPLETED: "bg-tone-sage-bg text-tone-sage-fg border-tone-sage-br",
  CANCELED: "bg-tone-slate-bg text-muted-foreground border-tone-slate-br",
};

const STATUS_ICONS: Record<string, any> = {
  PLANNING: Clock,
  IN_PROGRESS: Truck,
  COMPLETED: CheckCircle2,
  CANCELED: XCircle,
};

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
];

export default function MovingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [fromState, setFromState] = useState("");
  const [toState, setToState] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const activeFilters = [
    filterStatus,
    fromState,
    toState,
    dateFrom,
    dateTo,
  ].filter(Boolean).length;

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (fromState) params.set("fromState", fromState);
      if (toState) params.set("toState", toState);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/moving?${params}`);
      const data = await res.json();
      setPlans(data.plans || []);
      setStats(data.stats || EMPTY_STATS);
    } catch {
      toast.error("Failed to fetch plans");
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, fromState, toState, dateFrom, dateTo]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  function clearFilters() {
    setFilterStatus("");
    setFromState("");
    setToState("");
    setDateFrom("");
    setDateTo("");
  }

  function daysUntilMove(plan: Plan) {
    const diff = Math.ceil(
      (new Date(plan.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return diff;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Moving Plans</h1>
        <p className="mt-1 text-muted-foreground">
          Track and manage all user relocations
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-6 gap-3">
        {[
          {
            label: "Total",
            value: stats.total,
            icon: Truck,
            color: "text-foreground",
            bg: "bg-card",
          },
          {
            label: "Planning",
            value: stats.planning,
            icon: Clock,
            color: "text-tone-honey-fg",
            bg: "bg-tone-honey-bg",
          },
          {
            label: "In Progress",
            value: stats.inProgress,
            icon: Truck,
            color: "text-tone-sky-fg",
            bg: "bg-tone-sky-bg",
          },
          {
            label: "Completed",
            value: stats.completed,
            icon: CheckCircle2,
            color: "text-tone-sage-fg",
            bg: "bg-tone-sage-bg",
          },
          {
            label: "Canceled",
            value: stats.cancelled,
            icon: XCircle,
            color: "text-muted-foreground",
            bg: "bg-tone-slate-bg",
          },
          {
            label: "This Month",
            value: stats.thisMonth,
            icon: Calendar,
            color: "text-tone-foil-fg",
            bg: "bg-tone-foil-bg",
          },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => {
              if (s.label !== "Total" && s.label !== "This Month")
                setFilterStatus(
                  s.label === "In Progress"
                    ? "IN_PROGRESS"
                    : s.label === "Canceled"
                      ? "CANCELED"
                    : s.label.toUpperCase(),
                );
            }}
            className={`rounded-xl border border-border ${s.bg} p-4 text-left transition-shadow hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {s.label}
              </p>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by user name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${showFilters ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
        >
          <Filter className="h-4 w-4" /> Filters
          {activeFilters > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {activeFilters}
            </span>
          )}
        </button>
        {filterStatus && (
          <button
            onClick={() => setFilterStatus("")}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
          >
            {filterStatus.replace("_", " ")} <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Filters</h3>
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">All</option>
                <option value="PLANNING">Planning</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELED">Canceled</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                From State
              </label>
              <select
                value={fromState}
                onChange={(e) => setFromState(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Any</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                To State
              </label>
              <select
                value={toState}
                onChange={(e) => setToState(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Any</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Move Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Move Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
        </div>
      )}

      {/* Plans List */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          Loading plans...
        </div>
      ) : plans.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          No moving plans found
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const days = daysUntilMove(plan);
            const isExpanded = expandedPlan === plan.id;
            const StatusIcon = STATUS_ICONS[plan.status] || Clock;
            const originServiceCount = plan.fromAddress._count?.services || 0;
            const destinationServiceCount = plan.toAddress._count?.services || 0;
            const moveTaskCount = plan._count?.moveTasks || plan.moveTasks?.length || 0;
            const openMoveTaskCount = (plan.moveTasks || []).filter((task) => !["COMPLETED", "DISMISSED"].includes(task.status)).length;
            const isInterstate = plan.fromAddress.state !== plan.toAddress.state;
            return (
              <div
                key={plan.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                {/* Main Row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}

                  {/* Route */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-tone-orange-fg flex-shrink-0" />
                      <span className="font-medium text-foreground text-sm truncate">
                        {plan.fromAddress.city}, {plan.fromAddress.state}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <MapPin className="h-4 w-4 text-tone-sage-fg flex-shrink-0" />
                      <span className="font-medium text-foreground text-sm truncate">
                        {plan.toAddress.city}, {plan.toAddress.state}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {plan.user.firstName} {plan.user.lastName} Â·{" "}
                        {plan.user.email}
                      </span>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="flex-shrink-0 text-right w-24">
                    <p className="text-sm font-medium text-foreground">
                      {new Date(plan.moveDate).toLocaleDateString()}
                    </p>
                    <p
                      className={`text-[11px] ${days > 7 ? "text-muted-foreground" : days > 0 ? "text-tone-honey-fg" : days === 0 ? "text-destructive font-bold" : "text-muted-foreground"}`}
                    >
                      {days > 0
                        ? `${days} days left`
                        : days === 0
                          ? "Today!"
                          : `${Math.abs(days)}d ago`}
                    </p>
                  </div>

                  {/* Status */}
                  <span
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium flex-shrink-0 ${STATUS_COLORS[plan.status] || "bg-muted"}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {plan.status.replace("_", " ")}
                  </span>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-5">
                    <div className="grid grid-cols-3 gap-6">
                      {/* From */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-tone-orange-fg" /> FROM
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {plan.fromAddress.street}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {plan.fromAddress.city}, {plan.fromAddress.state}{" "}
                          {plan.fromAddress.zip}
                        </p>
                      </div>
                      {/* To */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-tone-sage-fg" /> TO
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {plan.toAddress.street}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {plan.toAddress.city}, {plan.toAddress.state}{" "}
                          {plan.toAddress.zip}
                        </p>
                      </div>
                      {/* Info */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Created</span>
                          <span className="text-foreground">
                            {new Date(plan.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Temporary
                          </span>
                          <span className="text-foreground">
                            {plan.isTemporary ? "Yes" : "No"}
                          </span>
                        </div>
                        {plan.estimatedDuration && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Est. Duration
                            </span>
                            <span className="text-foreground">
                              {plan.estimatedDuration} days
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg border border-tone-honey-br bg-tone-honey-bg p-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tone-honey-fg" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            Operator transition context
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Guidance is manual support context only. LocateFlow does not update provider accounts or execute address changes.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                              {isInterstate ? "Interstate move" : "Same-state move"}
                            </span>
                            <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                              Origin services: {originServiceCount}
                            </span>
                            <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                              Destination services: {destinationServiceCount}
                            </span>
                            <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                              Move tasks: {moveTaskCount}
                            </span>
                            {openMoveTaskCount > 0 && (
                              <span className="rounded-full border border-tone-sky-br bg-tone-sky-bg px-2 py-1 text-[11px] text-tone-sky-fg">
                                Open tasks: {openMoveTaskCount}
                              </span>
                            )}
                            {originServiceCount > 0 && destinationServiceCount === 0 && (
                              <span className="rounded-full border border-tone-honey-br bg-tone-honey-bg px-2 py-1 text-[11px] text-tone-honey-fg">
                                Destination service setup not tracked yet
                              </span>
                            )}
                          </div>
                          {(plan.moveTasks || []).length > 0 && (
                            <div className="mt-3 grid gap-2 lg:grid-cols-2">
                              {(plan.moveTasks || []).slice(0, 4).map((task) => (
                                <div key={task.id} className="rounded-lg border border-border bg-background/70 p-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-medium text-foreground">{task.title}</p>
                                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        {formatLabel(task.actionType)} Â· {task.provider?.name || task.customProvider?.name || task.destinationProvider?.name || "No provider selected"}
                                      </p>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${taskStatusClass(task.status)}`}>
                                      {formatLabel(task.status)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    {formatLabel(task.confidence)} confidence. Manual guidance only.
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/users/${plan.user.id}`);
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                      >
                        <Eye className="h-3 w-3" /> View User Profile
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function taskStatusClass(status: string) {
  if (status === "COMPLETED") return "bg-tone-sage-bg text-tone-sage-fg";
  if (status === "DISMISSED") return "bg-muted text-muted-foreground";
  if (status === "ACCEPTED" || status === "IN_PROGRESS") return "bg-tone-sky-bg text-tone-sky-fg";
  if (status === "REOPENED") return "bg-tone-foil-bg text-tone-foil-fg";
  return "bg-tone-honey-bg text-tone-honey-fg";
}
