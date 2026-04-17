"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Star,
  ExternalLink,
  Phone,
  Users,
  Building2,
  MapPin,
  Flag,
  AlertTriangle,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryLabel,
} from "@/lib/recommendation-engine";

export interface ProviderDetail {
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
  states: string[];
  zipCodes: string[];
  tags: string[];
  popularityScore: number;
  displayOrder: number;
  avgRating?: number | null;
  reviewCount?: number;
  userCount?: number;
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorFirstName: string | null;
}

interface AddressSummary {
  id: string;
  state: string;
  zip: string;
  city: string;
  nickname: string | null;
}

interface StateRuleSummary {
  stateCode: string;
  stateName: string;
  dmvRules: string | null;
  voterRegistration: string | null;
  taxInfo: string | null;
}

const GOVERNMENT_WITH_RULES = new Set([
  "GOVERNMENT_DMV",
  "GOVERNMENT_VOTER",
  "GOVERNMENT_TAX",
  "GOVERNMENT_ID",
  "GOVERNMENT_IMMIGRATION",
]);

function formatCount(n: number | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          width={size}
          height={size}
          className={
            n <= value
              ? "text-amber-400 fill-amber-400"
              : "text-white/15"
          }
        />
      ))}
    </span>
  );
}

function RatingModal({
  open,
  initial,
  providerId,
  onClose,
  onSaved,
  onDeleted,
  hasExisting,
}: {
  open: boolean;
  initial: { rating: number; comment: string };
  providerId: string;
  onClose: () => void;
  onSaved: (next: { rating: number; comment: string; avgRating: number | null; reviewCount: number }) => void;
  onDeleted: () => void;
  hasExisting: boolean;
}) {
  const [rating, setRating] = useState(initial.rating);
  const [comment, setComment] = useState(initial.comment);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (rating < 1) {
      toast.error("Pick a rating from 1 to 5 stars.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/providers/${encodeURIComponent(providerId)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Couldn't save your review.");
        return;
      }
      onSaved({
        rating,
        comment: comment.trim(),
        avgRating: data.avgRating ?? null,
        reviewCount: data.reviewCount ?? 0,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!hasExisting) return;
    if (!confirm("Remove your review?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/providers/${encodeURIComponent(providerId)}/reviews`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Couldn't remove your review.");
        return;
      }
      onDeleted();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1014] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Rate this provider</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              aria-pressed={rating >= n}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={
                  rating >= n
                    ? "h-9 w-9 text-amber-400 fill-amber-400"
                    : "h-9 w-9 text-white/20"
                }
              />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Share what worked or didn't (optional)"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/40"
        />
        <div className="flex items-center justify-between gap-2">
          {hasExisting && (
            <button
              onClick={remove}
              disabled={deleting || saving}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Remove
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={saving || deleting}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || deleting || rating < 1}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {hasExisting ? "Update rating" : "Submit rating"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProviderDetailClient({
  provider,
  alternatives,
  reviews: initialReviews,
  myReview: initialMyReview,
  primaryAddress,
  stateRule,
}: {
  provider: ProviderDetail;
  alternatives: ProviderDetail[];
  reviews: ReviewItem[];
  myReview: { rating: number; comment: string | null } | null;
  primaryAddress: AddressSummary | null;
  stateRule: StateRuleSummary | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [aggregate, setAggregate] = useState<{ avgRating: number | null; reviewCount: number }>({
    avgRating: provider.avgRating ?? null,
    reviewCount: provider.reviewCount ?? 0,
  });
  const [myReview, setMyReview] = useState<{ rating: number; comment: string | null } | null>(
    initialMyReview
  );
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);

  const addCta = useMemo(() => {
    const query = new URLSearchParams({
      providerId: provider.id,
      category: provider.category,
    });
    return `/services/new?${query.toString()}`;
  }, [provider.id, provider.category]);

  const showStateRule =
    GOVERNMENT_WITH_RULES.has(provider.category) &&
    stateRule &&
    (stateRule.dmvRules || stateRule.voterRegistration || stateRule.taxInfo);

  const stateRuleText = stateRule
    ? provider.category === "GOVERNMENT_VOTER"
      ? stateRule.voterRegistration
      : provider.category === "GOVERNMENT_TAX"
        ? stateRule.taxInfo
        : stateRule.dmvRules
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/providers"
        className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition"
      >
        <ArrowLeft className="h-3 w-3" /> Back to providers
      </Link>

      {/* Header Card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl overflow-hidden">
            {provider.logoUrl ? (
              // Logos are arbitrary third-party URLs — use plain img so we skip next/image domain config.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={provider.logoUrl} alt={`${provider.name} logo`} className="h-full w-full object-contain" />
            ) : (
              getMergedDisplayCategoryIcon(provider.category)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-white">{provider.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-white/50">
                {getMergedDisplayCategoryLabel(provider.category)}
              </span>
              {provider.scope === "FEDERAL" ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300 flex items-center gap-1">
                  <Flag className="h-2.5 w-2.5" /> Federal
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/60 flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" /> State
                </span>
              )}
              {aggregate.avgRating ? (
                <span className="text-xs text-white/70 flex items-center gap-1">
                  <StarRow value={Math.round(aggregate.avgRating)} size={12} />
                  {aggregate.avgRating.toFixed(1)} ({aggregate.reviewCount})
                </span>
              ) : (
                <span className="text-xs text-white/40">No ratings yet</span>
              )}
            </div>
          </div>
        </div>

        {provider.description && (
          <p className="text-sm text-white/70 leading-relaxed">{provider.description}</p>
        )}

        {/* Primary CTA */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href={addCta}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold hover:from-orange-600 hover:to-orange-700 transition"
          >
            + Add as my service <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white/80 hover:bg-white/10 transition"
          >
            <Star className="h-4 w-4 text-amber-400" />
            {myReview ? "Update your review" : "Rate this provider"}
          </button>
          {provider.website && (
            <a
              href={provider.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white/80 hover:bg-white/10 transition"
            >
              <ExternalLink className="h-4 w-4" /> Website
            </a>
          )}
          {provider.phone && (
            <a
              href={`tel:${provider.phone}`}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white/80 hover:bg-white/10 transition"
            >
              <Phone className="h-4 w-4" /> Call
            </a>
          )}
        </div>
      </div>

      {/* Community signal */}
      {provider.userCount && provider.userCount > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
            <Users className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {formatCount(provider.userCount)} people
              {primaryAddress?.state ? ` in ${primaryAddress.state}` : ""} use this provider
            </p>
            <p className="text-xs text-white/40">
              Popularity-based signal from LocateFlow users
            </p>
          </div>
        </div>
      )}

      {/* State rule card */}
      {showStateRule && stateRuleText && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300">
              {stateRule!.stateName} deadline reminder
            </p>
            <p className="text-[13px] text-amber-200/90 mt-1 leading-relaxed">{stateRuleText}</p>
          </div>
        </div>
      )}

      {/* Your review */}
      {myReview && (
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="text-xs font-semibold text-orange-300 mb-2">Your review</p>
          <StarRow value={myReview.rating} />
          {myReview.comment && (
            <p className="text-sm text-white/70 mt-2">{myReview.comment}</p>
          )}
        </div>
      )}

      {/* Other reviews */}
      {reviews.filter((r) => !myReview || r.rating !== myReview.rating || r.comment !== myReview.comment).length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">Recent reviews</h2>
          <ul className="space-y-3">
            {reviews.slice(0, 5).map((r) => (
              <li key={r.id} className="border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <StarRow value={r.rating} />
                  <span className="text-xs text-white/60">
                    {r.authorFirstName || "Someone"} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {r.comment && (
                  <p className="text-sm text-white/70 mt-1.5">{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">
            Other {getMergedDisplayCategoryLabel(provider.category)} options
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {alternatives.map((a) => (
              <Link
                key={a.id}
                href={`/providers/${a.id}`}
                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.08] transition p-3 flex items-start gap-3"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xl">
                  {getMergedDisplayCategoryIcon(a.category)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                  {a.description && (
                    <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{a.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-white/40">
                    {a.avgRating ? (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />{" "}
                        {a.avgRating.toFixed(1)}
                      </span>
                    ) : null}
                    {a.userCount && a.userCount > 0 ? (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {formatCount(a.userCount)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Details block */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 text-sm">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Building2 className="h-4 w-4 text-white/50" /> Provider details
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div>
            <p className="text-white/40">Coverage</p>
            <p className="text-white/80 mt-0.5">
              {provider.scope === "FEDERAL"
                ? "All U.S. states"
                : provider.states.length > 0
                  ? provider.states.join(", ")
                  : "State-scoped"}
            </p>
          </div>
          {provider.tags.length > 0 && (
            <div>
              <p className="text-white/40">Tags</p>
              <p className="text-white/80 mt-0.5">{provider.tags.join(" · ")}</p>
            </div>
          )}
          {provider.subCategory && (
            <div>
              <p className="text-white/40">Sub-category</p>
              <p className="text-white/80 mt-0.5">{provider.subCategory}</p>
            </div>
          )}
          {provider.popularityScore > 0 && (
            <div>
              <p className="text-white/40">Popularity</p>
              <p className="text-white/80 mt-0.5">{provider.popularityScore}</p>
            </div>
          )}
        </div>
      </div>

      <RatingModal
        open={modalOpen}
        providerId={provider.id}
        initial={{ rating: myReview?.rating ?? 0, comment: myReview?.comment ?? "" }}
        hasExisting={!!myReview}
        onClose={() => setModalOpen(false)}
        onSaved={({ rating, comment, avgRating, reviewCount }) => {
          setMyReview({ rating, comment });
          setAggregate({ avgRating, reviewCount });
          // Insert/replace my review in the list
          setReviews((prev) => {
            const withoutMine = prev.filter((r) => r.authorFirstName !== "You");
            return [
              {
                id: "mine-" + Date.now(),
                rating,
                comment: comment || null,
                createdAt: new Date().toISOString(),
                authorFirstName: "You",
              },
              ...withoutMine,
            ];
          });
          toast.success("Review saved");
        }}
        onDeleted={() => {
          setMyReview(null);
          setAggregate((prev) => ({
            avgRating: prev.reviewCount > 1 ? prev.avgRating : null,
            reviewCount: Math.max(0, prev.reviewCount - 1),
          }));
          setReviews((prev) => prev.filter((r) => r.authorFirstName !== "You"));
          toast.success("Review removed");
        }}
      />
    </div>
  );
}
