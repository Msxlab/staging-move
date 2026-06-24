"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Calendar, ChevronLeft, ChevronRight, CheckCircle2, Copy, Pause, Pencil, Play, Plus, RefreshCw, Save, Search, Square, Ticket, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";

type Campaign = {
  id: string;
  name: string;
  code: string;
  status: string;
  accessType: "FREE_ACCESS" | "FREE_TRIAL" | "PAID";
  billingInterval: "YEAR" | "MONTH" | null;
  trialDays: number | null;
  freeAccessDays: number | null;
  displayPriceLabel: string | null;
  stripePriceId: string | null;
  requiresPaymentMethod: boolean;
  autoRenew: boolean;
  newUsersOnly: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  internalNotes: string | null;
  publicHeadline: string;
  publicSubheadline: string | null;
  checkoutDisclosureCopy: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdByAdmin?: { email: string; firstName?: string | null; lastName?: string | null } | null;
  redemptions?: Array<{ id: string; createdAt: string; user?: { id: string; email: string } }>;
};

type RedemptionRow = {
  id: string;
  createdAt: string;
  status: string;
  accessType: string;
  user?: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null;
  subscription?: { id: string; status: string; trialEndsAt?: string | null; freeAccessEndsAt?: string | null } | null;
};

type PriceValidationFeedback = {
  ok: boolean;
  warning?: string;
  error?: string;
  skipped?: boolean;
  canonicalDisplayPriceLabel?: string | null;
  price?: {
    currency: string;
    interval: string | null;
  };
} | null;

const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

// Every campaign mutation (create/edit/activate-status-change/duplicate/delete)
// binds or rewrites a LIVE Stripe price + public pricing copy, so each is gated
// behind admin password + MFA step-up. `PendingMutation` captures everything the
// confirm handler needs to replay the request with the step-up credentials
// merged in once the operator confirms in the PasswordConfirmModal.
type PendingMutation =
  | { kind: "save"; method: "POST" | "PATCH"; url: string; payload: Record<string, unknown>; title: string; description: string; confirmLabel: string }
  | { kind: "status"; url: string; payload: Record<string, unknown>; title: string; description: string; confirmLabel: string }
  | { kind: "duplicate"; url: string; payload: Record<string, unknown>; title: string; description: string; confirmLabel: string }
  | { kind: "delete"; url: string; payload: Record<string, unknown>; title: string; description: string; confirmLabel: string };

const emptyForm = {
  name: "",
  code: "",
  accessType: "FREE_TRIAL",
  billingInterval: "YEAR",
  trialDays: "14",
  freeAccessDays: "30",
  stripePriceId: "",
  displayPriceLabel: "",
  publicHeadline: "",
  publicSubheadline: "",
  checkoutDisclosureCopy: "",
  newUsersOnly: true,
  maxRedemptions: "",
  startsAt: "",
  endsAt: "",
  internalNotes: "",
};

const annualTrialPreset: typeof emptyForm = {
  ...emptyForm,
  name: "Individual Annual - 14-day trial",
  code: "INDIVIDUAL90",
  accessType: "FREE_TRIAL",
  billingInterval: "YEAR",
  trialDays: "14",
  displayPriceLabel: "$24/year",
  publicHeadline: "Start with 14 days free",
  publicSubheadline: "Individual Annual starts after your trial.",
  checkoutDisclosureCopy: "Today: $0. Trial: 14 days. Your annual plan starts after the trial. You can cancel before then in Settings.",
};

// LocateFlow is free for everyone (affiliate-funded), so the public-facing
// defaults here are deliberately NOT paywall copy. The Monthly Paid slot is a
// dormant, reversible legacy mechanism: the access type / billing fields stay
// intact so an operator can still bind a real Stripe price if the free pivot is
// ever reverted, but the DEFAULT public copy must never advertise
// "Subscribe / $X per month / upgrade" onto the now-free public site. An
// operator who genuinely needs paid copy must type it deliberately.
const monthlyPaidPreset: typeof emptyForm = {
  ...emptyForm,
  name: "Individual Monthly (legacy / dormant)",
  code: "INDIVIDUALMONTHLY",
  accessType: "PAID",
  billingInterval: "MONTH",
  trialDays: "",
  // Active default shows NO paywall price under the free pivot. For the
  // dormant/reversible binding the canonical Individual Monthly price is
  // $4.99/month — an operator re-enabling paid copy must set displayPriceLabel
  // to that canonical value deliberately (kept here so it can never drift to a
  // stale price, and asserted by plan-compare-table.test.tsx).
  displayPriceLabel: "",
  publicHeadline: "Free for everyone",
  publicSubheadline: "Every feature is free, funded by affiliate partners — not a subscription.",
  checkoutDisclosureCopy: "LocateFlow is free. We may earn a commission when you choose a provider through LocateFlow, at no extra cost to you.",
  newUsersOnly: false,
};

const freeAccessPreset: typeof emptyForm = {
  ...emptyForm,
  name: "Individual Free Access",
  code: "FREEACCESS",
  accessType: "FREE_ACCESS",
  billingInterval: "YEAR",
  freeAccessDays: "30",
  displayPriceLabel: "",
  publicHeadline: "Free Access",
  publicSubheadline: "No payment method required.",
  checkoutDisclosureCopy: "Free Access does not require a payment method and does not auto-renew.",
};

function formatDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function campaignToForm(campaign: Campaign) {
  return {
    name: campaign.name || "",
    code: campaign.code || "",
    accessType: campaign.accessType || "FREE_TRIAL",
    billingInterval: campaign.billingInterval || (campaign.accessType === "PAID" ? "MONTH" : "YEAR"),
    trialDays: String(campaign.trialDays || 14),
    freeAccessDays: String(campaign.freeAccessDays || 30),
    stripePriceId: campaign.stripePriceId || "",
    displayPriceLabel: campaign.displayPriceLabel || "",
    publicHeadline: campaign.publicHeadline || "",
    publicSubheadline: campaign.publicSubheadline || "",
    checkoutDisclosureCopy: campaign.checkoutDisclosureCopy || "",
    newUsersOnly: campaign.newUsersOnly !== false,
    maxRedemptions: campaign.maxRedemptions ? String(campaign.maxRedemptions) : "",
    startsAt: formatDateTimeInput(campaign.startsAt),
    endsAt: formatDateTimeInput(campaign.endsAt),
    internalNotes: campaign.internalNotes || "",
  };
}

function buildCampaignPayload(form: typeof emptyForm) {
  const normalizedAccessType = form.accessType === "FREE_ACCESS"
    ? "FREE_ACCESS"
    : form.accessType === "PAID"
      ? "PAID"
      : "FREE_TRIAL";
  const paymentRequired = normalizedAccessType === "FREE_TRIAL" || normalizedAccessType === "PAID";
  return {
    ...form,
    accessType: normalizedAccessType,
    billingInterval: normalizedAccessType === "FREE_TRIAL"
      ? "YEAR"
      : normalizedAccessType === "PAID"
        ? form.billingInterval
        : null,
    trialDays: normalizedAccessType === "FREE_TRIAL" ? Number(form.trialDays || 14) : null,
    freeAccessDays: normalizedAccessType === "FREE_ACCESS" ? Number(form.freeAccessDays || 30) : null,
    stripePriceId: paymentRequired ? form.stripePriceId : "",
    maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
    internalNotes: form.internalNotes || null,
  };
}

function isCampaignLive(campaign: Campaign, now: Date) {
  if (campaign.status !== "ACTIVE") return false;
  const startsAt = campaign.startsAt ? new Date(campaign.startsAt) : null;
  const endsAt = campaign.endsAt ? new Date(campaign.endsAt) : null;
  if (startsAt && startsAt > now) return false;
  // Match the public reader / redeem semantics: a campaign at exactly its
  // endsAt instant is already ended (endsAt <= now), so the slot card must
  // not advertise it as Live while redemption would be refused.
  if (endsAt && endsAt <= now) return false;
  return true;
}

function SlotCard({
  title,
  description,
  campaign,
  emptyHint,
  onCreate,
  onEdit,
  createLabel,
}: {
  title: string;
  description: string;
  campaign: Campaign | null;
  emptyHint: string;
  onCreate: () => void;
  onEdit: (campaign: Campaign) => void;
  createLabel: string;
}) {
  const live = Boolean(campaign);
  return (
    <div
      className={`rounded-2xl border p-5 ${
        live ? "border-tone-emerald-br bg-tone-emerald-bg" : "border-tone-honey-br bg-tone-honey-bg"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${live ? "bg-tone-emerald-bg text-tone-emerald-fg" : "bg-tone-honey-bg text-tone-honey-fg"}`}>
              {live ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {live ? "Live" : "Empty"}
            </span>
          </div>
        </div>
        {live && campaign ? (
          <button
            type="button"
            onClick={() => onEdit(campaign)}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> {createLabel}
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{description}</p>
      {live && campaign ? (
        <div className="mt-3 space-y-1 text-sm">
          <p className="font-display text-base font-bold text-foreground">{campaign.name}</p>
          <p className="text-xs text-muted-foreground">
            Code: <span className="font-mono text-foreground">{campaign.code}</span>
            {campaign.displayPriceLabel ? ` · ${campaign.displayPriceLabel}` : ""}
            {campaign.accessType === "FREE_TRIAL" && campaign.trialDays ? ` · ${campaign.trialDays}-day trial` : ""}
          </p>
          {campaign.publicHeadline ? (
            <p className="text-xs italic text-muted-foreground">&ldquo;{campaign.publicHeadline}&rdquo;</p>
          ) : null}
          {campaign.endsAt ? (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" /> Ends <span className="font-mono">{new Date(campaign.endsAt).toLocaleDateString()}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  );
}

const PAGE_SIZE = 50;

export default function AcquisitionCampaignsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<"" | "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED">("");
  const [filterAccessType, setFilterAccessType] = useState<"" | "FREE_ACCESS" | "FREE_TRIAL" | "PAID">("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [validatingPrice, setValidatingPrice] = useState(false);
  const [priceValidation, setPriceValidation] = useState<PriceValidationFeedback>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"hidden" | "create" | "edit">("hidden");
  const [redemptionsFor, setRedemptionsFor] = useState<{ campaign: Campaign; rows: RedemptionRow[]; loading: boolean } | null>(null);
  // Step-up confirm modal state — `pendingMutation` drives the
  // PasswordConfirmModal; null means closed. `mutationRequiresMfa` is the
  // server handshake: the 403 sets it true so the modal flags the MFA field.
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationRequiresMfa, setMutationRequiresMfa] = useState(false);
  const editingCampaign = campaigns.find((campaign) => campaign.id === editingCampaignId) || null;

  const slots = useMemo(() => {
    const now = new Date();
    const live = campaigns.filter((campaign) => isCampaignLive(campaign, now));
    return {
      annualTrial: live.find((campaign) => campaign.accessType === "FREE_TRIAL" && campaign.billingInterval === "YEAR") || null,
      monthlyPaid: live.find((campaign) => campaign.accessType === "PAID" && campaign.billingInterval === "MONTH") || null,
      freeAccess: live.find((campaign) => campaign.accessType === "FREE_ACCESS") || null,
    };
  }, [campaigns]);

  // Multi-active conflicts: flag every slot where two ACTIVE campaigns
  // overlap, so editors notice before the public site silently picks
  // "most recently updated."
  const slotConflicts = useMemo(() => {
    const now = new Date();
    const live = campaigns.filter((campaign) => isCampaignLive(campaign, now));
    const grouped = new Map<string, Campaign[]>();
    for (const campaign of live) {
      const key = `${campaign.accessType}:${campaign.billingInterval ?? "null"}`;
      const list = grouped.get(key) ?? [];
      list.push(campaign);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries())
      .filter(([, list]) => list.length > 1)
      .map(([key, list]) => ({ key, campaigns: list }));
  }, [campaigns]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterAccessType) params.set("accessType", filterAccessType);
      if (searchQuery) params.set("q", searchQuery);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const response = await fetch(`/api/acquisition-campaigns?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load campaigns.");
      setCampaigns(data.campaigns || []);
      setTotal(data.total ?? (data.campaigns?.length || 0));
    } catch (error: any) {
      toast.error(error?.message || "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterAccessType, searchQuery, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to page 1 whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterAccessType, searchQuery]);

  async function loadRedemptions(campaign: Campaign) {
    setRedemptionsFor({ campaign, rows: [], loading: true });
    try {
      const response = await fetch(`/api/acquisition-campaigns/${campaign.id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load redemptions.");
      setRedemptionsFor({ campaign, rows: data.campaign?.redemptions || [], loading: false });
    } catch (error: any) {
      toast.error(error?.message || "Failed to load redemptions.");
      setRedemptionsFor(null);
    }
  }

  function requestDeleteCampaign(campaign: Campaign) {
    if (campaign.redemptionCount > 0) {
      toast.error("Cannot delete a campaign with redemptions. End it instead.");
      return;
    }
    openMutation({
      kind: "delete",
      url: `/api/acquisition-campaigns/${campaign.id}`,
      payload: {},
      title: "Delete campaign",
      description: `Campaign "${campaign.name}" (${campaign.code}) will be permanently deleted. This cannot be undone. Enter your admin password and MFA code or backup code to confirm.`,
      confirmLabel: "Delete campaign",
    });
  }

  // Open the step-up modal for a mutation, resetting any prior error/MFA hint.
  function openMutation(mutation: PendingMutation) {
    setMutationError(null);
    setMutationRequiresMfa(false);
    setPendingMutation(mutation);
  }

  function closeMutation() {
    if (mutationBusy) return;
    setPendingMutation(null);
    setMutationError(null);
    setMutationRequiresMfa(false);
  }

  // Replay the captured mutation with the step-up credentials merged into the
  // body. The server gates every mutating route with requirePasswordConfirm
  // ({ requireMfa: true }); a 403 with requiresMfa drives the modal handshake.
  async function confirmMutation(_password: string, stepUp: StepUpValues) {
    if (!pendingMutation) return;
    const mutation = pendingMutation;
    const method = mutation.kind === "save" ? mutation.method : mutation.kind === "delete" ? "DELETE" : "POST";
    setMutationBusy(true);
    setMutationError(null);
    try {
      const response = await fetch(mutation.url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...mutation.payload, ...stepUp }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const requiresMfa = Boolean(data?.requiresMfa);
        // Surface Stripe price-validation feedback in the inline banner the
        // same way the non-stepped-up paths used to.
        if (mutation.kind === "save" || mutation.kind === "status") {
          showPriceValidation(data.priceValidation || (data.code === "PRICE_VALIDATION_FAILED"
            ? { ok: false, error: data.error || "Stripe price validation failed." }
            : null));
        }
        const message = data.error || "Action failed.";
        setMutationError(message);
        setMutationRequiresMfa(requiresMfa);
        // Step-up failures stay in the modal so the operator can fix the
        // password/MFA; non-auth failures (e.g. price validation) close it.
        if (response.status !== 403 || !data?.requiresPassword) {
          toast.error(message);
          setPendingMutation(null);
        }
        return;
      }
      // Success — apply per-kind side effects, then close + refresh.
      if (mutation.kind === "save") {
        showPriceValidation(data.priceValidation || null);
        toast.success(mutation.method === "PATCH" ? "Campaign updated" : "Campaign created");
        resetForm();
        if (data.priceValidation?.warning) toast.warning(data.priceValidation.warning);
      } else if (mutation.kind === "status") {
        showPriceValidation(data.priceValidation || null);
        toast.success("Campaign updated");
      } else if (mutation.kind === "duplicate") {
        toast.success("Campaign duplicated as draft");
      } else {
        toast.success("Campaign deleted");
      }
      setPendingMutation(null);
      setMutationRequiresMfa(false);
      await load();
    } catch (error: any) {
      setMutationError(error?.message || "Action failed.");
      toast.error(error?.message || "Action failed.");
    } finally {
      setMutationBusy(false);
    }
  }

  function update(key: keyof typeof emptyForm, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateAccessType(value: string) {
    const accessType = value === "FREE_ACCESS" ? "FREE_ACCESS" : value === "PAID" ? "PAID" : "FREE_TRIAL";
    setForm((current) => {
      if (accessType === "PAID") {
        return {
          ...current,
          accessType,
          billingInterval: current.accessType === "PAID" ? current.billingInterval : "MONTH",
          displayPriceLabel: current.accessType === "PAID" ? current.displayPriceLabel : "",
          // Free/affiliate voice by default — never seed paywall copy onto the
          // now-free public site. PAID is legacy/dormant; an operator reverting
          // the free pivot must author paid copy deliberately.
          publicHeadline: current.accessType === "PAID" ? current.publicHeadline : "Free for everyone",
          publicSubheadline: current.accessType === "PAID" ? current.publicSubheadline : "Every feature is free, funded by affiliate partners.",
          checkoutDisclosureCopy: current.accessType === "PAID" ? current.checkoutDisclosureCopy : "LocateFlow is free. We may earn a commission when you choose a provider through LocateFlow, at no extra cost to you.",
        };
      }
      if (accessType === "FREE_ACCESS") {
        return {
          ...current,
          accessType,
          billingInterval: "YEAR",
          stripePriceId: "",
          displayPriceLabel: "",
          publicHeadline: current.accessType === "FREE_ACCESS" ? current.publicHeadline : "Free Access",
          publicSubheadline: current.accessType === "FREE_ACCESS" ? current.publicSubheadline : "No payment method required.",
          checkoutDisclosureCopy: current.accessType === "FREE_ACCESS" ? current.checkoutDisclosureCopy : "Free Access does not require a payment method and does not auto-renew.",
        };
      }
      return {
        ...current,
        accessType,
        billingInterval: "YEAR",
        displayPriceLabel: current.accessType === "FREE_TRIAL" ? current.displayPriceLabel : "$24/year",
        publicHeadline: current.accessType === "FREE_TRIAL" ? current.publicHeadline : "Start with 14 days free",
        publicSubheadline: current.accessType === "FREE_TRIAL" ? current.publicSubheadline : "Individual Annual starts after your trial.",
        checkoutDisclosureCopy: current.accessType === "FREE_TRIAL" ? current.checkoutDisclosureCopy : "Today: $0. Trial: 14 days. Your annual plan starts after the trial. You can cancel before then in Settings.",
      };
    });
  }

  function updateBillingInterval(value: string) {
    setForm((current) => ({
      ...current,
      billingInterval: value,
      displayPriceLabel: current.accessType === "PAID" ? "" : current.displayPriceLabel,
      // Switching the billing interval no longer reseeds subscription headlines:
      // the public site is free, so we keep whatever copy is present rather than
      // injecting "Subscribe annually / monthly" paywall defaults.
      publicHeadline: current.publicHeadline,
      publicSubheadline: current.publicSubheadline,
    }));
  }

  function showPriceValidation(feedback: PriceValidationFeedback) {
    setPriceValidation(feedback || null);
    if (!feedback) return;
    if (feedback.warning) {
      toast.warning(feedback.warning);
    } else if (feedback.error) {
      toast.error(feedback.error);
    } else if (feedback.canonicalDisplayPriceLabel) {
      const interval = feedback.price?.interval === "month" ? "monthly" : "annual";
      toast.success(`Stripe price validated: ${feedback.canonicalDisplayPriceLabel} USD, ${interval}`);
    }
  }

  function resetForm() {
    setEditingCampaignId(null);
    setForm(emptyForm);
    setPriceValidation(null);
    setFormMode("hidden");
  }

  function startEditing(campaign: Campaign) {
    setEditingCampaignId(campaign.id);
    setForm(campaignToForm(campaign));
    setPriceValidation(null);
    setFormMode("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startCreate(preset: typeof emptyForm) {
    setEditingCampaignId(null);
    setForm(preset);
    setPriceValidation(null);
    setFormMode("create");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function validatePriceOnly() {
    if (!form.stripePriceId.trim() && form.accessType !== "FREE_ACCESS") {
      toast.error("Stripe Price ID is required to validate.");
      return;
    }
    setValidatingPrice(true);
    try {
      const response = await fetch("/api/acquisition-campaigns/validate-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCampaignPayload(form)),
      });
      const data = await response.json();
      const feedback = data.priceValidation || (response.ok ? null : { ok: false, error: data.error || "Validation failed." });
      showPriceValidation(feedback);
      if (feedback?.ok && feedback.canonicalDisplayPriceLabel && !form.displayPriceLabel) {
        setForm((current) => ({ ...current, displayPriceLabel: feedback.canonicalDisplayPriceLabel || current.displayPriceLabel }));
      }
    } catch (error: any) {
      toast.error(error?.message || "Validation request failed.");
    } finally {
      setValidatingPrice(false);
    }
  }

  // Create / edit no longer writes directly — it opens the step-up modal,
  // which replays the request with the password + MFA merged in.
  function submitCampaignForm() {
    const isEditing = Boolean(editingCampaignId);
    openMutation({
      kind: "save",
      method: isEditing ? "PATCH" : "POST",
      url: isEditing ? `/api/acquisition-campaigns/${editingCampaignId}` : "/api/acquisition-campaigns",
      payload: buildCampaignPayload(form),
      title: isEditing ? "Save campaign changes" : "Create campaign",
      description: isEditing
        ? "Saving rewrites the live campaign, including its bound Stripe price and public pricing copy. Enter your admin password and MFA code or backup code to confirm."
        : "Creating a campaign binds a live Stripe price and can publish to a public pricing slot. Enter your admin password and MFA code or backup code to confirm.",
      confirmLabel: isEditing ? "Save Changes" : "Create Draft",
    });
  }

  // Status changes (Activate / Pause / End) all flow through PATCH and are
  // gated the same way — activation in particular publishes to the public site.
  function changeCampaignStatus(campaign: Campaign, status: "ACTIVE" | "PAUSED" | "ENDED") {
    const verb = status === "ACTIVE" ? "Activate" : status === "PAUSED" ? "Pause" : "End";
    const impact = status === "ACTIVE"
      ? `Activating "${campaign.name}" (${campaign.code}) publishes it to its public pricing slot within ~60 seconds.`
      : `Setting "${campaign.name}" (${campaign.code}) to ${status} removes it from its public pricing slot.`;
    openMutation({
      kind: "status",
      url: `/api/acquisition-campaigns/${campaign.id}`,
      payload: { status },
      title: `${verb} campaign`,
      description: `${impact} Enter your admin password and MFA code or backup code to confirm.`,
      confirmLabel: verb,
    });
  }

  function duplicateCampaign(campaign: Campaign) {
    const code = `${campaign.code}_COPY`;
    openMutation({
      kind: "duplicate",
      url: `/api/acquisition-campaigns/${campaign.id}`,
      payload: { action: "duplicate", code },
      title: "Duplicate campaign",
      description: `Clone "${campaign.name}" into a new draft (${code}), copying its Stripe price and pricing copy. Enter your admin password and MFA code or backup code to confirm.`,
      confirmLabel: "Duplicate",
    });
  }

  const formVisible = formMode !== "hidden";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Growth"
        title="Acquisition <em>Campaigns</em>"
        subtitle="Each public surface (homepage, /pricing, settings) reads from the active campaign in its slot, so this copy ships LIVE to the public site within ~60s of activation. LocateFlow is free for everyone (affiliate-funded) — keep public headlines, subheadlines, and disclosures in the free/affiliate voice and avoid 'Subscribe / $X per month / upgrade' paywall wording. The Paid / Monthly slot is a dormant, reversible legacy mechanism; the defaults here are intentionally free-consistent."
      />

      {slotConflicts.length > 0 ? (
        <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-5 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tone-honey-fg" aria-hidden="true" />
            <div>
              <p className="font-display text-base font-bold text-foreground">Multiple active campaigns detected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The public site picks the most recently updated one in each slot. Pause or end the
                duplicates so the live offer is unambiguous.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                {slotConflicts.map((conflict) => (
                  <li key={conflict.key}>
                    <span className="font-mono text-[11px]">{conflict.key.replace(":", " · ")}</span>:{" "}
                    <span className="font-mono">{conflict.campaigns.map((c) => c.code).join(", ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <SlotCard
          title="Annual Trial slot"
          description="Drives the primary card on / and /pricing, and the promo banner for Free Access users."
          campaign={slots.annualTrial}
          emptyHint="No annual trial published. The homepage will fall back to static annual copy until you activate one."
          onCreate={() => startCreate(annualTrialPreset)}
          onEdit={(campaign) => startEditing(campaign)}
          createLabel="Create Annual Trial"
        />
        <SlotCard
          title="Monthly Paid slot (legacy / dormant)"
          description="Legacy paid slot — dormant while LocateFlow is free. Kept reversible; defaults stay in the free/affiliate voice and ship no paywall copy to the public site."
          campaign={slots.monthlyPaid}
          emptyHint="No monthly campaign active. The pricing page hides the monthly card until you activate one."
          onCreate={() => startCreate(monthlyPaidPreset)}
          onEdit={(campaign) => startEditing(campaign)}
          createLabel="Create Monthly Paid"
        />
      </div>

      {!formVisible ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-base font-bold text-foreground">Need another campaign?</p>
              <p className="text-xs text-muted-foreground">
                Drafts can coexist with the active campaign. Activate when you&apos;re ready to publish.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => startCreate(annualTrialPreset)}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> New Annual Trial
              </button>
              <button
                type="button"
                onClick={() => startCreate(monthlyPaidPreset)}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> New Monthly Paid
              </button>
              <button
                type="button"
                onClick={() => startCreate(freeAccessPreset)}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> New Free Access
              </button>
              <button
                type="button"
                onClick={() => startCreate(emptyForm)}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Blank Campaign
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {formVisible ? (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              {editingCampaign ? "Edit Campaign" : "Create Campaign"}
            </h2>
            {editingCampaign ? (
              <p className="text-xs text-muted-foreground">
                Editing {editingCampaign.name}. Existing redemption snapshots stay unchanged.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Drafts are not published. Activate to make this the live campaign for its slot.
              </p>
            )}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Name</label>
            <input className={inputCls} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Individual Annual - Spring" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Code</label>
            <input className={inputCls} value={form.code} onChange={(event) => update("code", event.target.value)} placeholder="SPRING90" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Access Type</label>
            <select className={inputCls} value={form.accessType} onChange={(event) => updateAccessType(event.target.value)}>
              <option value="FREE_TRIAL">Free Trial</option>
              <option value="FREE_ACCESS">Free Access</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
          {form.accessType === "FREE_TRIAL" ? (
            <>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Trial Days</label>
                <input className={inputCls} type="number" min="1" value={form.trialDays} onChange={(event) => update("trialDays", event.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Stripe Price ID</label>
                <input className={inputCls} value={form.stripePriceId} onChange={(event) => update("stripePriceId", event.target.value)} placeholder="price_..." />
              </div>
            </>
          ) : form.accessType === "PAID" ? (
            <>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Billing Interval</label>
                <select className={inputCls} value={form.billingInterval} onChange={(event) => updateBillingInterval(event.target.value)}>
                  <option value="MONTH">Monthly</option>
                  {form.billingInterval === "YEAR" ? <option value="YEAR">Yearly (legacy)</option> : null}
                </select>
                {form.billingInterval === "YEAR" ? (
                  <p className="mt-1 text-[11px] text-tone-honey-fg">
                    Annual paid is legacy and not consumed by checkout. Switch to Monthly or use the Annual Trial slot.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Stripe Price ID</label>
                <input className={inputCls} value={form.stripePriceId} onChange={(event) => update("stripePriceId", event.target.value)} placeholder="price_..." />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Free Access Days</label>
              <input className={inputCls} type="number" min="1" value={form.freeAccessDays} onChange={(event) => update("freeAccessDays", event.target.value)} />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Display Price</label>
            <input
              className={inputCls}
              value={form.displayPriceLabel}
              onChange={(event) => update("displayPriceLabel", event.target.value)}
              placeholder="Leave blank — the public app is free"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              LocateFlow is free for everyone. Leave this blank so no price shows on the public site. A price label only applies to the dormant/legacy paid path and must match its Stripe price.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Max Redemptions</label>
            <input className={inputCls} type="number" min="1" value={form.maxRedemptions} onChange={(event) => update("maxRedemptions", event.target.value)} placeholder="Optional" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Public Headline</label>
            <input className={inputCls} value={form.publicHeadline} onChange={(event) => update("publicHeadline", event.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Public Subheadline</label>
            <input className={inputCls} value={form.publicSubheadline} onChange={(event) => update("publicSubheadline", event.target.value)} />
          </div>
          <div className="md:col-span-4">
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Checkout Disclosure Copy</label>
            <textarea className={inputCls} rows={2} value={form.checkoutDisclosureCopy} onChange={(event) => update("checkoutDisclosureCopy", event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={form.newUsersOnly} onChange={(event) => update("newUsersOnly", event.target.checked)} />
            New users only
          </label>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Starts At</label>
            <input className={inputCls} type="datetime-local" value={form.startsAt} onChange={(event) => update("startsAt", event.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Ends At</label>
            <input className={inputCls} type="datetime-local" value={form.endsAt} onChange={(event) => update("endsAt", event.target.value)} />
          </div>
          <div className="md:col-span-4">
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Internal Notes</label>
            <textarea className={inputCls} rows={2} value={form.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} placeholder="Admin-only notes" />
          </div>
        </div>
        {priceValidation ? (
          <div
            className={`mt-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${
              priceValidation.error
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : priceValidation.warning
                  ? "border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg"
                  : "border-tone-emerald-br bg-tone-emerald-bg text-tone-emerald-fg"
            }`}
          >
            <span className="flex-1">
              {priceValidation.error ||
                priceValidation.warning ||
                (priceValidation.skipped
                  ? "Stripe price validation skipped for this no-payment campaign."
                  : `Stripe price validated: ${priceValidation.canonicalDisplayPriceLabel || "configured price"} USD, ${priceValidation.price?.interval === "month" ? "monthly" : "annual"}`)}
            </span>
            {priceValidation.canonicalDisplayPriceLabel &&
            priceValidation.canonicalDisplayPriceLabel !== form.displayPriceLabel ? (
              <button
                type="button"
                onClick={() =>
                  update("displayPriceLabel", priceValidation.canonicalDisplayPriceLabel || "")
                }
                className="shrink-0 rounded-lg border border-current px-2 py-1 text-xs font-medium transition-colors hover:bg-foreground/5"
              >
                Use {priceValidation.canonicalDisplayPriceLabel}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => submitCampaignForm()}
            disabled={mutationBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {editingCampaign ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingCampaign ? "Save Changes" : "Create Draft"}
          </button>
          {form.accessType !== "FREE_ACCESS" ? (
            <button
              type="button"
              onClick={() => void validatePriceOnly()}
              disabled={validatingPrice || mutationBusy || !form.stripePriceId.trim()}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
              title={!form.stripePriceId.trim() ? "Enter a Stripe Price ID first" : "Validate against Stripe without saving"}
            >
              <RefreshCw className={`h-4 w-4 ${validatingPrice ? "animate-spin" : ""}`} />
              {validatingPrice ? "Validating..." : "Validate Stripe Price"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={resetForm}
            disabled={mutationBusy}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            {editingCampaign ? "Cancel Edit" : "Close"}
          </button>
        </div>
      </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-base font-bold text-foreground">All Campaigns</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Drafts, paused, and ended campaigns live here. Activate to publish to the matching slot.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="ENDED">Ended</option>
            </select>
            <select
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              value={filterAccessType}
              onChange={(event) => setFilterAccessType(event.target.value as typeof filterAccessType)}
              aria-label="Filter by access type"
            >
              <option value="">All types</option>
              <option value="FREE_TRIAL">Free Trial</option>
              <option value="FREE_ACCESS">Free Access</option>
              <option value="PAID">Paid</option>
            </select>
            <form
              className="relative"
              onSubmit={(event) => {
                event.preventDefault();
                setSearchQuery(searchInput.trim());
              }}
            >
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search name, code, headline..."
                className="w-56 rounded-xl border border-border bg-background py-1.5 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </form>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <EmptyState icon={Ticket} title="No campaigns found" description="No campaigns match your current filters." />
        ) : (
          <div className="divide-y divide-border">
            {campaigns.map((campaign) => {
              const creator = campaign.createdByAdmin;
              const creatorLabel = creator
                ? `${[creator.firstName, creator.lastName].filter(Boolean).join(" ") || creator.email}`
                : null;
              const updatedAt = campaign.updatedAt ? new Date(campaign.updatedAt) : null;
              return (
                <div key={campaign.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-foreground">{campaign.name}</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">{campaign.code}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                        {campaign.status}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{campaign.accessType.replace("_", " ")}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{campaign.publicHeadline}</p>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                      <span>Plan: Individual</span>
                      <span>
                        {campaign.accessType === "FREE_TRIAL"
                          ? `Trial: ${campaign.trialDays || 14} days`
                          : campaign.accessType === "PAID"
                            ? `Billing: ${campaign.billingInterval === "YEAR" ? "Yearly" : "Monthly"}`
                            : `Free Access: ${campaign.freeAccessDays || 0} days`}
                      </span>
                      <span>Payment method: {campaign.requiresPaymentMethod ? "Required" : "Not required"}</span>
                      <span>Redemptions: <span className="font-mono text-foreground">{campaign.redemptionCount}{campaign.maxRedemptions ? ` / ${campaign.maxRedemptions}` : ""}</span></span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {creatorLabel ? <span>Created by {creatorLabel}</span> : null}
                      {updatedAt ? <span>Updated <span className="font-mono">{updatedAt.toLocaleString()}</span></span> : null}
                    </div>
                    {campaign.redemptions?.length ? (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Recent redemptions: {campaign.redemptions.map((redemption) => redemption.user?.email || redemption.id).join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                    <button onClick={() => startEditing(campaign)} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    {campaign.status !== "ACTIVE" ? (
                      <button onClick={() => changeCampaignStatus(campaign, "ACTIVE")} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                        <Play className="h-3.5 w-3.5" /> Activate
                      </button>
                    ) : (
                      <button onClick={() => changeCampaignStatus(campaign, "PAUSED")} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </button>
                    )}
                    <button onClick={() => changeCampaignStatus(campaign, "ENDED")} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      <Square className="h-3.5 w-3.5" /> End
                    </button>
                    <button onClick={() => duplicateCampaign(campaign)} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                    <button onClick={() => void loadRedemptions(campaign)} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      <BarChart3 className="h-3.5 w-3.5" /> Redemptions
                    </button>
                    <button
                      onClick={() => requestDeleteCampaign(campaign)}
                      disabled={campaign.redemptionCount > 0}
                      title={campaign.redemptionCount > 0 ? "End this campaign — it has redemptions on record." : "Delete draft / unused campaign"}
                      className="inline-flex items-center gap-1 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {total > PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>
              Page <span className="font-mono text-foreground">{page}</span> of <span className="font-mono text-foreground">{Math.max(1, Math.ceil(total / PAGE_SIZE))}</span> · <span className="font-mono text-foreground">{total}</span> campaigns
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 font-medium transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-3 w-3" /> Prev
              </button>
              <button
                onClick={() => setPage((current) => current + 1)}
                disabled={page * PAGE_SIZE >= total || loading}
                className="inline-flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 font-medium transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Next <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {redemptionsFor ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="redemptions-title"
          className="fixed inset-0 z-50 flex items-end justify-end bg-foreground/30 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setRedemptionsFor(null);
          }}
        >
          <div className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 id="redemptions-title" className="font-display text-base font-bold text-foreground">Redemptions</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {redemptionsFor.campaign.name} · <span className="font-mono">{redemptionsFor.campaign.code}</span>
                </p>
              </div>
              <button
                onClick={() => setRedemptionsFor(null)}
                className="rounded-xl border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close redemptions panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {redemptionsFor.loading ? (
                <p className="text-sm text-muted-foreground">Loading redemptions...</p>
              ) : redemptionsFor.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No redemptions yet.</p>
              ) : (
                <ul className="space-y-3">
                  {redemptionsFor.rows.map((row) => {
                    const fullName = [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" ");
                    return (
                      <li key={row.id} className="rounded-xl border border-border p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground">
                              {fullName || row.user?.email || row.id}
                            </p>
                            {row.user?.email && fullName ? (
                              <p className="text-muted-foreground">{row.user.email}</p>
                            ) : null}
                          </div>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                            {row.status}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1 text-muted-foreground">
                          <span>Access: {row.accessType.replace("_", " ")}</span>
                          <span>Redeemed: <span className="font-mono">{new Date(row.createdAt).toLocaleString()}</span></span>
                          {row.subscription?.trialEndsAt ? (
                            <span>Trial ends: <span className="font-mono">{new Date(row.subscription.trialEndsAt).toLocaleDateString()}</span></span>
                          ) : null}
                          {row.subscription?.freeAccessEndsAt ? (
                            <span>Free Access ends: <span className="font-mono">{new Date(row.subscription.freeAccessEndsAt).toLocaleDateString()}</span></span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Step-up confirm modal — gates EVERY campaign mutation
          (create / edit / activate-status-change / duplicate / delete).
          Each replays through confirmMutation with password + MFA merged in. */}
      <PasswordConfirmModal
        open={pendingMutation !== null}
        title={pendingMutation?.title || "Confirm action"}
        description={pendingMutation?.description || ""}
        confirmLabel={pendingMutation?.confirmLabel || "Confirm"}
        busy={mutationBusy}
        error={mutationError}
        requiresMfa={mutationRequiresMfa}
        onClose={closeMutation}
        onConfirm={confirmMutation}
      />
    </div>
  );
}
