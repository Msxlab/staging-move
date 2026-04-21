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
  Package,
  ArrowRight,
  User,
  Eye,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: string;
  status: string;
  moveDate: string;
  isTemporary: boolean;
  estimatedDuration: number | null;
  totalTasks: number;
  completedTasks: number;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  fromAddress: { street: string; city: string; state: string; zip: string };
  toAddress: { street: string; city: string; state: string; zip: string };
  tasks: { id: string; templateId: string | null; completed: boolean }[];
  _count: { tasks: number; boxes: number };
}

function getMigrationStats(tasks: Plan["tasks"]) {
  let keep = 0,
    transfer = 0,
    switchCount = 0,
    cancel = 0;
  for (const t of tasks) {
    const tid = t.templateId || "";
    if (tid.startsWith("MIG_KEEP_")) keep++;
    else if (tid.startsWith("MIG_TRANSFER_")) transfer++;
    else if (tid.startsWith("MIG_SWITCH_")) switchCount++;
    else if (tid.startsWith("MIG_CANCEL_")) cancel++;
  }
  const total = keep + transfer + switchCount + cancel;
  return { keep, transfer, switch: switchCount, cancel, total };
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
  PLANNING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  COMPLETED: "bg-green-500/10 text-green-500 border-green-500/20",
  CANCELLED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const STATUS_ICONS: Record<string, any> = {
  PLANNING: Clock,
  IN_PROGRESS: Truck,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
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

  function progressPercent(plan: Plan) {
    return plan.totalTasks > 0
      ? Math.round((plan.completedTasks / plan.totalTasks) * 100)
      : 0;
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
            color: "text-yellow-500",
            bg: "bg-yellow-500/5",
          },
          {
            label: "In Progress",
            value: stats.inProgress,
            icon: Truck,
            color: "text-blue-500",
            bg: "bg-blue-500/5",
          },
          {
            label: "Completed",
            value: stats.completed,
            icon: CheckCircle2,
            color: "text-green-500",
            bg: "bg-green-500/5",
          },
          {
            label: "Cancelled",
            value: stats.cancelled,
            icon: XCircle,
            color: "text-gray-400",
            bg: "bg-gray-500/5",
          },
          {
            label: "This Month",
            value: stats.thisMonth,
            icon: Calendar,
            color: "text-purple-500",
            bg: "bg-purple-500/5",
          },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => {
              if (s.label !== "Total" && s.label !== "This Month")
                setFilterStatus(
                  s.label === "In Progress"
                    ? "IN_PROGRESS"
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
                <option value="CANCELLED">Cancelled</option>
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
            const pct = progressPercent(plan);
            const days = daysUntilMove(plan);
            const isExpanded = expandedPlan === plan.id;
            const StatusIcon = STATUS_ICONS[plan.status] || Clock;
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
                      <MapPin className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      <span className="font-medium text-foreground text-sm truncate">
                        {plan.fromAddress.city}, {plan.fromAddress.state}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <MapPin className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="font-medium text-foreground text-sm truncate">
                        {plan.toAddress.city}, {plan.toAddress.state}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {plan.user.firstName} {plan.user.lastName} ·{" "}
                        {plan.user.email}
                      </span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="w-32 flex-shrink-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-blue-500" : "bg-yellow-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Tasks & Boxes */}
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                      {plan.completedTasks}/{plan.totalTasks}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" /> {plan._count.boxes}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="flex-shrink-0 text-right w-24">
                    <p className="text-sm font-medium text-foreground">
                      {new Date(plan.moveDate).toLocaleDateString()}
                    </p>
                    <p
                      className={`text-[11px] ${days > 7 ? "text-muted-foreground" : days > 0 ? "text-yellow-500" : days === 0 ? "text-red-500 font-bold" : "text-muted-foreground"}`}
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
                          <MapPin className="h-3 w-3 text-orange-500" /> FROM
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
                          <MapPin className="h-3 w-3 text-green-500" /> TO
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
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tasks</span>
                          <span className="text-foreground">
                            {plan.completedTasks} / {plan.totalTasks} completed
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Boxes</span>
                          <span className="text-foreground">
                            {plan._count.boxes} total
                          </span>
                        </div>
                        {(() => {
                          const mig = getMigrationStats(plan.tasks);
                          return mig.total > 0 ? (
                            <div className="mt-2 pt-2 border-t border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Migration Tasks
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                {mig.keep > 0 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                                    {mig.keep} keep
                                  </span>
                                )}
                                {mig.transfer > 0 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                                    {mig.transfer} transfer
                                  </span>
                                )}
                                {mig.switch > 0 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                    {mig.switch} switch
                                  </span>
                                )}
                                {mig.cancel > 0 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                                    {mig.cancel} cancel
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : null;
                        })()}
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
