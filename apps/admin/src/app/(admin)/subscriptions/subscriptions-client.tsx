"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, ChevronLeft, ChevronRight, CreditCard, Users, Calendar,
  TrendingUp, TrendingDown, Filter, X, Eye, Clock, XCircle, CheckCircle2, AlertTriangle,
  Ban, RefreshCw, ShieldCheck, Undo2, Receipt, ExternalLink, FileText,
  DollarSign, BarChart3, ArrowUpRight, ArrowDownRight, Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { maskEmail, maskProviderIdentifier } from "@/lib/privacy";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";

// Lifecycle action identifiers — one per server route under
// /api/subscriptions/[id]/<action>. Each is gated by the step-up modal.
type LifecycleAction =
  | "cancel_now"
  | "cancel_period_end"
  | "refund"
  | "change_plan"
  | "resync"
  | "revalidate";

// Paid plans an operator can move a subscription to, and the billing intervals.
// The server resolves the actual Stripe price id from runtime config — these
// are just the (plan, interval) pair the operator selects.
const CHANGE_PLAN_OPTIONS = ["INDIVIDUAL", "FAMILY", "PRO"] as const;
type ChangePlanTarget = (typeof CHANGE_PLAN_OPTIONS)[number];
type ChangePlanInterval = "MONTH" | "YEAR";

interface AdminApiError {
  message: string;
  requiresMfa: boolean;
}

async function readAdminApiError(response: Response, fallback: string): Promise<AdminApiError> {
  const data = await response.json().catch(() => ({}));
  const requiresMfa = Boolean((data as any)?.requiresMfa);
  const rawMessage = typeof (data as any)?.error === "string" ? (data as any).error : fallback;
  if (response.status === 401) return { message: "Admin session expired. Please sign in again.", requiresMfa };
  if (response.status === 403 && rawMessage === "Forbidden") {
    return { message: "Your admin account does not have permission to perform this action.", requiresMfa };
  }
  if (requiresMfa && response.status === 403) {
    return { message: "MFA is required for this operation. Add an authenticator code or backup code and retry.", requiresMfa };
  }
  return { message: rawMessage, requiresMfa };
}

/** Format a Stripe minor-unit amount (e.g. cents) with its currency code. */
function formatMinorAmount(amount: number, currency: string): string {
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount / 100);
  } catch {
    return `${code} ${(amount / 100).toFixed(2)}`;
  }
}

/**
 * Parse a dollar-amount string (e.g. "12.50") into integer minor units (cents).
 * Returns null for empty/invalid input so the caller falls back to a full
 * refund. Anything that isn't a non-negative number with ≤2 decimals is
 * rejected rather than silently rounded.
 */
function parseDollarsToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const minor = Math.round(Number(trimmed) * 100);
  return Number.isFinite(minor) && minor >= 0 ? minor : null;
}

function planLabel(plan: string | null | undefined): string {
  if (!plan) return "—";
  return plan.replace(/_/g, " ");
}

function intervalLabel(interval: string | null | undefined): string {
  if (interval === "YEAR") return "yearly";
  if (interval === "MONTH") return "monthly";
  return "monthly";
}

/** One Stripe invoice as returned by the read-only invoices route. */
interface InvoiceEntry {
  maskedInvoiceId: string;
  number: string | null;
  status: string | null;
  created: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  paid: boolean;
  refunded: boolean;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  receiptUrl: string | null;
}

interface PlanArpuRow {
  plan: string;
  activeCount: number;
  payingCount: number;
  mrr: number;
  arpu: number;
}
interface MrrMovement {
  newMrr: number;
  churnedMrr: number;
  netMrr: number;
}
interface TrialConversion {
  trialsStarted: number;
  converted: number;
  conversionRatePct: number;
}
interface MrrTrendPoint {
  month: string;
  mrr: number;
}
interface AnalyticsData {
  generatedAt: string;
  totals: {
    mrr: number;
    arr: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
    payingSubscriptions: number;
    churnRate: number;
    lastMonthChurn: number;
  };
  mrrMovement: { thisMonth: MrrMovement; lastMonth: MrrMovement };
  arpuByPlan: PlanArpuRow[];
  trialConversion: { thisMonth: TrialConversion; lastMonth: TrialConversion };
  mrrTrend: MrrTrendPoint[];
}

/** Status pill colors for invoice rows. */
const INVOICE_STATUS_COLORS: Record<string, string> = {
  paid: "bg-tone-sage-bg text-tone-sage-fg",
  open: "bg-tone-honey-bg text-tone-honey-fg",
  draft: "bg-tone-slate-bg text-muted-foreground",
  uncollectible: "bg-destructive/10 text-destructive",
  void: "bg-tone-slate-bg text-muted-foreground",
};

interface Sub {
  id: string;
  plan: string;
  status: string;
  provider: string;
  platform: string | null;
  accessType: string | null;
  billingInterval: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCurrentPeriodEnd: string | null;
  originalTransactionId: string | null;
  latestTransactionId: string | null;
  purchaseTokenPresent: boolean;
  lastValidatedAt: string | null;
  lastSyncedAt: string | null;
  trialEndsAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
}

function stripeDashboardUrl(stripeCustomerId: string | null) {
  if (!stripeCustomerId) return null;
  if (stripeCustomerId.includes("****")) return null;
  // Live and test customer IDs share the cus_ prefix; the dashboard accepts
  // either and redirects to the correct mode. Test-mode admins can swap to
  // /test/customers if they prefer.
  return `https://dashboard.stripe.com/customers/${encodeURIComponent(stripeCustomerId)}`;
}

const PLAN_COLORS: Record<string, string> = {
  FREE_TRIAL: "bg-tone-honey-bg text-tone-honey-fg",
  INDIVIDUAL: "bg-tone-sky-bg text-tone-sky-fg",
  FAMILY: "bg-tone-foil-bg text-tone-foil-fg",
  PRO: "bg-tone-rose-bg text-tone-rose-fg",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-tone-sage-bg text-tone-sage-fg",
  TRIALING: "bg-tone-cyan-bg text-tone-cyan-fg",
  CANCELED: "bg-destructive/10 text-destructive",
  PAST_DUE: "bg-tone-honey-bg text-tone-honey-fg",
  GRACE_PERIOD: "bg-tone-honey-bg text-tone-honey-fg",
  UNPAID: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-tone-slate-bg text-muted-foreground",
};

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function SubscriptionsClient() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState<Sub | null>(null);
  const [filters, setFilters] = useState({ plan: "", status: "", provider: "", platform: "", accessType: "", dateFrom: "", dateTo: "" });
  const perPage = 20;

  // ── Top-level view: the subscriptions LIST vs the MRR/churn ANALYTICS tab ──
  const [view, setView] = useState<"list" | "analytics">("list");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // ── Per-subscription invoice / payment history (read-only) ────────────────
  const [invoices, setInvoices] = useState<InvoiceEntry[] | null>(null);
  const [invoicesSupported, setInvoicesSupported] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  // ── Lifecycle action step-up state ───────────────────────────────────────
  // `pendingAction` drives the PasswordConfirmModal; null means closed.
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionRequiresMfa, setActionRequiresMfa] = useState(false);
  // Refund preview (amount + currency) fetched read-only before the operator
  // steps up, so the confirm dialog can state the EXACT amount + user.
  const [refundPreview, setRefundPreview] = useState<
    {
      refundable: boolean;
      amount?: number;
      remainingRefundable?: number;
      alreadyRefunded?: number;
      currency?: string;
      invoiceNumber?: string | null;
      reason?: string;
    } | null
  >(null);
  const [refundPreviewLoading, setRefundPreviewLoading] = useState(false);
  // Operator's refund selection (made in the detail panel BEFORE step-up):
  //  - `refundInvoiceNumber` null → latest paid invoice; else a specific one.
  //  - `refundPartialAmount` "" → full refund; else a partial dollar string.
  const [refundInvoiceNumber, setRefundInvoiceNumber] = useState<string | null>(null);
  const [refundPartialAmount, setRefundPartialAmount] = useState("");

  // Change-plan selection (made in the detail panel) + its read-only preview
  // (resolves the target price + proration server-side) so the confirm dialog
  // can state the exact plan move and immediate proration charge/credit.
  const [planTarget, setPlanTarget] = useState<ChangePlanTarget>("INDIVIDUAL");
  const [planInterval, setPlanInterval] = useState<ChangePlanInterval>("MONTH");
  const [planPreview, setPlanPreview] = useState<
    {
      changeable: boolean;
      reason?: string;
      currentPlan?: string;
      currentInterval?: string;
      targetPlan?: string;
      targetInterval?: string;
      direction?: string;
      prorationAmount?: number | null;
      currency?: string | null;
    } | null
  >(null);
  const [planPreviewLoading, setPlanPreviewLoading] = useState(false);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(perPage), search });
      if (filters.plan) params.set("plan", filters.plan);
      if (filters.status) params.set("status", filters.status);
      if (filters.provider) params.set("provider", filters.provider);
      if (filters.platform) params.set("platform", filters.platform);
      if (filters.accessType) params.set("accessType", filters.accessType);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const res = await fetch(`/api/subscriptions?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to fetch subscriptions");
      }
      setSubs(data.subscriptions || []);
      setTotal(data.total || 0);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      toast.error((error as Error)?.message || "Failed to fetch subscriptions");
      setSubs([]);
      setTotal(0);
    }
    finally { setLoading(false); }
  }, [page, search, filters]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  // Escape closes the detail modal (keyboard parity with the backdrop click).
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDetail(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  // Load the MRR/churn drill-down the first time the analytics tab is opened.
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch("/api/subscriptions/analytics");
      if (!res.ok) {
        const { message } = await readAdminApiError(res, "Failed to load analytics.");
        setAnalyticsError(message);
        return;
      }
      setAnalytics(await res.json());
    } catch {
      setAnalyticsError("Failed to load analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "analytics" && !analytics && !analyticsLoading && !analyticsError) {
      fetchAnalytics();
    }
  }, [view, analytics, analyticsLoading, analyticsError, fetchAnalytics]);

  // Load invoice history whenever a (Stripe) detail modal opens. Store/trial
  // subscriptions short-circuit to an unsupported empty state without a fetch.
  // Reset the per-subscription refund/plan SELECTION whenever the open detail
  // changes, and seed the change-plan target to the current plan/interval so
  // the operator starts from a sane default.
  useEffect(() => {
    setRefundInvoiceNumber(null);
    setRefundPartialAmount("");
    if (detail) {
      const currentPlan = (CHANGE_PLAN_OPTIONS as readonly string[]).includes(detail.plan)
        ? (detail.plan as ChangePlanTarget)
        : "INDIVIDUAL";
      setPlanTarget(currentPlan);
      setPlanInterval(detail.billingInterval === "YEAR" ? "YEAR" : "MONTH");
    }
  }, [detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!detail) {
      setInvoices(null);
      setInvoicesError(null);
      setInvoicesSupported(true);
      return;
    }
    if (detail.provider !== "STRIPE" || !detail.stripeSubscriptionId) {
      setInvoices([]);
      setInvoicesSupported(false);
      setInvoicesError(null);
      return;
    }
    let cancelled = false;
    setInvoicesLoading(true);
    setInvoicesError(null);
    setInvoices(null);
    (async () => {
      try {
        const res = await fetch(`/api/subscriptions/${detail.id}/invoices`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          const { message } = await readAdminApiError(res, "Failed to load invoices.");
          setInvoicesError(message);
          setInvoices([]);
          return;
        }
        setInvoicesSupported(Boolean(data?.supported));
        setInvoices(Array.isArray(data?.invoices) ? data.invoices : []);
      } catch {
        if (!cancelled) {
          setInvoicesError("Failed to load invoices.");
          setInvoices([]);
        }
      } finally {
        if (!cancelled) setInvoicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detail]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const totalPages = Math.ceil(total / perPage);

  function daysUntil(date: string | null) {
    if (!date) return null;
    const d = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return d;
  }

  function getOpsStatus(sub: Sub) {
    if (sub.provider === "APP_STORE") {
      if (!sub.latestTransactionId && !sub.originalTransactionId) return { label: "Missing transaction", cls: "bg-destructive/10 text-destructive" };
      if (!sub.lastValidatedAt) return { label: "Never validated", cls: "bg-tone-honey-bg text-tone-honey-fg" };
    }
    if (sub.provider === "PLAY_STORE") {
      if (!sub.purchaseTokenPresent) return { label: "Missing token", cls: "bg-destructive/10 text-destructive" };
      if (!sub.lastValidatedAt) return { label: "Never validated", cls: "bg-tone-honey-bg text-tone-honey-fg" };
    }
    if (sub.lastValidatedAt && ["APP_STORE", "PLAY_STORE"].includes(sub.provider)) {
      const hoursSinceValidation = (Date.now() - new Date(sub.lastValidatedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceValidation > 24) return { label: "Stale validation", cls: "bg-tone-honey-bg text-tone-honey-fg" };
    }
    return { label: "OK", cls: "bg-tone-sage-bg text-tone-sage-fg" };
  }

  const isStripe = detail?.provider === "STRIPE" && Boolean(detail?.stripeSubscriptionId);
  const stripeCancellable = isStripe && !["CANCELED", "EXPIRED"].includes(detail?.status || "");
  const isStore = detail?.provider === "APP_STORE" || detail?.provider === "PLAY_STORE";

  // Map each lifecycle action to its server route, HTTP verb, and the copy the
  // confirm dialog shows so the operator sees EXACTLY what will happen + who.
  function actionConfig(action: LifecycleAction, sub: Sub) {
    const who = `${sub.user.firstName ?? ""} ${sub.user.lastName ?? ""}`.trim() || maskEmail(sub.user.email);
    switch (action) {
      case "cancel_now":
        return {
          path: `/api/subscriptions/${sub.id}/cancel`,
          body: { mode: "now" },
          title: "Cancel subscription now",
          confirmLabel: "Cancel Now",
          description: `Immediately cancel the Stripe subscription for ${who} (${maskEmail(sub.user.email)}). Access ends right away. Enter your admin password and MFA code or backup code to confirm.`,
        };
      case "cancel_period_end":
        return {
          path: `/api/subscriptions/${sub.id}/cancel`,
          body: { mode: "period_end" },
          title: "Cancel at period end",
          confirmLabel: "Cancel at Period End",
          description: `Cancel renewal for ${who} (${maskEmail(sub.user.email)}). Access continues until the current period ends, then the subscription will not renew. Enter your admin password and MFA code or backup code to confirm.`,
        };
      case "refund": {
        const currency = refundPreview?.currency || "usd";
        // Partial amount the operator typed (dollars) → minor units, when valid.
        const partialMinor = parseDollarsToMinor(refundPartialAmount);
        const isPartial = partialMinor !== null && partialMinor > 0;
        const refundMinor = isPartial
          ? partialMinor
          : typeof refundPreview?.remainingRefundable === "number"
            ? refundPreview.remainingRefundable
            : refundPreview?.amount;
        const amountText =
          refundPreview?.refundable && typeof refundMinor === "number"
            ? formatMinorAmount(refundMinor, currency)
            : null;
        const invoiceText = refundPreview?.invoiceNumber
          ? `invoice ${refundPreview.invoiceNumber}`
          : refundInvoiceNumber
            ? `invoice ${refundInvoiceNumber}`
            : "their latest paid invoice";
        // The server-side guards re-validate everything; we send the operator's
        // selection so the route refunds EXACTLY the previewed invoice/amount.
        const body: Record<string, unknown> = {};
        if (typeof refundPreview?.amount === "number") body.expectedAmount = refundPreview.amount;
        if (refundInvoiceNumber) body.invoiceNumber = refundInvoiceNumber;
        if (isPartial) body.amount = partialMinor;
        return {
          path: `/api/subscriptions/${sub.id}/refund`,
          body,
          title: isPartial ? "Refund a partial amount" : "Refund invoice",
          confirmLabel: amountText ? `Refund ${amountText}` : "Refund",
          description: amountText
            ? `Refund ${amountText}${isPartial ? " (partial)" : ""} to ${who} (${maskEmail(sub.user.email)}) for ${invoiceText}. This moves money and cannot be undone. Enter your admin password and MFA code or backup code to confirm.`
            : `Refund ${invoiceText} for ${who} (${maskEmail(sub.user.email)}). This moves money and cannot be undone. Enter your admin password and MFA code or backup code to confirm.`,
        };
      }
      case "change_plan": {
        const fromText = planPreview?.currentPlan
          ? `${planLabel(planPreview.currentPlan)} (${intervalLabel(planPreview.currentInterval)})`
          : `${planLabel(sub.plan)} (${intervalLabel(sub.billingInterval)})`;
        const toText = `${planLabel(planTarget)} (${intervalLabel(planInterval)})`;
        const proration =
          planPreview?.changeable && typeof planPreview.prorationAmount === "number"
            ? formatMinorAmount(planPreview.prorationAmount, planPreview.currency || "usd")
            : null;
        const prorationSentence =
          proration !== null
            ? planPreview && typeof planPreview.prorationAmount === "number" && planPreview.prorationAmount < 0
              ? ` Stripe will credit about ${formatMinorAmount(Math.abs(planPreview.prorationAmount), planPreview.currency || "usd")} as proration.`
              : ` Stripe will charge about ${proration} now as proration.`
            : "";
        return {
          path: `/api/subscriptions/${sub.id}/change-plan`,
          body: { targetPlan: planTarget, targetInterval: planInterval },
          title: "Change plan",
          confirmLabel: `Change to ${planLabel(planTarget)}`,
          description: `Change the Stripe subscription for ${who} (${maskEmail(sub.user.email)}) from ${fromText} to ${toText}, effective immediately with proration.${prorationSentence} The exact price is resolved server-side from billing config. Enter your admin password and MFA code or backup code to confirm.`,
        };
      }
      case "resync":
        return {
          path: `/api/subscriptions/${sub.id}/resync`,
          body: {},
          title: "Force re-sync from Stripe",
          confirmLabel: "Re-sync from Stripe",
          description: `Re-fetch this subscription from Stripe and overwrite the local status, period end, and plan for ${who} (${maskEmail(sub.user.email)}). No money moves. Enter your admin password and MFA code or backup code to confirm.`,
        };
      case "revalidate":
        return {
          path: `/api/subscriptions/${sub.id}/revalidate`,
          body: {},
          title: "Re-validate store receipt",
          confirmLabel: "Re-validate Receipt",
          description: `Re-read the stored ${sub.provider === "APP_STORE" ? "App Store transaction id" : "Play Store purchase token"} and refresh recorded health for ${who} (${maskEmail(sub.user.email)}). Enter your admin password and MFA code or backup code to confirm.`,
        };
    }
  }

  // Open the step-up modal for an action. For refunds and plan changes, fetch
  // the read-only preview first so the dialog can name the exact amount/change.
  async function openAction(action: LifecycleAction) {
    if (!detail) return;
    setActionError(null);
    setActionRequiresMfa(false);
    if (action === "refund") {
      setRefundPreview(null);
      setRefundPreviewLoading(true);
      setPendingAction(action);
      try {
        // Scope the preview to the operator's selected invoice (if any) so the
        // dialog states the amount for EXACTLY the invoice being refunded.
        const qs = refundInvoiceNumber
          ? `?invoiceNumber=${encodeURIComponent(refundInvoiceNumber)}`
          : "";
        const res = await fetch(`/api/subscriptions/${detail.id}/refund${qs}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const { message } = await readAdminApiError(res, "Failed to load refund preview.");
          setActionError(message);
          setRefundPreview({ refundable: false });
        } else {
          setRefundPreview(data);
          if (!data?.refundable) {
            const reasonMessage =
              data?.reason === "no_paid_invoice"
                ? "No paid invoice is available to refund for this subscription."
                : data?.reason === "invoice_not_refundable"
                  ? "That invoice is not available to refund for this subscription."
                  : data?.reason === "already_fully_refunded"
                    ? "This invoice has already been fully refunded."
                    : "This subscription has no Stripe invoice to refund.";
            setActionError(reasonMessage);
          } else {
            // Validate any partial amount the operator typed against the
            // remaining refundable amount before they step up.
            const partial = parseDollarsToMinor(refundPartialAmount);
            const remaining =
              typeof data?.remainingRefundable === "number" ? data.remainingRefundable : data?.amount;
            if (
              refundPartialAmount.trim() &&
              (partial === null || partial <= 0)
            ) {
              setActionError("Enter a valid refund amount (e.g. 12.50), or clear it for a full refund.");
            } else if (partial !== null && typeof remaining === "number" && partial > remaining) {
              setActionError(
                `The partial amount exceeds the ${formatMinorAmount(remaining, data?.currency || "usd")} still refundable on this invoice.`,
              );
            }
          }
        }
      } catch {
        setActionError("Failed to load refund preview.");
        setRefundPreview({ refundable: false });
      } finally {
        setRefundPreviewLoading(false);
      }
      return;
    }
    if (action === "change_plan") {
      setPlanPreview(null);
      setPlanPreviewLoading(true);
      setPendingAction(action);
      try {
        const qs = `?targetPlan=${encodeURIComponent(planTarget)}&targetInterval=${encodeURIComponent(planInterval)}`;
        const res = await fetch(`/api/subscriptions/${detail.id}/change-plan${qs}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const { message } = await readAdminApiError(res, "Failed to load plan-change preview.");
          setActionError(message);
          setPlanPreview({ changeable: false });
        } else {
          setPlanPreview(data);
          if (!data?.changeable) {
            const reasonMessage =
              data?.reason === "already_on_plan"
                ? "This subscription is already on the selected plan and interval."
                : data?.reason === "price_not_configured"
                  ? "No Stripe price is configured for the selected plan/interval. Configure it in Runtime Config first."
                  : data?.reason === "inactive_subscription"
                    ? "Plan changes are only available on an active subscription."
                    : data?.reason === "no_billable_item"
                      ? "This subscription has no billable item to re-price."
                      : "This subscription cannot change plan.";
            setActionError(reasonMessage);
          }
        }
      } catch {
        setActionError("Failed to load plan-change preview.");
        setPlanPreview({ changeable: false });
      } finally {
        setPlanPreviewLoading(false);
      }
      return;
    }
    setPendingAction(action);
  }

  function closeAction() {
    if (actionBusy) return;
    setPendingAction(null);
    setActionError(null);
    setActionRequiresMfa(false);
    setRefundPreview(null);
    setPlanPreview(null);
  }

  async function confirmAction(_password: string, stepUp: StepUpValues) {
    if (!detail || !pendingAction) return;
    const cfg = actionConfig(pendingAction, detail);
    if (!cfg) return;
    // Block the refund submit if there is nothing refundable.
    if (pendingAction === "refund" && !refundPreview?.refundable) {
      setActionError("There is no refundable invoice for this subscription.");
      return;
    }
    // Block the plan-change submit if the previewed change isn't applicable.
    if (pendingAction === "change_plan" && !planPreview?.changeable) {
      setActionError("This plan change cannot be applied. Review the selection.");
      return;
    }
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(cfg.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cfg.body, ...stepUp }),
      });
      if (!res.ok) {
        const { message, requiresMfa } = await readAdminApiError(res, "Action failed.");
        setActionError(message);
        setActionRequiresMfa(requiresMfa);
        toast.error(message);
        return;
      }
      const data = await res.json().catch(() => ({}));
      // Refund returns no subscription row; everything else returns the updated row.
      if (pendingAction === "refund") {
        toast.success(
          typeof data?.amount === "number"
            ? `Refunded ${formatMinorAmount(data.amount, data.currency || "usd")}${data?.refundKind === "partial" ? " (partial)" : ""}.`
            : "Refund issued.",
        );
      } else if (pendingAction === "change_plan") {
        toast.success(
          data?.plan
            ? `Plan changed to ${planLabel(data.plan)} (${intervalLabel(data.billingInterval)}).`
            : "Plan changed.",
        );
      } else if (pendingAction === "revalidate" && data?.revalidated === false) {
        toast.error(data?.error || "Stored receipt credential is missing.");
      } else {
        toast.success("Action completed.");
      }
      // Merge the updated row into the open detail + the table.
      if (data?.subscription) {
        const next = { ...detail, ...data.subscription } as Sub;
        setDetail(next);
        setSubs((prev) => prev.map((s) => (s.id === next.id ? { ...s, ...data.subscription } : s)));
      }
      setPendingAction(null);
      setActionRequiresMfa(false);
      setRefundPreview(null);
      setPlanPreview(null);
      // Refresh stats/counts after a mutation.
      fetchSubs();
    } catch {
      setActionError("Action failed.");
      toast.error("Action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  const pendingCfg = detail && pendingAction ? actionConfig(pendingAction, detail) : null;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Billing"
        title="<em>Subscriptions</em>"
        subtitle={`${total} subscription${total !== 1 ? "s" : ""} found`}
      />

      {/* Top-level tabs: the day-to-day LIST vs the MRR/churn drill-down. */}
      <div className="flex gap-2 border-b border-border">
        {([["list", "Subscriptions"], ["analytics", "MRR & Churn"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${view === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "analytics" ? (
        <AnalyticsPanel
          data={analytics}
          loading={analyticsLoading}
          error={analyticsError}
          onRetry={() => { setAnalyticsError(null); fetchAnalytics(); }}
        />
      ) : (
      <>
      {/* KPI Cards — Active / Trialing / Canceled cards double as status filters. */}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{stats.totalAll}</p>
                </div>
                <div className="rounded-lg bg-tone-sky-bg p-2"><CreditCard className="h-4 w-4 text-tone-sky-fg" /></div>
              </div>
            </div>
            <button onClick={() => { setFilters({ ...filters, status: filters.status === "ACTIVE" ? "" : "ACTIVE" }); setPage(1); }}
              className={`rounded-xl border bg-card p-4 text-left transition-all ${filters.status === "ACTIVE" ? "border-tone-sage-br bg-tone-sage-bg" : "border-border hover:border-tone-sage-br"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Active{filters.status === "ACTIVE" ? " · filtered" : ""}</p>
                  <p className="mt-1 text-2xl font-bold text-tone-sage-fg">{stats.activeCount}</p>
                </div>
                <div className="rounded-lg bg-tone-sage-bg p-2"><CheckCircle2 className="h-4 w-4 text-tone-sage-fg" /></div>
              </div>
            </button>
            <button onClick={() => { setFilters({ ...filters, status: filters.status === "TRIALING" ? "" : "TRIALING" }); setPage(1); }}
              className={`rounded-xl border bg-card p-4 text-left transition-all ${filters.status === "TRIALING" ? "border-tone-cyan-br bg-tone-cyan-bg" : "border-border hover:border-tone-cyan-br"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Trialing{filters.status === "TRIALING" ? " · filtered" : ""}</p>
                  <p className="mt-1 text-2xl font-bold text-tone-cyan-fg">{stats.trialingCount}</p>
                </div>
                <div className="rounded-lg bg-tone-cyan-bg p-2"><Clock className="h-4 w-4 text-tone-cyan-fg" /></div>
              </div>
            </button>
            <button onClick={() => { setFilters({ ...filters, status: filters.status === "CANCELED" ? "" : "CANCELED" }); setPage(1); }}
              className={`rounded-xl border bg-card p-4 text-left transition-all ${filters.status === "CANCELED" ? "border-destructive/30 bg-destructive/5" : "border-border hover:border-destructive/20"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Canceled{filters.status === "CANCELED" ? " · filtered" : ""}</p>
                  <p className="mt-1 text-2xl font-bold text-destructive">{stats.canceledCount}</p>
                </div>
                <div className="rounded-lg bg-destructive/10 p-2"><XCircle className="h-4 w-4 text-destructive" /></div>
              </div>
            </button>
            <button onClick={() => { setFilters({ ...filters, status: filters.status === "PAST_DUE" ? "" : "PAST_DUE" }); setPage(1); }}
              title="Needs attention — PAST_DUE / GRACE_PERIOD / UNPAID payments to recover"
              className={`rounded-xl border bg-card p-4 text-left transition-all ${filters.status === "PAST_DUE" ? "border-tone-honey-br bg-tone-honey-bg" : "border-border hover:border-tone-honey-br"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Needs Attention{filters.status === "PAST_DUE" ? " · filtered" : ""}</p>
                  <p className="mt-1 text-2xl font-bold text-tone-honey-fg">{stats.pastDueCount ?? 0}</p>
                </div>
                <div className="rounded-lg bg-tone-honey-bg p-2"><AlertTriangle className="h-4 w-4 text-tone-honey-fg" /></div>
              </div>
            </button>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">New This Month</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{stats.newThisMonth}</p>
                </div>
                <div className="rounded-lg bg-tone-foil-bg p-2"><TrendingUp className="h-4 w-4 text-tone-foil-fg" /></div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Click Active / Trialing / Canceled / Needs Attention to filter by status. Needs Attention covers PAST_DUE, GRACE_PERIOD, and UNPAID — the payments to recover. Plan, source, and platform live in the filters panel.
          </p>
        </>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search by user name or email..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${showFilters ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
          <Filter className="h-3.5 w-3.5" /> Filters {activeFilterCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeFilterCount}</span>}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={() => { setFilters({ plan: "", status: "", provider: "", platform: "", accessType: "", dateFrom: "", dateTo: "" }); setPage(1); }} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Plan</label>
              <select value={filters.plan} onChange={(e) => { setFilters({ ...filters, plan: e.target.value }); setPage(1); }} className={inputCls}>
                <option value="">All Plans</option>
                <option value="FREE_TRIAL">Free Trial</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="FAMILY">Family</option>
                <option value="PRO">Pro</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Provider</label>
              <select value={filters.provider} onChange={(e) => { setFilters({ ...filters, provider: e.target.value }); setPage(1); }} className={inputCls}>
                <option value="">All Providers</option>
                <option value="TRIAL">Trial</option>
                <option value="STRIPE">Stripe</option>
                <option value="APP_STORE">App Store</option>
                <option value="PLAY_STORE">Play Store</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Platform</label>
              <select value={filters.platform} onChange={(e) => { setFilters({ ...filters, platform: e.target.value }); setPage(1); }} className={inputCls}>
                <option value="">All Platforms</option>
                <option value="web">Web</option>
                <option value="ios">iOS</option>
                <option value="android">Android</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Access Type</label>
              <select value={filters.accessType} onChange={(e) => { setFilters({ ...filters, accessType: e.target.value }); setPage(1); }} className={inputCls}>
                <option value="">All Access</option>
                <option value="PAID">Paid</option>
                <option value="FREE_TRIAL">Free Trial</option>
                <option value="FREE_ACCESS">Free Access</option>
                <option value="none">Unassigned</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">From Date</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setPage(1); }} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">To Date</label>
              <input type="date" value={filters.dateTo} onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value }); setPage(1); }} className={inputCls} />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Store health (App Store / Play Store) reflects recorded transaction identifiers and last validation timestamps only; live verification requires production credentials.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Recorded Health</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Trial Ends</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Period End</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Created</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Loading...</td></tr>
            ) : subs.length === 0 ? (
              <tr><td colSpan={9} className="px-4"><EmptyState icon={CreditCard} title="No subscriptions found" description="No subscriptions match your current search or filters." /></td></tr>
            ) : subs.map((sub) => {
              const trialDays = daysUntil(sub.trialEndsAt);
              const opsStatus = getOpsStatus(sub);
              return (
                <tr key={sub.id} className="bg-card hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground text-sm">{sub.user.firstName} {sub.user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{maskEmail(sub.user.email)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PLAN_COLORS[sub.plan] || "bg-muted text-muted-foreground"}`}>
                      {sub.plan.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground">{sub.provider || "UNKNOWN"}</p>
                    <p className="text-[11px] text-muted-foreground">{sub.platform || "unassigned"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[sub.status] || "bg-muted text-muted-foreground"}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${opsStatus.cls}`}>
                      {opsStatus.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {sub.trialEndsAt ? (
                      <span className={trialDays !== null && trialDays <= 3 ? "text-destructive font-medium" : trialDays !== null && trialDays <= 7 ? "text-tone-honey-fg" : ""}>
                        {new Date(sub.trialEndsAt).toLocaleDateString()}
                        {trialDays !== null && trialDays > 0 && <span className="ml-1">({trialDays}d)</span>}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {sub.stripeCurrentPeriodEnd ? new Date(sub.stripeCurrentPeriodEnd).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(sub.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDetail(sub)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="View details" aria-label="View details">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => window.location.assign(`/users/${sub.user.id}`)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="View user" aria-label="View user">
                        <Users className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50" aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm text-muted-foreground">Page {page} / {totalPages}</span>
            <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50" aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      </>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm" role="presentation" onClick={() => setDetail(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="subscription-detail-title" className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 id="subscription-detail-title" className="text-lg font-semibold text-foreground">Subscription Detail</h2>
              <button aria-label="Close detail" onClick={() => setDetail(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <div className="rounded-lg bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="font-medium text-foreground text-sm">{detail.user.firstName} {detail.user.lastName}</p>
                  <p className="text-xs text-muted-foreground">{maskEmail(detail.user.email)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailItem label="Plan" value={detail.plan.replace("_", " ")} />
                <DetailItem label="Status" value={detail.status} />
                <DetailItem label="Provider" value={detail.provider || "UNKNOWN"} />
                <DetailItem label="Platform" value={detail.platform || "unassigned"} />
                <DetailItem label="Created" value={new Date(detail.createdAt).toLocaleDateString()} />
                <DetailItem label="Updated" value={new Date(detail.updatedAt).toLocaleDateString()} />
                <DetailItem label="Trial Ends" value={detail.trialEndsAt ? new Date(detail.trialEndsAt).toLocaleDateString() : "—"} />
                <DetailItem label="Canceled At" value={detail.canceledAt ? new Date(detail.canceledAt).toLocaleDateString() : "—"} />
                <DetailItem label="Period End" value={detail.stripeCurrentPeriodEnd ? new Date(detail.stripeCurrentPeriodEnd).toLocaleDateString() : "—"} />
                <DetailItem label="Stripe Customer" value={maskProviderIdentifier(detail.stripeCustomerId)} />
                <DetailItem label="Last Validated" value={detail.lastValidatedAt ? new Date(detail.lastValidatedAt).toLocaleString() : "Never"} />
                <DetailItem label="Last Synced" value={detail.lastSyncedAt ? new Date(detail.lastSyncedAt).toLocaleString() : "Never"} />
              </div>

              {detail.stripeSubscriptionId && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Stripe Subscription ID</p>
                  <p className="text-xs text-foreground font-mono break-all">{maskProviderIdentifier(detail.stripeSubscriptionId)}</p>
                </div>
              )}

              {/* ── Invoice / payment history (read-only) ── */}
              <InvoiceHistory
                supported={invoicesSupported}
                loading={invoicesLoading}
                error={invoicesError}
                invoices={invoices}
              />

              {/* ── Lifecycle actions — each opens the step-up confirm modal ── */}
              {(isStripe || isStore) && (
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Lifecycle actions</p>
                  <div className="flex flex-wrap gap-2">
                    {stripeCancellable && (
                      <>
                        <button
                          onClick={() => openAction("cancel_period_end")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                          title="Cancel renewal at the end of the current period"
                        >
                          <Clock className="h-3.5 w-3.5" /> Cancel at period end
                        </button>
                        <button
                          onClick={() => openAction("cancel_now")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                          title="Cancel immediately — access ends now"
                        >
                          <Ban className="h-3.5 w-3.5" /> Cancel now
                        </button>
                      </>
                    )}
                    {isStripe && (
                      <button
                        onClick={() => openAction("resync")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                        title="Re-fetch from Stripe and overwrite local status/plan/period"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Force re-sync
                      </button>
                    )}
                    {isStore && (
                      <button
                        onClick={() => openAction("revalidate")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                        title="Re-read the stored receipt and refresh recorded health"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Re-validate receipt
                      </button>
                    )}
                  </div>

                  {/* ── Change plan (Stripe only) ── */}
                  {isStripe && stripeCancellable && (
                    <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Change plan</p>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Plan</label>
                          <select
                            value={planTarget}
                            onChange={(e) => setPlanTarget(e.target.value as ChangePlanTarget)}
                            className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {CHANGE_PLAN_OPTIONS.map((p) => (
                              <option key={p} value={p}>{planLabel(p)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Interval</label>
                          <select
                            value={planInterval}
                            onChange={(e) => setPlanInterval(e.target.value as ChangePlanInterval)}
                            className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="MONTH">Monthly</option>
                            <option value="YEAR">Yearly</option>
                          </select>
                        </div>
                        <button
                          onClick={() => openAction("change_plan")}
                          disabled={
                            planTarget === ((CHANGE_PLAN_OPTIONS as readonly string[]).includes(detail.plan) ? detail.plan : "") &&
                            planInterval === (detail.billingInterval === "YEAR" ? "YEAR" : "MONTH")
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
                          title="Move this subscription to the selected plan/interval with proration"
                        >
                          <Repeat className="h-3.5 w-3.5" /> Change to {planLabel(planTarget)}
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        The exact Stripe price is resolved server-side from billing config. Upgrades charge proration immediately; the confirm dialog states the exact change and amount.
                      </p>
                    </div>
                  )}

                  {/* ── Refund (Stripe only) — latest or a picked invoice, full or partial ── */}
                  {isStripe && (
                    <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <Undo2 className="h-3.5 w-3.5 text-destructive" />
                        <p className="text-[11px] font-medium uppercase tracking-wide text-destructive">Refund</p>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Invoice</label>
                          <select
                            value={refundInvoiceNumber ?? ""}
                            onChange={(e) => setRefundInvoiceNumber(e.target.value || null)}
                            className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">Latest paid invoice</option>
                            {(invoices || [])
                              .filter((inv) => inv.paid && inv.number)
                              .map((inv) => (
                                <option key={inv.number} value={inv.number as string}>
                                  {inv.number} · {formatMinorAmount(inv.amountPaid, inv.currency)}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Amount (blank = full)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="e.g. 12.50"
                            value={refundPartialAmount}
                            onChange={(e) => setRefundPartialAmount(e.target.value)}
                            className="w-28 rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <button
                          onClick={() => openAction("refund")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                          title="Refund the selected invoice (full or partial)"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Refund{refundPartialAmount.trim() ? " partial" : ""}
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Leave the amount blank for a full refund of the selected invoice. The confirm dialog states the exact amount and invoice before money moves.
                      </p>
                    </div>
                  )}

                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Each action requires admin password + MFA step-up and is written to the audit log. Money-moving actions (cancel now, refund, plan change) state the exact impact before you confirm.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                {detail.provider === "STRIPE" && stripeDashboardUrl(detail.stripeCustomerId) ? (
                  <a
                    href={stripeDashboardUrl(detail.stripeCustomerId) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
                    title="Open this customer in the Stripe Dashboard"
                  >
                    Open in Stripe ↗
                  </a>
                ) : null}
                <button onClick={() => { setDetail(null); window.location.assign(`/users/${detail.user.id}`); }}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                  View User Profile
                </button>
                <button onClick={() => setDetail(null)} className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step-up confirm modal — gates EVERY lifecycle mutation. */}
      <PasswordConfirmModal
        open={Boolean(pendingAction && pendingCfg)}
        title={pendingCfg?.title || "Confirm action"}
        description={
          pendingAction === "refund" && refundPreviewLoading
            ? "Loading the refundable amount…"
            : pendingAction === "change_plan" && planPreviewLoading
              ? "Resolving the target price and proration…"
              : pendingCfg?.description || ""
        }
        confirmLabel={pendingCfg?.confirmLabel || "Confirm"}
        busy={actionBusy}
        error={actionError}
        requiresMfa={actionRequiresMfa}
        onClose={closeAction}
        onConfirm={confirmAction}
      />
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

/** Format a USD dollar number (already in dollars, not minor units). */
function formatUsd(amount: number): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * Per-subscription INVOICE / PAYMENT history. Read-only: it lists Stripe
 * invoices (amount, date, status) with links to the canonical hosted invoice,
 * PDF, and charge receipt. No raw provider IDs or card data are shown.
 */
function InvoiceHistory({
  supported,
  loading,
  error,
  invoices,
}: {
  supported: boolean;
  loading: boolean;
  error: string | null;
  invoices: InvoiceEntry[] | null;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Invoice &amp; payment history</p>
      </div>

      {loading ? (
        <p className="py-3 text-center text-xs text-muted-foreground">Loading invoices…</p>
      ) : error ? (
        <p className="py-3 text-center text-xs text-destructive">{error}</p>
      ) : !supported ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Invoice history is only available for Stripe subscriptions.
        </p>
      ) : !invoices || invoices.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">No invoices found for this subscription.</p>
      ) : (
        <ul className="divide-y divide-border">
          {invoices.map((inv) => {
            const statusCls = INVOICE_STATUS_COLORS[inv.status || ""] || "bg-muted text-muted-foreground";
            const displayAmount = inv.paid ? inv.amountPaid : inv.amountDue;
            return (
              <li key={inv.maskedInvoiceId + (inv.number || "")} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {formatMinorAmount(displayAmount, inv.currency)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCls}`}>
                      {inv.status || "unknown"}
                    </span>
                    {inv.refunded && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">refunded</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {inv.number ? `${inv.number} · ` : ""}
                    {inv.created ? new Date(inv.created).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {inv.hostedInvoiceUrl && (
                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Open hosted invoice" aria-label="Open hosted invoice">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {inv.invoicePdfUrl && (
                    <a href={inv.invoicePdfUrl} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Download invoice PDF" aria-label="Download invoice PDF">
                      <FileText className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {inv.receiptUrl && (
                    <a href={inv.receiptUrl} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="View payment receipt" aria-label="View payment receipt">
                      <Receipt className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Read-only — sourced live from Stripe. Links open the canonical hosted invoice, PDF, or receipt.
      </p>
    </div>
  );
}

/** Small labeled-delta helper for a month-over-month figure. */
function TrendDelta({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(pct) || Math.round(pct) === 0) return null;
  // For "good when down" metrics (churn), invert the color sense.
  const good = invert ? pct < 0 : pct > 0;
  const Icon = pct > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${good ? "text-tone-sage-fg" : "text-destructive"}`}>
      <Icon className="h-3 w-3" />
      {pct > 0 ? "+" : ""}{Math.round(pct)}%
    </span>
  );
}

/**
 * MRR / CHURN drill-down. Renders the read-only analytics computed from local
 * Subscription data: MRR trend sparkline, new-vs-churned MRR, ARPU by plan, and
 * trial → paid conversion. Matches the dashboard's KPI-card + bar-chart idioms.
 */
function AnalyticsPanel({
  data,
  loading,
  error,
  onRetry,
}: {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading MRR &amp; churn analytics…</div>;
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={onRetry} className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">
          Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  const { totals, mrrMovement, arpuByPlan, trialConversion, mrrTrend } = data;
  const maxTrend = Math.max(...mrrTrend.map((p) => p.mrr), 1);
  const maxPlanMrr = Math.max(...arpuByPlan.map((p) => p.mrr), 1);

  const kpis = [
    { label: "MRR", value: formatUsd(totals.mrr), icon: DollarSign, color: "text-tone-sage-fg", bg: "bg-tone-sage-bg", sub: `ARR ${formatUsd(totals.arr)}` },
    { label: "Paying Subs", value: totals.payingSubscriptions.toLocaleString(), icon: Users, color: "text-tone-sky-fg", bg: "bg-tone-sky-bg", sub: `of ${totals.activeSubscriptions} active` },
    { label: "Churn Rate", value: `${totals.churnRate}%`, icon: totals.churnRate > totals.lastMonthChurn ? TrendingDown : TrendingUp, color: totals.churnRate > 5 ? "text-destructive" : "text-tone-sage-fg", bg: totals.churnRate > 5 ? "bg-destructive/10" : "bg-tone-sage-bg", sub: `Last month ${totals.lastMonthChurn}%` },
    { label: "Net New MRR", value: formatUsd(mrrMovement.thisMonth.netMrr), icon: mrrMovement.thisMonth.netMrr >= 0 ? ArrowUpRight : ArrowDownRight, color: mrrMovement.thisMonth.netMrr >= 0 ? "text-tone-sage-fg" : "text-destructive", bg: mrrMovement.thisMonth.netMrr >= 0 ? "bg-tone-sage-bg" : "bg-destructive/10", sub: "This month" },
  ];

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
                {k.sub && <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>}
              </div>
              <div className={`rounded-lg p-2.5 ${k.bg}`}><k.icon className={`h-5 w-5 ${k.color}`} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* MRR trend (trailing 12 months) */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">MRR Trend</h3>
          <span className="text-[11px] text-muted-foreground">Trailing 12 months · estimated</span>
        </div>
        <div className="flex h-40 items-end gap-1.5">
          {mrrTrend.map((p) => (
            <div key={p.month} className="group flex flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-t bg-tone-sage-fg/70 transition-all group-hover:bg-tone-sage-fg"
                style={{ height: `${Math.max((p.mrr / maxTrend) * 100, 2)}%` }}
                title={`${p.month}: ${formatUsd(p.mrr)}`}
              />
              <span className="text-[9px] text-muted-foreground">{p.month.slice(5)}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Each month is priced with subscriptions&apos; current plan/interval (no historical price snapshot) — a trend estimate, not a ledger.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* New vs churned MRR */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">New vs Churned MRR</h3>
          <div className="space-y-4">
            {(
              [
                ["This month", mrrMovement.thisMonth, mrrMovement.lastMonth],
                ["Last month", mrrMovement.lastMonth, null],
              ] as const
            ).map(([label, m, prev]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className={`font-medium ${m.netMrr >= 0 ? "text-tone-sage-fg" : "text-destructive"}`}>
                      net {formatUsd(m.netMrr)}
                    </span>
                    {prev && <TrendDelta current={m.netMrr} previous={prev.netMrr} />}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-tone-sage-fg">
                    <ArrowUpRight className="h-3 w-3" /> +{formatUsd(m.newMrr)} new
                  </span>
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <ArrowDownRight className="h-3 w-3" /> −{formatUsd(m.churnedMrr)} churned
                  </span>
                </div>
                {/* Stacked proportion bar */}
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted">
                  {(() => {
                    const denom = m.newMrr + m.churnedMrr || 1;
                    return (
                      <>
                        <div className="bg-tone-sage-fg" style={{ width: `${(m.newMrr / denom) * 100}%` }} />
                        <div className="bg-destructive" style={{ width: `${(m.churnedMrr / denom) * 100}%` }} />
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trial → paid conversion */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Trial → Paid Conversion</h3>
          <div className="space-y-4">
            {(
              [
                ["This month", trialConversion.thisMonth, trialConversion.lastMonth],
                ["Last month", trialConversion.lastMonth, null],
              ] as const
            ).map(([label, c, prev]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    {c.conversionRatePct}%
                    {prev && <TrendDelta current={c.conversionRatePct} previous={prev.conversionRatePct} />}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {c.converted} of {c.trialsStarted} trial{c.trialsStarted === 1 ? "" : "s"} converted to a paying plan
                </p>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-tone-cyan-fg" style={{ width: `${Math.min(c.conversionRatePct, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Cohorted by trial start (subs created in the window with a trial). Subs still inside their trial stay in the denominator until they convert or lapse.
          </p>
        </div>
      </div>

      {/* ARPU by plan */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">ARPU by Plan</h3>
        {arpuByPlan.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">No active subscriptions to break down.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-medium uppercase text-muted-foreground">Plan</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium uppercase text-muted-foreground">Active</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium uppercase text-muted-foreground">Paying</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium uppercase text-muted-foreground">MRR</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium uppercase text-muted-foreground">ARPU</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium uppercase text-muted-foreground">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {arpuByPlan.map((row) => (
                  <tr key={row.plan} className="bg-card">
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PLAN_COLORS[row.plan] || "bg-muted text-muted-foreground"}`}>
                        {row.plan.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-foreground">{row.activeCount}</td>
                    <td className="px-4 py-2 text-right text-xs text-foreground">{row.payingCount}</td>
                    <td className="px-4 py-2 text-right text-xs font-medium text-foreground">{formatUsd(row.mrr)}</td>
                    <td className="px-4 py-2 text-right text-xs font-medium text-foreground">{formatUsd(row.arpu)}</td>
                    <td className="px-4 py-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-tone-sky-fg" style={{ width: `${(row.mrr / maxPlanMrr) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          ARPU divides realized plan MRR by paying active subs (non-zero monthly equivalent); trials and free grants are excluded so they don&apos;t dilute the figure.
        </p>
      </div>
    </div>
  );
}
