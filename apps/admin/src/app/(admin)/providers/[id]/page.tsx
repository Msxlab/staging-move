"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Trash2, Globe, MapPin, Phone, ExternalLink,
  Users, Building2, Tag, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { getCategoryIcon, getCategoryLabel } from "@/lib/recommendation-engine";

interface Provider {
  id: string; name: string; slug: string; category: string; subCategory: string | null;
  description: string | null; website: string | null; phone: string | null; logoUrl: string | null;
  scope: string; states: string; zipCodes: string; tags: string;
  popularityScore: number; isActive: boolean; displayOrder: number;
  userCount: number;
  createdAt: string; updatedAt: string;
}

export default function ProviderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/providers/${id}`)
      .then((r) => r.json())
      .then((data) => setProvider(data.provider || data))
      .catch(() => toast.error("Failed to load provider"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!provider || !confirm(`Delete "${provider.name}"?`)) return;
    const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); router.push("/providers"); }
    else toast.error("Failed to delete");
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;
  if (!provider) return <div className="py-20 text-center text-muted-foreground">Provider not found</div>;

  const states: string[] = (() => { try { return JSON.parse(provider.states); } catch { return []; } })();
  const zipCodes: string[] = (() => { try { return JSON.parse(provider.zipCodes); } catch { return []; } })();
  const tags: string[] = (() => { try { return JSON.parse(provider.tags); } catch { return []; } })();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push("/providers")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Providers
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/providers/${id}/edit`)}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">
            <Pencil className="h-4 w-4" /> Edit
          </button>
          <button onClick={handleDelete}
            className="flex items-center gap-2 rounded-lg border border-destructive/30 px-4 py-2 text-sm text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      {/* Header Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-2xl">
            {provider.logoUrl ? (
              <img src={provider.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <span>{getCategoryIcon(provider.category)}</span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{provider.name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${provider.isActive ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-400"}`}>
                {provider.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{provider.slug}</p>
            {provider.description && <p className="mt-2 text-sm text-foreground/80">{provider.description}</p>}
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-foreground">{provider.popularityScore}</p>
            <p className="text-xs text-muted-foreground">Popularity Score</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/10 p-2.5"><Users className="h-5 w-5 text-purple-500" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{provider.userCount}</p>
              <p className="text-xs text-muted-foreground">Users</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-500/10 p-2.5"><Clock className="h-5 w-5 text-cyan-500" /></div>
            <div>
              <p className="text-sm font-bold text-foreground">{new Date(provider.updatedAt).toLocaleDateString()}</p>
              <p className="text-xs text-muted-foreground">Last Updated</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Details */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium text-foreground">{getCategoryLabel(provider.category)}</span></div>
            {provider.subCategory && <div className="flex justify-between"><span className="text-muted-foreground">Sub Category</span><span className="font-medium text-foreground">{provider.subCategory}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Scope</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${provider.scope === "FEDERAL" ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500"}`}>
                {provider.scope === "FEDERAL" ? "Federal" : "State"}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Display Order</span><span className="font-medium text-foreground">{provider.displayOrder}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">ZIP Rules</span><span className="font-medium text-foreground">{zipCodes.length || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium text-foreground">{new Date(provider.createdAt).toLocaleDateString()}</span></div>
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Contact & Links</h2>
          <div className="space-y-3 text-sm">
            {provider.website && (
              <a href={provider.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <ExternalLink className="h-4 w-4" /> {provider.website}
              </a>
            )}
            {provider.phone && (
              <div className="flex items-center gap-2 text-foreground">
                <Phone className="h-4 w-4 text-muted-foreground" /> {provider.phone}
              </div>
            )}
            {!provider.website && !provider.phone && <p className="text-muted-foreground">No contact info</p>}
          </div>
        </div>
      </div>

      {/* States */}
      {provider.scope === "STATE" && states.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-3">Coverage States ({states.length})</h2>
          <div className="flex flex-wrap gap-1.5">
            {states.map((s) => (
              <span key={s} className="rounded-lg bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-500">{s}</span>
            ))}
          </div>
        </div>
      )}

      {provider.scope === "STATE" && zipCodes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-3">ZIP Coverage Rules ({zipCodes.length})</h2>
          <div className="flex flex-wrap gap-1.5">
            {zipCodes.map((zip) => (
              <span key={zip} className="rounded-lg bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-500">{zip}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-3">Tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1 text-xs text-muted-foreground">
                <Tag className="h-3 w-3" /> {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
