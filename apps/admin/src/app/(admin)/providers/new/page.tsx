"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  Phone,
  Globe,
  MapPin,
  Tag,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PROVIDER_CATEGORY_OPTIONS } from "@/lib/recommendation-engine";

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

const CATEGORY_OPTIONS = [...PROVIDER_CATEGORY_OPTIONS].sort(
  (a, b) => a.order - b.order,
);
const DEFAULT_CATEGORY =
  CATEGORY_OPTIONS.find((option) => option.value === "FINANCIAL_BANK")?.value ||
  CATEGORY_OPTIONS[0]?.value ||
  "FINANCIAL_BANK";

const STEPS = [
  { label: "Basic Info", icon: Building2, desc: "Name, category, description" },
  { label: "Contact & Media", icon: Phone, desc: "Website, phone, logo, tags" },
  { label: "Scope & Settings", icon: MapPin, desc: "Coverage, score, states" },
];

const inputCls =
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type ProviderFormState = {
  name: string;
  slug: string;
  category: string;
  subCategory: string;
  description: string;
  website: string;
  phone: string;
  logoUrl: string;
  scope: string;
  states: string[];
  zipCodes: string;
  tags: string;
  popularityScore: number;
  isActive: boolean;
  displayOrder: number;
  affiliateUrl: string;
  affiliateNetwork: string;
  affiliateActive: boolean;
};

export default function NewProviderPage() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [slugDup, setSlugDup] = useState(false);
  const [form, setForm] = useState<ProviderFormState>({
    name: "",
    slug: "",
    category: DEFAULT_CATEGORY,
    subCategory: "",
    description: "",
    website: "",
    phone: "",
    logoUrl: "",
    scope: "FEDERAL",
    states: [] as string[],
    zipCodes: "",
    tags: "",
    popularityScore: 50,
    isActive: true,
    displayOrder: 0,
    affiliateUrl: "",
    affiliateNetwork: "",
    affiliateActive: false,
  });

  function handleSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  // Check for duplicate slug
  useEffect(() => {
    if (!form.slug) {
      setSlugDup(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/providers?search=${encodeURIComponent(form.slug)}&perPage=5`,
        );
        const data = await res.json();
        const providers =
          data.providers || Object.values(data.groups || {}).flat();
        setSlugDup(providers.some((p: any) => p.slug === form.slug));
      } catch {
        setSlugDup(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.slug]);

  function canProceed() {
    if (step === 0)
      return form.name.trim() && form.slug.trim() && form.category && !slugDup;
    return true;
  }

  async function handleSubmit() {
    if (!form.name || !form.slug || !form.category) {
      toast.error("Name, slug, and category are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          states: form.scope === "FEDERAL" ? [] : form.states,
          zipCodes:
            form.scope === "FEDERAL"
              ? []
              : form.zipCodes
                  .split(",")
                  .map((zip) => zip.trim())
                  .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create");
        return;
      }
      toast.success("Provider created successfully!");
      window.location.assign("/providers");
    } catch {
      toast.error("Failed to create provider");
    } finally {
      setSaving(false);
    }
  }

  function toggleState(st: string) {
    setForm((f) => ({
      ...f,
      states: f.states.includes(st)
        ? f.states.filter((s) => s !== st)
        : [...f.states, st],
    }));
  }

  function selectAllStates() {
    setForm((f) => ({ ...f, states: [...US_STATES] }));
  }
  function deselectAllStates() {
    setForm((f) => ({ ...f, states: [] }));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="New <em>Provider</em>"
        actions={
          <>
            <button
              onClick={() => window.location.assign("/providers")}
              aria-label="Back to providers"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Providers
            </button>
          </>
        }
      />

      {/* Stepper */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 w-full sm:flex-1">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-3 rounded-xl border p-4 flex-1 transition-all ${
                i === step
                  ? "border-primary bg-primary/5"
                  : i < step
                    ? "border-tone-sage-br bg-tone-sage-bg cursor-pointer hover:bg-tone-sage-bg"
                    : "border-border bg-card opacity-50 cursor-not-allowed"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  i < step
                    ? "bg-tone-sage-bg"
                    : i === step
                      ? "bg-primary/10"
                      : "bg-muted"
                }`}
              >
                {i < step ? (
                  <Check className="h-5 w-5 text-tone-sage-fg" />
                ) : (
                  <s.icon
                    className={`h-5 w-5 ${i === step ? "text-primary" : "text-muted-foreground"}`}
                  />
                )}
              </div>
              <div className="text-left">
                <p
                  className={`text-sm font-medium ${i === step ? "text-primary" : i < step ? "text-tone-sage-fg" : "text-muted-foreground"}`}
                >
                  Step {i + 1}: {s.label}
                </p>
                <p className="text-[11px] text-muted-foreground">{s.desc}</p>
              </div>
            </button>
            {i < STEPS.length - 1 && (
              <ArrowRight className="hidden h-4 w-4 text-muted-foreground flex-shrink-0 sm:block" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Basic Information
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Provider Name *
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    slug: handleSlug(e.target.value),
                  })
                }
                required
                placeholder="e.g. Chase Bank"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Slug *
              </label>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
                className={`${inputCls} ${slugDup ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
              />
              {slugDup && (
                <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> This slug already exists
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Category *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={inputCls}
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.icon} {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Sub Category
              </label>
              <input
                value={form.subCategory}
                onChange={(e) =>
                  setForm({ ...form, subCategory: e.target.value })
                }
                placeholder="e.g. Checking, Savings"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={4}
              placeholder="Brief description of this service provider..."
              className={inputCls}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {form.description.length}/500 characters
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Contact & Media */}
      {step === 1 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" /> Contact & Media
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                <Globe className="inline h-3.5 w-3.5 mr-1" /> Website
              </label>
              <input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://www.example.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                <Phone className="inline h-3.5 w-3.5 mr-1" /> Phone
              </label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="1-800-555-0100"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              <ImageIcon className="inline h-3.5 w-3.5 mr-1" /> Logo URL
            </label>
            <input
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
              className={inputCls}
            />
            {form.logoUrl && (
              <div className="mt-3 flex items-center gap-3">
                <div className="rounded-lg border border-border p-2 bg-muted">
                  <img
                    src={form.logoUrl}
                    alt="Provider logo preview"
                    className="h-12 w-12 object-contain rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Logo preview</p>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Affiliate (optional)</p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Affiliate URL (https)</label>
              <input
                type="url"
                value={form.affiliateUrl}
                onChange={(e) => setForm({ ...form, affiliateUrl: e.target.value })}
                placeholder="https://partner.example/offer?ref=locateflow"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Network</label>
              <input
                value={form.affiliateNetwork}
                onChange={(e) => setForm({ ...form, affiliateNetwork: e.target.value })}
                placeholder="impact, cj, direct…"
                maxLength={40}
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.affiliateActive}
                onChange={(e) => setForm({ ...form, affiliateActive: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              Affiliate offer active (requires a valid https URL)
            </label>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              <Tag className="inline h-3.5 w-3.5 mr-1" /> Tags (comma separated)
            </label>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="online-banking, mobile-app, no-fee, rewards"
              className={inputCls}
            />
            {form.tags && (
              <div className="mt-2 flex flex-wrap gap-1">
                {form.tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {t}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Scope & Settings */}
      {step === 2 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Scope & Settings
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Scope
              </label>
              <select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                className={inputCls}
              >
                <option value="FEDERAL">Federal (All States)</option>
                <option value="STATE">State-specific</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Popularity Score
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.popularityScore}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      popularityScore: parseInt(e.target.value),
                    })
                  }
                  className="flex-1 h-2 rounded-full appearance-none bg-muted accent-primary"
                />
                <span className="text-sm font-bold text-foreground w-8 text-right">
                  {form.popularityScore}
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Display Order
              </label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) =>
                  setForm({
                    ...form,
                    displayOrder: parseInt(e.target.value) || 0,
                  })
                }
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={`relative h-6 w-11 rounded-full transition-colors ${form.isActive ? "bg-tone-sage-fg" : "bg-muted"}`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground shadow transition-transform ${form.isActive ? "left-[22px]" : "left-0.5"}`}
              />
            </button>
            <div>
              <p className="text-sm font-medium text-foreground">
                {form.isActive ? "Active" : "Inactive"}
              </p>
              <p className="text-xs text-muted-foreground">
                {form.isActive
                  ? "Provider will be visible to users"
                  : "Provider is hidden from users"}
              </p>
            </div>
          </div>

          {form.scope === "STATE" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Select States ({form.states.length} of {US_STATES.length}{" "}
                  selected)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllStates}
                    className="text-xs text-primary hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllStates}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-border p-3 max-h-48 overflow-y-auto">
                {US_STATES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => toggleState(st)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${form.states.includes(st) ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.scope === "STATE" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                ZIP Codes / Prefixes
              </label>
              <input
                value={form.zipCodes}
                onChange={(e) => setForm({ ...form, zipCodes: e.target.value })}
                placeholder="78701, 787, 94105"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Comma separated exact ZIPs or prefixes. Leave blank to use
                state-wide coverage.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Summary (on last step) */}
      {step === 2 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Review Summary
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium text-foreground">{form.name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="font-medium text-foreground">
                {form.category.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Scope</p>
              <p className="font-medium text-foreground">
                {form.scope}{" "}
                {form.scope === "STATE" ? `(${form.states.length} states)` : ""}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ZIP Rules</p>
              <p className="font-medium text-foreground">
                {form.scope === "STATE" && form.zipCodes.trim()
                  ? form.zipCodes
                      .split(",")
                      .map((zip) => zip.trim())
                      .filter(Boolean).length
                  : 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Website</p>
              <p className="font-medium text-foreground truncate">
                {form.website || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="font-medium text-foreground">
                {form.popularityScore}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${form.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-slate-bg text-muted-foreground"}`}
              >
                {form.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (step > 0 ? setStep(step - 1) : window.location.assign("/providers"))}
          className="flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> {step > 0 ? "Previous" : "Cancel"}
        </button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !canProceed()}
            className="flex items-center gap-2 rounded-lg bg-tone-sage-fg px-8 py-2.5 text-sm font-medium text-white hover:bg-tone-sage-fg disabled:opacity-50"
          >
            {saving ? (
              "Creating..."
            ) : (
              <>
                <Check className="h-4 w-4" /> Create Provider
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
