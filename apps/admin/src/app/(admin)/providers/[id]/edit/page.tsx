"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PROVIDER_CATEGORY_OPTIONS } from "@/lib/recommendation-engine";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const CATEGORY_OPTIONS = [...PROVIDER_CATEGORY_OPTIONS].sort((a, b) => a.order - b.order);
const DEFAULT_CATEGORY = CATEGORY_OPTIONS.find((option) => option.value === "FINANCIAL_BANK")?.value || CATEGORY_OPTIONS[0]?.value || "FINANCIAL_BANK";

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
};

export default function EditProviderPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerVersion, setProviderVersion] = useState<number | null>(null);
  const [form, setForm] = useState<ProviderFormState>({
    name: "", slug: "", category: DEFAULT_CATEGORY, subCategory: "",
    description: "", website: "", phone: "", logoUrl: "",
    scope: "FEDERAL", states: [] as string[], zipCodes: "", tags: "",
    popularityScore: 50, isActive: true, displayOrder: 0,
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/providers/${params.id}`);
        const data = await res.json();
        if (!res.ok) { toast.error("Provider not found"); window.location.assign("/providers"); return; }
        const p = data.provider;
        let states: string[] = [];
        let zipCodes: string[] = [];
        let tags: string[] = [];
        try { states = JSON.parse(p.states || "[]"); } catch {}
        try { zipCodes = JSON.parse(p.zipCodes || "[]"); } catch {}
        try { tags = JSON.parse(p.tags || "[]"); } catch {}
        setProviderVersion(typeof p.version === "number" ? p.version : null);
        setForm({
          name: p.name || "", slug: p.slug || "", category: p.category || DEFAULT_CATEGORY,
          subCategory: p.subCategory || "", description: p.description || "",
          website: p.website || "", phone: p.phone || "", logoUrl: p.logoUrl || "",
          scope: p.scope || "FEDERAL", states,
          zipCodes: zipCodes.join(", "),
          tags: tags.join(", "),
          popularityScore: p.popularityScore || 0, isActive: p.isActive ?? true,
          displayOrder: p.displayOrder || 0,
        });
      } catch { toast.error("Failed to load provider"); }
      finally { setLoading(false); }
    }
    load();
  }, [params.id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/providers/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          version: providerVersion,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          states: form.scope === "FEDERAL" ? [] : form.states,
          zipCodes: form.scope === "FEDERAL"
            ? []
            : form.zipCodes.split(",").map((zip) => zip.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(
          d.code === "OPTIMISTIC_LOCK_CONFLICT"
            ? d.error
            : d.error || "Failed to update provider",
        );
        return;
      }
      toast.success("Provider updated");
      window.location.assign("/providers");
    } catch { toast.error("Failed to update provider"); }
    finally { setSaving(false); }
  }

  function toggleState(st: string) {
    setForm((f) => ({
      ...f,
      states: f.states.includes(st) ? f.states.filter((s) => s !== st) : [...f.states, st],
    }));
  }

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Providers
      </button>

      <h1 className="text-3xl font-bold text-foreground">Edit Provider</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Slug *</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none">
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category.value} value={category.value}>{category.icon} {category.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Sub Category</label>
              <input value={form.subCategory} onChange={(e) => setForm({ ...form, subCategory: e.target.value })} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Contact & Links</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Website</label>
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Logo URL</label>
            <input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Tags (comma separated)</label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Scope & Coverage</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Scope</label>
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none">
                <option value="FEDERAL">Federal (All States)</option>
                <option value="STATE">State-specific</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Popularity Score</label>
              <input type="number" value={form.popularityScore} onChange={(e) => setForm({ ...form, popularityScore: parseInt(e.target.value) || 0 })} min={0} max={100} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Display Order</label>
              <input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-input" />
            <label htmlFor="isActive" className="text-sm text-foreground">Active</label>
          </div>
          {form.scope === "STATE" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Select States ({form.states.length} selected)</label>
              <div className="flex flex-wrap gap-1.5">
                {US_STATES.map((st) => (
                  <button key={st} type="button" onClick={() => toggleState(st)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${form.states.includes(st) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}
          {form.scope === "STATE" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">ZIP Codes / Prefixes</label>
              <input
                value={form.zipCodes}
                onChange={(e) => setForm({ ...form, zipCodes: e.target.value })}
                placeholder="78701, 787, 94105"
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1 text-xs text-muted-foreground">Comma separated exact ZIPs or prefixes. Leave blank to keep state-wide coverage.</p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="rounded-lg bg-primary px-8 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-border px-8 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
