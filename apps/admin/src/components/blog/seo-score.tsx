"use client";

/**
 * SEO readiness panel for the post editor.
 *
 * Lints the draft against the rules that *actually* move the needle for
 * Google + AI answer engines: title length, description length, slug
 * shape, cover-image alt presence, excerpt presence, and a body-length
 * floor. Each rule is a one-line judgement (good / warn / bad) with a
 * short note so the editor knows why.
 *
 * This is deliberately *not* a magic AI-powered score — it's the
 * checklist a senior editor would run mentally. Honest, deterministic,
 * and never gives a misleading green bar to a half-finished post.
 */

import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";

type Status = "good" | "warn" | "bad";

interface Rule {
  id: string;
  label: string;
  status: Status;
  note: string;
}

interface SeoScoreProps {
  title: string;
  seoTitle: string;
  excerpt: string;
  seoDescription: string;
  slug: string;
  ogImageKey: string;
  ogImageAlt: string;
  contentText: string; // already-rendered plain text from the post; pass empty for new drafts
}

function lengthRule(opts: {
  id: string;
  label: string;
  value: string;
  ideal: [number, number]; // [min, max] for "good"
  hardMax: number; // beyond this is "bad"
  hint: string;
}): Rule {
  const len = opts.value.trim().length;
  if (len === 0) {
    return { id: opts.id, label: opts.label, status: "warn", note: `Empty — ${opts.hint}` };
  }
  if (len > opts.hardMax) {
    return {
      id: opts.id,
      label: opts.label,
      status: "bad",
      note: `${len} chars — too long, search engines will truncate.`,
    };
  }
  if (len < opts.ideal[0]) {
    return {
      id: opts.id,
      label: opts.label,
      status: "warn",
      note: `${len} chars — short. Aim for ${opts.ideal[0]}–${opts.ideal[1]}.`,
    };
  }
  if (len > opts.ideal[1]) {
    return {
      id: opts.id,
      label: opts.label,
      status: "warn",
      note: `${len} chars — close to truncation. Ideal is ${opts.ideal[0]}–${opts.ideal[1]}.`,
    };
  }
  return { id: opts.id, label: opts.label, status: "good", note: `${len} chars — looks good.` };
}

export function evaluateSeo(props: SeoScoreProps): { rules: Rule[]; score: number } {
  const effectiveTitle = props.seoTitle.trim() || props.title.trim();
  const effectiveDesc = props.seoDescription.trim() || props.excerpt.trim();

  const rules: Rule[] = [
    lengthRule({
      id: "title",
      label: "SEO title",
      value: effectiveTitle,
      ideal: [40, 60],
      hardMax: 70,
      hint: "Google shows ~60 chars in results.",
    }),
    lengthRule({
      id: "description",
      label: "Meta description",
      value: effectiveDesc,
      ideal: [120, 160],
      hardMax: 200,
      hint: "Aim for 120–160 — answer the question the title raises.",
    }),
    (() => {
      const slug = props.slug.trim();
      if (!slug) {
        return { id: "slug", label: "URL slug", status: "warn" as Status, note: "Empty — will be auto-generated from the title." };
      }
      if (slug.length > 75) {
        return { id: "slug", label: "URL slug", status: "warn" as Status, note: `${slug.length} chars — long URLs hurt CTR.` };
      }
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return { id: "slug", label: "URL slug", status: "bad" as Status, note: "Only lowercase letters, numbers, and dashes." };
      }
      return { id: "slug", label: "URL slug", status: "good" as Status, note: `/${slug}` };
    })(),
    (() => {
      if (!props.ogImageKey.trim()) {
        return {
          id: "og-image",
          label: "Cover image",
          status: "warn" as Status,
          note: "No cover — social and AI previews fall back to the site default.",
        };
      }
      if (!props.ogImageAlt.trim()) {
        return {
          id: "og-image-alt",
          label: "Cover alt text",
          status: "warn" as Status,
          note: "Image uploaded but no alt text — accessibility and SEO miss.",
        };
      }
      return { id: "og-image", label: "Cover image", status: "good" as Status, note: "Uploaded with alt text." };
    })(),
    (() => {
      const len = props.contentText.trim().length;
      if (len === 0) {
        return { id: "body", label: "Body length", status: "warn" as Status, note: "Empty — write the post." };
      }
      if (len < 600) {
        return { id: "body", label: "Body length", status: "warn" as Status, note: `~${len} chars — thin. Most ranking posts pass 1,200.` };
      }
      if (len < 1500) {
        return { id: "body", label: "Body length", status: "good" as Status, note: `~${len} chars — solid.` };
      }
      return { id: "body", label: "Body length", status: "good" as Status, note: `~${len} chars — comprehensive.` };
    })(),
  ];

  const goodCount = rules.filter((r) => r.status === "good").length;
  const score = Math.round((goodCount / rules.length) * 100);
  return { rules, score };
}

const STATUS_VARIANTS: Record<Status, { Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  good: { Icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  warn: { Icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
  bad: { Icon: AlertCircle, cls: "text-destructive" },
};

export function SeoScore(props: SeoScoreProps) {
  const { rules, score } = evaluateSeo(props);
  const scoreTone =
    score >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 50
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Discoverability check</h3>
        <span className={`font-mono text-sm font-semibold ${scoreTone}`}>{score}%</span>
      </div>
      <ul className="space-y-2">
        {rules.map((rule) => {
          const variant = STATUS_VARIANTS[rule.status];
          return (
            <li key={rule.id} className="flex items-start gap-2 text-xs">
              <variant.Icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${variant.cls}`} />
              <div className="min-w-0">
                <div className="font-medium text-foreground">{rule.label}</div>
                <div className="text-muted-foreground">{rule.note}</div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
        These are the same checks Google &amp; AI answer engines (ChatGPT, Perplexity, Claude) evaluate when
        deciding whether to surface or cite a page.
      </p>
    </div>
  );
}
