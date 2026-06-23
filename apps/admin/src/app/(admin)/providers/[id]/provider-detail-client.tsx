"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  ExternalLink,
  Pencil,
  Phone,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCategoryIcon,
  getCategoryLabel,
} from "@/lib/recommendation-engine";
import { InfoHint } from "@/components/info-hint";
import { PasswordConfirmModal, StepUpValues } from "@/components/password-confirm-modal";
import { CoverageEditor } from "@/components/coverage-editor";

interface Provider {
  id: string;
  name: string;
  slug: string;
  category: string;
  subCategory: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  logoUrl: string | null;
  scope: string;
  states: string;
  zipCodes: string;
  tags: string;
  popularityScore: number;
  isActive: boolean;
  displayOrder: number;
  userCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  qualityWarningCount?: number;
  qualityWarnings?: Array<{
    code: string;
    label: string;
    message: string;
    severity: "info" | "warning" | "critical" | string;
  }>;
}

export default function ProviderDetailClient() {
  const { id } = useParams();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [coverageCount, setCoverageCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteRequiresMfa, setDeleteRequiresMfa] = useState(true);

  useEffect(() => {
    fetch(`/api/providers/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProvider(data.provider || null);
        setCoverageCount(data.meta?.coverageCount || 0);
        setAuditLogs(data.auditLogs || []);
      })
      .catch(() => toast.error("Failed to load provider"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete(_confirmPassword: string, stepUp: StepUpValues) {
    if (!provider) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/providers/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepUp),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || "Failed to delete provider";
        setDeleteRequiresMfa(Boolean(data.requiresMfa || deleteRequiresMfa));
        setDeleteError(message);
        toast.error(message);
        return;
      }
      toast.success("Provider deleted");
      window.location.assign("/providers");
    } catch {
      toast.error("Failed to delete provider");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Loading...</div>;
  }

  if (!provider) {
    return (
      <div className="py-20 text-center text-muted-foreground">Provider not found</div>
    );
  }

  // Coverage states + ZIP rules are now viewed/edited inline via <CoverageEditor>,
  // which fetches from /api/providers/[id]/coverage. Only the ZIP-rule count is
  // still read here for the Details stat below.
  const zipCodes: string[] = (() => {
    try {
      return JSON.parse(provider.zipCodes);
    } catch {
      return [];
    }
  })();
  const tags: string[] = (() => {
    try {
      return JSON.parse(provider.tags);
    } catch {
      return [];
    }
  })();

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => window.location.assign("/providers")}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.assign(`/providers/${id}/edit`)}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
          <button
            onClick={() => setShowDeletePrompt(true)}
            className="flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* ===== LEFT: provider detail card ===== */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-0">
          {/* header: icon + name + type + status */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-[50px] w-[50px] items-center justify-center rounded-xl bg-muted text-2xl">
                {provider.logoUrl ? (
                  <img
                    src={provider.logoUrl}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover"
                    onError={(event) => {
                      (event.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span>{getCategoryIcon(provider.category)}</span>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-extrabold text-foreground break-words">
                  {provider.name}
                </h1>
                <p className="text-sm text-muted-foreground">{provider.slug}</p>
              </div>
            </div>
            <span
              className={`flex items-center gap-1.5 text-xs font-bold ${
                provider.isActive ? "text-tone-sage-fg" : "text-muted-foreground"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  provider.isActive ? "bg-tone-sage-fg" : "bg-muted-foreground"
                }`}
              />
              {provider.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {provider.description && (
            <p className="mt-4 text-sm text-foreground/80">{provider.description}</p>
          )}

          {/* stat row */}
          <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-5">
            <ProviderStat label="Popularity" value={provider.popularityScore} accent />
            <ProviderStat label="Users" value={provider.userCount} />
            <ProviderStat label="Coverage Rows" value={coverageCount} hint="Number of geographic service areas mapped to this provider (each row is a state, city, or ZIP/polygon entry that decides where it appears in search)." />
            <ProviderStat label="Version" value={`v${provider.version}`} />
            <ProviderStat
              label="Last Updated"
              value={new Date(provider.updatedAt).toLocaleDateString()}
            />
          </div>

          {/* details */}
          <p className="mt-6 mb-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Details
          </p>
          <div className="space-y-3 text-sm">
            <DetailRow
              label="Category"
              value={getCategoryLabel(provider.category)}
            />
            {provider.subCategory && (
              <DetailRow label="Sub Category" value={provider.subCategory} />
            )}
            <DetailRow
              label="Scope"
              value={provider.scope === "FEDERAL" ? "Federal" : "State"}
            />
            <DetailRow label="Display Order" value={provider.displayOrder} />
            <DetailRow label="Version" value={provider.version} />
            <DetailRow label="ZIP Rules" value={zipCodes.length || "—"} />
            <DetailRow
              label="Created"
              value={new Date(provider.createdAt).toLocaleDateString()}
            />
          </div>

          {/* recent admin activity */}
          {auditLogs.length > 0 && (
            <>
              <p className="mt-6 mb-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Recent Admin Activity
              </p>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {(log.adminUser?.firstName || log.adminUser?.email || "Admin")}
                        {log.adminUser?.lastName ? ` ${log.adminUser.lastName}` : ""}
                      </p>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ===== RIGHT: side panels ===== */}
        <div className="flex flex-col gap-4">
          {/* quality warnings */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-tone-honey-fg" />
              <h2 className="text-sm font-bold text-foreground">Quality warnings</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              These checks are derived from current catalog fields. They do not prove this provider is official or verified.
            </p>
            {provider.qualityWarnings && provider.qualityWarnings.length > 0 ? (
              <div className="mt-3 space-y-2">
                {provider.qualityWarnings.map((warning) => (
                  <div
                    key={warning.code}
                    className="rounded-xl border border-border bg-muted/40 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{warning.label}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {warning.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{warning.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No automated quality warnings for this record.
              </p>
            )}
          </div>

          {/* contact & links */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-bold text-foreground">Contact &amp; Links</h2>
            <div className="space-y-3 text-sm">
              {provider.website && (
                <a
                  href={provider.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 break-all text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" /> {provider.website}
                </a>
              )}
              {provider.phone && (
                <div className="flex items-center gap-2 text-foreground">
                  <Phone className="h-4 w-4 text-muted-foreground" /> {provider.phone}
                </div>
              )}
              {!provider.website && !provider.phone && (
                <p className="text-muted-foreground">No contact info</p>
              )}
            </div>
          </div>

          {/* tags */}
          {tags.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-bold text-foreground">Tags</h2>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1 text-xs text-muted-foreground"
                  >
                    <Tag className="h-3 w-3" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <CoverageEditor providerId={String(id)} />

      <PasswordConfirmModal
        open={showDeletePrompt}
        title="Delete provider"
        description={`This removes "${provider.name}" from the public catalog and affects matching. Enter your admin password and MFA code to continue.`}
        confirmLabel="Delete Provider"
        busy={deleting}
        error={deleteError}
        requiresMfa={deleteRequiresMfa}
        onClose={() => {
          if (!deleting) {
            setShowDeletePrompt(false);
            setDeleteError(null);
            setDeleteRequiresMfa(true);
          }
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function ProviderStat({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
        {hint ? <InfoHint text={hint} label={label} /> : null}
      </p>
      <p
        className={`mt-1 font-mono text-lg font-semibold ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
