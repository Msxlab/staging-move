"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  ExternalLink,
  MapPin,
  Pencil,
  Phone,
  Shield,
  Tag,
  Trash2,
  Users,
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

export default function ProviderDetailPage() {
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
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Providers
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.assign(`/providers/${id}/edit`)}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
          <button
            onClick={() => setShowDeletePrompt(true)}
            className="flex items-center gap-2 rounded-lg border border-destructive/30 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-tone-honey-fg" />
          <div className="flex-1">
            <h2 className="font-semibold text-foreground">Provider quality warnings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These checks are derived from current catalog fields. They do not prove this provider is official or verified.
            </p>
            {provider.qualityWarnings && provider.qualityWarnings.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {provider.qualityWarnings.map((warning) => (
                  <div
                    key={warning.code}
                    className="rounded-lg border border-border bg-background/80 p-3"
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
              <p className="mt-3 text-sm text-muted-foreground">
                No automated quality warnings for this record.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-2xl">
            {provider.logoUrl ? (
              <img
                src={provider.logoUrl}
                alt=""
                className="h-12 w-12 rounded-lg object-cover"
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span>{getCategoryIcon(provider.category)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground break-words">{provider.name}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  provider.isActive
                    ? "bg-tone-sage-bg text-tone-sage-fg"
                    : "bg-tone-slate-bg text-muted-foreground"
                }`}
              >
                {provider.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{provider.slug}</p>
            {provider.description && (
              <p className="mt-2 text-sm text-foreground/80">{provider.description}</p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-4xl font-bold text-foreground">{provider.popularityScore}</p>
            <p className="text-xs text-muted-foreground">Popularity Score</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Users}
          tone="purple"
          label="Users"
          value={provider.userCount}
        />
        <StatCard
          icon={Clock}
          tone="cyan"
          label="Last Updated"
          value={new Date(provider.updatedAt).toLocaleDateString()}
        />
        <StatCard
          icon={MapPin}
          tone="amber"
          label="Coverage Rows"
          value={coverageCount}
          hint="Number of geographic service areas mapped to this provider (each row is a state, city, or ZIP/polygon entry that decides where it appears in search)."
        />
        <StatCard
          icon={Shield}
          tone="blue"
          label="Version"
          value={`v${provider.version}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Details</h2>
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
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Contact & Links</h2>
          <div className="space-y-3 text-sm">
            {provider.website && (
              <a
                href={provider.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" /> {provider.website}
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
      </div>

      <CoverageEditor providerId={String(id)} />

      {tags.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-3 font-semibold text-foreground">Tags</h2>
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

      {auditLogs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-3 font-semibold text-foreground">
            Recent Admin Activity
          </h2>
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{log.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {(log.adminUser?.firstName || log.adminUser?.email || "Admin")}
                  {log.adminUser?.lastName ? ` ${log.adminUser.lastName}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

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

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  tone: "purple" | "cyan" | "amber" | "blue";
  hint?: string;
}) {
  const toneMap = {
    purple: "bg-tone-foil-bg text-tone-foil-fg",
    cyan: "bg-tone-cyan-bg text-tone-cyan-fg",
    amber: "bg-tone-honey-bg text-tone-honey-fg",
    blue: "bg-tone-sky-bg text-tone-sky-fg",
  } as const;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {label}
            {hint ? <InfoHint text={hint} label={label} /> : null}
          </p>
        </div>
      </div>
    </div>
  );
}
