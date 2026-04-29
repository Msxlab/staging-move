"use client";

import { useEffect, useState } from "react";
import { Copy, Pause, Pencil, Play, Plus, Save, Square, Ticket, X } from "lucide-react";
import { toast } from "sonner";

type Campaign = {
  id: string;
  name: string;
  code: string;
  status: string;
  accessType: "FREE_ACCESS" | "FREE_TRIAL";
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
  redemptions?: Array<{ id: string; createdAt: string; user?: { id: string; email: string } }>;
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

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const emptyForm = {
  name: "",
  code: "",
  accessType: "FREE_TRIAL",
  trialDays: "90",
  freeAccessDays: "30",
  stripePriceId: "",
  displayPriceLabel: "$79/year",
  publicHeadline: "Start with 3 months free",
  publicSubheadline: "Individual Annual starts after your trial.",
  checkoutDisclosureCopy: "Today: $0. Trial: 3 months. Your annual plan starts after the trial. You can cancel before then in Settings.",
  newUsersOnly: true,
  maxRedemptions: "",
  startsAt: "",
  endsAt: "",
  internalNotes: "",
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
    trialDays: String(campaign.trialDays || 90),
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
  const accessType = form.accessType === "FREE_ACCESS" ? "FREE_ACCESS" : "FREE_TRIAL";
  return {
    ...form,
    accessType,
    trialDays: accessType === "FREE_TRIAL" ? Number(form.trialDays || 90) : null,
    freeAccessDays: accessType === "FREE_ACCESS" ? Number(form.freeAccessDays || 30) : null,
    stripePriceId: accessType === "FREE_TRIAL" ? form.stripePriceId : "",
    maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
    internalNotes: form.internalNotes || null,
  };
}

export default function AcquisitionCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [priceValidation, setPriceValidation] = useState<PriceValidationFeedback>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const editingCampaign = campaigns.find((campaign) => campaign.id === editingCampaignId) || null;

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/acquisition-campaigns", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load campaigns.");
      setCampaigns(data.campaigns || []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function update(key: keyof typeof emptyForm, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function showPriceValidation(feedback: PriceValidationFeedback) {
    setPriceValidation(feedback || null);
    if (!feedback) return;
    if (feedback.warning) {
      toast.warning(feedback.warning);
    } else if (feedback.error) {
      toast.error(feedback.error);
    } else if (feedback.canonicalDisplayPriceLabel) {
      toast.success(`Stripe price validated: ${feedback.canonicalDisplayPriceLabel} USD, annual`);
    }
  }

  function resetForm() {
    setEditingCampaignId(null);
    setForm(emptyForm);
    setPriceValidation(null);
  }

  function startEditing(campaign: Campaign) {
    setEditingCampaignId(campaign.id);
    setForm(campaignToForm(campaign));
    setPriceValidation(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitCampaignForm() {
    setSaving(true);
    try {
      const isEditing = Boolean(editingCampaignId);
      const response = await fetch(
        isEditing ? `/api/acquisition-campaigns/${editingCampaignId}` : "/api/acquisition-campaigns",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildCampaignPayload(form)),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || (isEditing ? "Failed to update campaign." : "Failed to create campaign."));
      }
      showPriceValidation(data.priceValidation || null);
      toast.success(isEditing ? "Campaign updated" : "Campaign created");
      resetForm();
      await load();
    } catch (error: any) {
      toast.error(error?.message || (editingCampaignId ? "Failed to update campaign." : "Failed to create campaign."));
    } finally {
      setSaving(false);
    }
  }

  async function patchCampaign(id: string, patch: Record<string, unknown>) {
    try {
      const response = await fetch(`/api/acquisition-campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update campaign.");
      showPriceValidation(data.priceValidation || null);
      toast.success("Campaign updated");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update campaign.");
    }
  }

  async function duplicateCampaign(campaign: Campaign) {
    const code = `${campaign.code}_COPY`;
    try {
      const response = await fetch(`/api/acquisition-campaigns/${campaign.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to duplicate campaign.");
      toast.success("Campaign duplicated as draft");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to duplicate campaign.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Acquisition Campaigns</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage Individual Free Access and Free Trial campaigns without changing existing redemption snapshots.
          Public site updates within 60 seconds after activation.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {editingCampaign ? "Edit Campaign" : "Create Campaign"}
            </h2>
            {editingCampaign ? (
              <p className="text-xs text-muted-foreground">
                Editing {editingCampaign.name}. Existing redemption snapshots stay unchanged.
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">Name</label>
            <input className={inputCls} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Individual Annual - Spring" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Code</label>
            <input className={inputCls} value={form.code} onChange={(event) => update("code", event.target.value)} placeholder="SPRING90" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Access Type</label>
            <select className={inputCls} value={form.accessType} onChange={(event) => update("accessType", event.target.value)}>
              <option value="FREE_TRIAL">Free Trial</option>
              <option value="FREE_ACCESS">Free Access</option>
            </select>
          </div>
          {form.accessType === "FREE_TRIAL" ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Trial Days</label>
                <input className={inputCls} type="number" min="1" value={form.trialDays} onChange={(event) => update("trialDays", event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Stripe Price ID</label>
                <input className={inputCls} value={form.stripePriceId} onChange={(event) => update("stripePriceId", event.target.value)} placeholder="price_..." />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Free Access Days</label>
              <input className={inputCls} type="number" min="1" value={form.freeAccessDays} onChange={(event) => update("freeAccessDays", event.target.value)} />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Display Price</label>
            <input className={inputCls} value={form.displayPriceLabel} onChange={(event) => update("displayPriceLabel", event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Max Redemptions</label>
            <input className={inputCls} type="number" min="1" value={form.maxRedemptions} onChange={(event) => update("maxRedemptions", event.target.value)} placeholder="Optional" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">Public Headline</label>
            <input className={inputCls} value={form.publicHeadline} onChange={(event) => update("publicHeadline", event.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">Public Subheadline</label>
            <input className={inputCls} value={form.publicSubheadline} onChange={(event) => update("publicSubheadline", event.target.value)} />
          </div>
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs text-muted-foreground">Checkout Disclosure Copy</label>
            <textarea className={inputCls} rows={2} value={form.checkoutDisclosureCopy} onChange={(event) => update("checkoutDisclosureCopy", event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={form.newUsersOnly} onChange={(event) => update("newUsersOnly", event.target.checked)} />
            New users only
          </label>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Starts At</label>
            <input className={inputCls} type="datetime-local" value={form.startsAt} onChange={(event) => update("startsAt", event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Ends At</label>
            <input className={inputCls} type="datetime-local" value={form.endsAt} onChange={(event) => update("endsAt", event.target.value)} />
          </div>
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs text-muted-foreground">Internal Notes</label>
            <textarea className={inputCls} rows={2} value={form.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} placeholder="Admin-only notes" />
          </div>
        </div>
        {priceValidation ? (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              priceValidation.error
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : priceValidation.warning
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {priceValidation.error ||
              priceValidation.warning ||
              (priceValidation.skipped
                ? "Stripe price validation skipped for this no-payment campaign."
                : `Stripe price validated: ${priceValidation.canonicalDisplayPriceLabel || "configured price"} USD, annual`)}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void submitCampaignForm()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {editingCampaign ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saving ? (editingCampaign ? "Saving..." : "Creating...") : editingCampaign ? "Save Changes" : "Create Draft"}
          </button>
          {editingCampaign ? (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              Cancel Edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-foreground">Campaigns</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No campaigns yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{campaign.name}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{campaign.code}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{campaign.status}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{campaign.accessType.replace("_", " ")}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{campaign.publicHeadline}</p>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>Plan: Individual</span>
                    <span>{campaign.accessType === "FREE_TRIAL" ? `Trial: ${campaign.trialDays || 90} days` : `Free Access: ${campaign.freeAccessDays || 0} days`}</span>
                    <span>Payment method: {campaign.requiresPaymentMethod ? "Required" : "Not required"}</span>
                    <span>Redemptions: {campaign.redemptionCount}{campaign.maxRedemptions ? ` / ${campaign.maxRedemptions}` : ""}</span>
                  </div>
                  {campaign.redemptions?.length ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                      Recent redemptions: {campaign.redemptions.map((redemption) => redemption.user?.email || redemption.id).join(", ")}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                  <button onClick={() => startEditing(campaign)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  {campaign.status !== "ACTIVE" ? (
                    <button onClick={() => void patchCampaign(campaign.id, { status: "ACTIVE" })} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent">
                      <Play className="h-3.5 w-3.5" /> Activate
                    </button>
                  ) : (
                    <button onClick={() => void patchCampaign(campaign.id, { status: "PAUSED" })} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent">
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </button>
                  )}
                  <button onClick={() => void patchCampaign(campaign.id, { status: "ENDED" })} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent">
                    <Square className="h-3.5 w-3.5" /> End
                  </button>
                  <button onClick={() => void duplicateCampaign(campaign)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent">
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
