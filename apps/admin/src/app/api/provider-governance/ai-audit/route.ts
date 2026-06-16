export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_TOKENS = 1_200;
const MAX_ISSUES = 12;
const MAX_CANDIDATES_PER_ISSUE = 6;
const TOKEN_RE = /[a-z0-9]+/g;

type IssueRow = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: unknown;
};

type CandidateRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  website: string | null;
  phone: string | null;
  scope: string;
  states: string;
  zipCodes: string;
  tags: string;
};

type AiCandidate = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  phone: string | null;
  scope: string;
  states: string[];
  zipCodes: string[];
  matchSignals: string[];
};

type AiIssue = {
  issueId: string;
  title: string;
  severity: string;
  providerName: string;
  category: string;
  source: string;
  sourceProviderId: string | null;
  evidenceUrl: string | null;
  occurrenceCount: number;
  states: string[];
  zips: string[];
  sampleLocations: string[];
  candidates: AiCandidate[];
};

type AiAction =
  | "add_alias"
  | "create_provider"
  | "update_coverage"
  | "dismiss"
  | "needs_human_research";

type AiConfidence = "low" | "medium" | "high";
type AiRisk = "low" | "medium" | "high";

type AiAnalysisItem = {
  title: string;
  providerName: string;
  category: string;
  recommendedAction: AiAction;
  confidence: AiConfidence;
  reason: string;
  fieldsToCollect: string[];
  suggestedCatalogPatch: {
    officialName: string | null;
    aliases: string[];
    website: string | null;
    phone: string | null;
    coverageNote: string | null;
  };
  matchedCandidateIds: string[];
};

type AiAnalysis = {
  summary: string;
  overallRisk: AiRisk;
  items: AiAnalysisItem[];
};

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function stringList(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

function safeJsonStringList(raw: string | null | undefined, limit = 12): string[] {
  if (!raw) return [];
  try {
    return stringList(JSON.parse(raw), limit);
  } catch {
    return [];
  }
}

function occurrenceCount(metadata: Record<string, unknown>): number {
  return typeof metadata.occurrenceCount === "number" && Number.isFinite(metadata.occurrenceCount)
    ? Math.max(1, Math.floor(metadata.occurrenceCount))
    : 1;
}

function coerceLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return MAX_ISSUES;
  return Math.max(1, Math.min(MAX_ISSUES, Math.floor(value)));
}

function tokens(value: string): Set<string> {
  return new Set((value.toLowerCase().match(TOKEN_RE) || []).filter((token) => token.length > 1));
}

function candidateMatchSignals(providerName: string, issue: AiIssue, candidate: CandidateRow): string[] {
  const signals: string[] = [];
  const issueName = providerName.toLowerCase();
  const candidateName = candidate.name.toLowerCase();
  if (issueName === candidateName) signals.push("exact_name");
  if (issueName.includes(candidateName) || candidateName.includes(issueName)) signals.push("contains_name");

  const issueTokens = tokens(providerName);
  const candidateTokens = tokens(candidate.name);
  const overlap = [...issueTokens].filter((token) => candidateTokens.has(token)).length;
  if (overlap > 0) signals.push(`token_overlap_${overlap}`);

  const candidateStates = safeJsonStringList(candidate.states, 20).map((state) => state.toUpperCase());
  if (issue.states.some((state) => candidateStates.includes(state.toUpperCase()))) signals.push("same_state");
  if (candidate.scope === "FEDERAL") signals.push("federal_scope");
  if (candidate.website) signals.push("has_website");
  if (candidate.phone) signals.push("has_phone");
  return signals;
}

function candidateScore(providerName: string, issue: AiIssue, candidate: CandidateRow): number {
  let score = 0;
  const issueName = providerName.toLowerCase();
  const candidateName = candidate.name.toLowerCase();
  if (issueName === candidateName) score += 100;
  if (issueName.includes(candidateName) || candidateName.includes(issueName)) score += 50;

  const issueTokens = tokens(providerName);
  const candidateTokens = tokens(candidate.name);
  for (const token of issueTokens) {
    if (candidateTokens.has(token)) score += 12;
  }

  const candidateStates = safeJsonStringList(candidate.states, 20).map((state) => state.toUpperCase());
  if (issue.states.some((state) => candidateStates.includes(state.toUpperCase()))) score += 15;
  if (candidate.scope === "FEDERAL") score += 4;
  if (candidate.website) score += 2;
  return score;
}

function toAiIssues(issues: IssueRow[], candidates: CandidateRow[]): AiIssue[] {
  return issues.map((issue) => {
    const metadata = metadataRecord(issue.metadata);
    const aiIssue: AiIssue = {
      issueId: issue.id,
      title: issue.title,
      severity: issue.severity,
      providerName: stringValue(metadata.providerName) || "Unknown provider",
      category: stringValue(metadata.category) || "UNKNOWN",
      source: stringValue(metadata.source) || "UNKNOWN",
      sourceProviderId: stringValue(metadata.sourceProviderId),
      evidenceUrl: stringValue(metadata.evidenceUrl),
      occurrenceCount: occurrenceCount(metadata),
      states: stringList(metadata.states, 8),
      zips: stringList(metadata.zips, 8),
      sampleLocations: stringList(metadata.sampleLocations, 8),
      candidates: [],
    };

    aiIssue.candidates = candidates
      .filter((candidate) => candidate.category === aiIssue.category)
      .map((candidate) => ({
        score: candidateScore(aiIssue.providerName, aiIssue, candidate),
        candidate,
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CANDIDATES_PER_ISSUE)
      .map(({ candidate }) => ({
        id: candidate.id,
        name: candidate.name,
        slug: candidate.slug,
        website: candidate.website,
        phone: candidate.phone,
        scope: candidate.scope,
        states: safeJsonStringList(candidate.states, 20),
        zipCodes: safeJsonStringList(candidate.zipCodes, 20),
        matchSignals: candidateMatchSignals(aiIssue.providerName, aiIssue, candidate),
      }));

    return aiIssue;
  });
}

function buildPrompt(issues: AiIssue[]): string {
  return JSON.stringify(
    {
      task:
        "Analyze LocateFlow provider source gaps and produce admin review guidance. Use only supplied source-gap and catalog-candidate data.",
      guardrails: [
        "Do not browse the web.",
        "Do not invent phone numbers, street addresses, websites, or coverage.",
        "If a provider field is not present in the supplied data, return null and list that field under fieldsToCollect.",
        "Prefer add_alias or update_coverage when an existing catalog candidate plausibly matches the source provider.",
        "Prefer create_provider only when no existing candidate is plausible.",
        "Prefer needs_human_research when the evidence is thin or source/provider naming is ambiguous.",
        "Never include user identifiers, address IDs, emails, names, latitudes, or longitudes; they are intentionally absent.",
      ],
      outputSchema: {
        summary: "string",
        overallRisk: "low | medium | high",
        items: [
          {
            title: "string",
            providerName: "string",
            category: "string",
            recommendedAction: "add_alias | create_provider | update_coverage | dismiss | needs_human_research",
            confidence: "low | medium | high",
            reason: "string",
            fieldsToCollect: ["official website", "phone", "coverage states"],
            suggestedCatalogPatch: {
              officialName: "string or null",
              aliases: ["string"],
              website: "string or null",
              phone: "string or null",
              coverageNote: "string or null",
            },
            matchedCandidateIds: ["serviceProvider.id"],
          },
        ],
      },
      issues,
    },
    null,
    2,
  );
}

function parseModelJson(text: string): unknown {
  const trimmed = text.trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("INVALID_AI_JSON");
  }
}

function actionValue(value: unknown): AiAction {
  return value === "add_alias" ||
    value === "create_provider" ||
    value === "update_coverage" ||
    value === "dismiss" ||
    value === "needs_human_research"
    ? value
    : "needs_human_research";
}

function confidenceValue(value: unknown): AiConfidence {
  return value === "low" || value === "medium" || value === "high" ? value : "low";
}

function riskValue(value: unknown): AiRisk {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 500) : null;
}

function normalizeAnalysis(value: unknown): AiAnalysis | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const rawItems = Array.isArray(source.items) ? source.items : [];
  return {
    summary: nullableString(source.summary) || "AI analysis completed.",
    overallRisk: riskValue(source.overallRisk),
    items: rawItems.slice(0, MAX_ISSUES).map((rawItem): AiAnalysisItem => {
      const item = metadataRecord(rawItem);
      const patch = metadataRecord(item.suggestedCatalogPatch);
      return {
        title: nullableString(item.title) || "Provider gap review",
        providerName: nullableString(item.providerName) || "Unknown provider",
        category: nullableString(item.category) || "UNKNOWN",
        recommendedAction: actionValue(item.recommendedAction),
        confidence: confidenceValue(item.confidence),
        reason: nullableString(item.reason) || "No model rationale returned.",
        fieldsToCollect: stringList(item.fieldsToCollect, 10),
        suggestedCatalogPatch: {
          officialName: nullableString(patch.officialName),
          aliases: stringList(patch.aliases, 10),
          website: nullableString(patch.website),
          phone: nullableString(patch.phone),
          coverageNote: nullableString(patch.coverageNote),
        },
        matchedCandidateIds: stringList(item.matchedCandidateIds, 10),
      };
    }),
  };
}

async function runHaikuAudit(
  apiKey: string,
  issues: AiIssue[],
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<AiAnalysis | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system:
          "You are a cautious provider-data analyst for LocateFlow admins. Return strict JSON only. Use supplied data only. Never invent contact or address facts.",
        messages: [{ role: "user", content: buildPrompt(issues) }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const body = (await response.json().catch(() => null)) as
      | { content?: Array<{ type?: string; text?: string }> }
      | null;
    const text = body?.content
      ?.filter((block) => block?.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("\n")
      .trim();
    if (!text) return null;
    return normalizeAnalysis(parseModelJson(text));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("providers", "canUpdate", { minimumRole: "MODERATOR" });
    const body = await request.json().catch(() => ({}));
    const limit = coerceLimit((body as Record<string, unknown>).limit);

    const apiKey = await getAdminRuntimeConfigValue("ANTHROPIC_API_KEY").catch(() => null);
    if (!apiKey) {
      return NextResponse.json({
        configured: false,
        mode: "haiku_on_demand",
        model: ANTHROPIC_MODEL,
        reason: "ANTHROPIC_API_KEY_MISSING",
        privacy: "No provider gap data was sent because Anthropic is not configured.",
      });
    }

    const issues = await prisma.providerGovernanceIssue.findMany({
      where: { issueType: "SOURCE_PROVIDER_MISSING", status: "OPEN" },
      select: {
        id: true,
        title: true,
        description: true,
        severity: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
      },
      orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
      take: limit,
    });

    const categories = [...new Set(issues.map((issue) => stringValue(metadataRecord(issue.metadata).category)).filter(Boolean))] as string[];
    const candidates = categories.length > 0
      ? await prisma.serviceProvider.findMany({
          where: { deletedAt: null, isActive: true, category: { in: categories } },
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            website: true,
            phone: true,
            scope: true,
            states: true,
            zipCodes: true,
            tags: true,
          },
          orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
          take: 500,
        })
      : [];

    const aiIssues = toAiIssues(issues, candidates);
    if (aiIssues.length === 0) {
      return NextResponse.json({
        configured: true,
        mode: "haiku_on_demand",
        model: ANTHROPIC_MODEL,
        generatedAt: new Date().toISOString(),
        promptStats: { issueCount: 0, candidateCount: 0 },
        analysis: {
          summary: "No open source-backed provider gaps need AI review right now.",
          overallRisk: "low",
          items: [],
        },
      });
    }

    const analysis = await runHaikuAudit(apiKey, aiIssues);
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "GOV_AI_AUDIT",
        entityType: "ProviderGovernanceIssue",
        entityId: "source-gaps",
        changes: JSON.stringify({
          mode: "haiku_on_demand",
          issueCount: aiIssues.length,
          candidateCount: aiIssues.reduce((sum, issue) => sum + issue.candidates.length, 0),
          success: Boolean(analysis),
        }),
      },
    }).catch(() => undefined);

    if (!analysis) {
      return NextResponse.json({
        configured: true,
        mode: "haiku_on_demand",
        model: ANTHROPIC_MODEL,
        generatedAt: new Date().toISOString(),
        error: "AI_ANALYSIS_UNAVAILABLE",
        promptStats: {
          issueCount: aiIssues.length,
          candidateCount: aiIssues.reduce((sum, issue) => sum + issue.candidates.length, 0),
        },
        privacy:
          "Only source/provider metadata was eligible for the model. User emails, names, address IDs, street addresses, latitude, and longitude were excluded.",
        analysis: null,
      });
    }

    return NextResponse.json({
      configured: true,
      mode: "haiku_on_demand",
      model: ANTHROPIC_MODEL,
      generatedAt: new Date().toISOString(),
      promptStats: {
        issueCount: aiIssues.length,
        candidateCount: aiIssues.reduce((sum, issue) => sum + issue.candidates.length, 0),
      },
      privacy:
        "Only source/provider metadata was sent. User emails, names, address IDs, street addresses, latitude, and longitude were excluded.",
      analysis,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to run provider AI audit:", error);
    return NextResponse.json({ error: "Failed to run provider AI audit" }, { status: 500 });
  }
}
