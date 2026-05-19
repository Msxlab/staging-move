#!/usr/bin/env tsx

/**
 * Cross-platform email pipeline diagnostic.
 *
 * This reads effective email config plus recent EmailLog rows through Prisma, so
 * it works with the repository's MySQL datasource and does not need psql/mysql
 * client binaries. It never prints secret values or full recipient addresses.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  getRuntimeConfigDefinition,
  isRuntimeConfigDbBackedKeyAllowed,
  maskRuntimeConfigValue,
  normalizeRuntimeConfigValue,
  shouldPreferEnvRuntimeConfigValue,
  validateRuntimeConfigValueShape,
} from "../packages/shared/src/runtime-config";
import { decrypt } from "../packages/shared/src/encryption";

type Args = {
  days: number;
  recent: number;
  envFiles: string[];
  json: boolean;
  help: boolean;
};

const EMAIL_CONFIG_KEYS = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "NEXT_PUBLIC_APP_URL",
  "SUPPORT_EMAIL",
  "EMAIL_REPLY_TO",
  "RESEND_WEBHOOK_SECRET",
] as const;

const REQUIRED_TEMPLATE_SLUGS = [
  "email-verify",
  "password-reset",
  "welcome",
  "bill-reminder",
  "weekly-digest",
  "contract-reminder",
  "subscription-activated",
  "subscription-canceled",
  "payment-failed",
] as const;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    days: 7,
    recent: 20,
    envFiles: [],
    json: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--json") args.json = true;
    else if (arg.startsWith("--days=")) args.days = Number(arg.slice("--days=".length));
    else if (arg.startsWith("--recent=")) args.recent = Number(arg.slice("--recent=".length));
    else if (arg.startsWith("--env-file=")) args.envFiles.push(arg.slice("--env-file=".length));
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(args.days) || args.days <= 0 || args.days > 365) {
    throw new Error("--days must be a number between 1 and 365");
  }
  if (!Number.isFinite(args.recent) || args.recent <= 0 || args.recent > 200) {
    throw new Error("--recent must be a number between 1 and 200");
  }

  args.days = Math.floor(args.days);
  args.recent = Math.floor(args.recent);
  return args;
}

function printHelp() {
  console.log(`Email pipeline diagnostic

Usage:
  pnpm email:diagnose
  pnpm email:diagnose -- --days=30 --recent=50
  pnpm email:diagnose -- --env-file=.env.production --json

Required:
  DATABASE_URL must point at the environment you want to inspect.

Optional:
  --days=N          Window for EmailLog counts. Default: 7
  --recent=N        Recent rows to print. Default: 20
  --env-file=PATH   Load env values from a dotenv file before running.
  --json            Emit machine-readable JSON.
`);
}

async function loadEnvFiles(files: string[]) {
  const dotenv = await import("dotenv").catch(() => null);
  if (!dotenv) return;

  const defaultFiles = [".env", ".env.local", "apps/web/.env", "apps/web/.env.local"];
  const uniqueFiles = [...new Set([...files, ...defaultFiles])];
  for (const file of uniqueFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      dotenv.config({ path: fullPath, override: false });
    }
  }
}

function maskEmail(email: string | null | undefined) {
  if (!email || !email.includes("@")) return email || null;
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${head || "*"}***@${domain}`;
}

function safeError(value: string | null | undefined) {
  if (!value) return null;
  return value
    .replace(/\bre_[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .slice(0, 500);
}

function parseMetadata(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function classifyFailure(error: string | null, metadata: Record<string, unknown>) {
  const message = error || "";
  if (metadata.configError === true) return "config";
  if (/RESEND_API_KEY|EMAIL_FROM|NEXT_PUBLIC_APP_URL|SUPPORT_EMAIL|EMAIL_REPLY_TO|missing|invalid/i.test(message)) {
    return "config";
  }
  if (/domain|verified|permission|api key|rate|quota|recipient|from|sender|resend/i.test(message)) {
    return "provider";
  }
  if (/template.*missing|template.*inactive|unavailable/i.test(message)) {
    return "template";
  }
  return "unknown";
}

function resolveStoredValue(entry: {
  isSecret: boolean;
  valueEncrypted: string | null;
  valuePlain: string | null;
  isActive: boolean;
} | null | undefined) {
  if (!entry || !entry.isActive) return { value: null, decryptError: null as string | null };
  if (!entry.isSecret) return { value: entry.valuePlain, decryptError: null };
  if (!entry.valueEncrypted) return { value: null, decryptError: null };
  try {
    return { value: decrypt(entry.valueEncrypted), decryptError: null };
  } catch (error) {
    return {
      value: null,
      decryptError: error instanceof Error ? error.message : "decrypt_failed",
    };
  }
}

async function buildConfigReport(prisma: PrismaClient) {
  const rows = await prisma.runtimeConfigEntry.findMany({
    where: { key: { in: [...EMAIL_CONFIG_KEYS] } },
    select: {
      key: true,
      isSecret: true,
      valueEncrypted: true,
      valuePlain: true,
      isActive: true,
      source: true,
    },
  });
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return EMAIL_CONFIG_KEYS.map((key) => {
    const definition = getRuntimeConfigDefinition(key);
    const envValue = normalizeRuntimeConfigValue(process.env[key]);
    const preferEnv = shouldPreferEnvRuntimeConfigValue(key, process.env);
    const db = byKey.get(key);
    const stored = resolveStoredValue(db);
    const dbValue = normalizeRuntimeConfigValue(stored.value);
    const dbAllowed = definition ? isRuntimeConfigDbBackedKeyAllowed(definition) : false;
    const effectiveValue = envValue && preferEnv ? envValue : dbValue && dbAllowed ? dbValue : envValue;
    const validation = validateRuntimeConfigValueShape(key, effectiveValue);
    const source = envValue && preferEnv
      ? "ENV"
      : dbValue && dbAllowed
        ? "Runtime Config"
        : envValue
          ? "ENV"
          : db
            ? "Runtime Config (inactive or ignored)"
            : "Missing";

    return {
      key,
      configured: Boolean(effectiveValue && validation.ok),
      source,
      validation: effectiveValue ? (validation.ok ? validation.warning || "valid" : validation.reason) : "missing",
      maskedValue: effectiveValue
        ? maskRuntimeConfigValue(effectiveValue, definition?.maskStrategy || "secret")
        : null,
      dbOverrideIgnored: Boolean(envValue && dbValue && preferEnv),
      decryptError: stored.decryptError,
    };
  });
}

async function buildEmailLogReport(prisma: PrismaClient, days: number, recentLimit: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const pendingCutoff = new Date(Date.now() - 5 * 60 * 1000);

  const [
    byStatus,
    byTemplateStatus,
    recent,
    failedForAggregation,
    stuckPending,
    requiredTemplates,
  ] = await Promise.all([
    prisma.emailLog.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.emailLog.groupBy({
      by: ["templateId", "status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: recentLimit,
      select: {
        createdAt: true,
        status: true,
        to: true,
        subject: true,
        error: true,
        providerMessageId: true,
        metadata: true,
        template: { select: { slug: true, name: true } },
      },
    }),
    prisma.emailLog.findMany({
      where: { status: "FAILED", createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { error: true, metadata: true },
    }),
    prisma.emailLog.count({
      where: { status: "PENDING", createdAt: { lt: pendingCutoff } },
    }),
    prisma.emailTemplate.findMany({
      where: { slug: { in: [...REQUIRED_TEMPLATE_SLUGS] } },
      select: { slug: true, isActive: true, subject: true, body: true },
    }),
  ]);

  const statusCounts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all]));
  const templateIds = [...new Set(byTemplateStatus.map((row) => row.templateId).filter(Boolean) as string[])];
  const templates = templateIds.length
    ? await prisma.emailTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, slug: true, name: true },
      })
    : [];
  const templateLookup = new Map(templates.map((template) => [template.id, template]));
  const templateCounts = new Map<string, {
    templateId: string | null;
    slug: string | null;
    name: string;
    sent: number;
    failed: number;
    pending: number;
    bounced: number;
    total: number;
  }>();
  for (const row of byTemplateStatus) {
    const key = row.templateId || "(no-template)";
    const template = row.templateId ? templateLookup.get(row.templateId) : null;
    const current = templateCounts.get(key) || {
      templateId: row.templateId,
      slug: template?.slug || null,
      name: template?.name || "(no template)",
      sent: 0,
      failed: 0,
      pending: 0,
      bounced: 0,
      total: 0,
    };
    const count = row._count._all;
    current.total += count;
    if (row.status === "SENT") current.sent += count;
    else if (row.status === "FAILED") current.failed += count;
    else if (row.status === "PENDING") current.pending += count;
    else if (row.status === "BOUNCED") current.bounced += count;
    templateCounts.set(key, current);
  }

  const failureBuckets = new Map<string, { count: number; classification: string }>();
  for (const row of failedForAggregation) {
    const metadata = parseMetadata(row.metadata);
    const message = safeError(row.error) || "(no message)";
    const key = message.slice(0, 200);
    const current = failureBuckets.get(key) || { count: 0, classification: classifyFailure(row.error, metadata) };
    current.count += 1;
    failureBuckets.set(key, current);
  }

  const knownTemplateSlugs = new Map(requiredTemplates.map((template) => [template.slug, template]));
  const missingOrInactiveRequiredTemplates = REQUIRED_TEMPLATE_SLUGS
    .map((slug) => {
      const template = knownTemplateSlugs.get(slug);
      if (!template) return { slug, reason: "missing" };
      if (!template.isActive) return { slug, reason: "inactive" };
      if (!template.subject.trim()) return { slug, reason: "empty_subject" };
      if (!template.body.trim()) return { slug, reason: "empty_body" };
      return null;
    })
    .filter(Boolean);

  return {
    windowDays: days,
    since: since.toISOString(),
    statusCounts,
    stuckPending,
    byTemplate: [...templateCounts.values()].sort((a, b) => b.total - a.total),
    topFailures: [...failureBuckets.entries()]
      .map(([message, value]) => ({ message, ...value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    recent: recent.map((row) => {
      const metadata = parseMetadata(row.metadata);
      return {
        createdAt: row.createdAt.toISOString(),
        status: row.status,
        to: maskEmail(row.to),
        subject: row.subject,
        templateSlug: row.template?.slug || null,
        providerMessageId: row.providerMessageId ? `${row.providerMessageId.slice(0, 8)}...` : null,
        error: safeError(row.error),
        classification: row.status === "FAILED" ? classifyFailure(row.error, metadata) : null,
      };
    }),
    missingOrInactiveRequiredTemplates,
  };
}

function formatTable(rows: string[][]) {
  const widths = rows[0].map((_, index) => Math.max(...rows.map((row) => row[index]?.length || 0)));
  return rows
    .map((row, rowIndex) => {
      const line = row.map((cell, index) => cell.padEnd(widths[index])).join("  ");
      if (rowIndex === 0) {
        return `${line}\n${widths.map((width) => "-".repeat(width)).join("  ")}`;
      }
      return line;
    })
    .join("\n");
}

function printHuman(report: Awaited<ReturnType<typeof buildReport>>) {
  console.log("== Email Config ==");
  console.log(formatTable([
    ["key", "configured", "source", "validation", "value"],
    ...report.config.map((row) => [
      row.key,
      row.configured ? "yes" : "no",
      row.source,
      row.decryptError ? `decrypt_error: ${row.decryptError}` : String(row.validation || ""),
      row.maskedValue || "-",
    ]),
  ]));

  const ignoredOverrides = report.config.filter((row) => row.dbOverrideIgnored).map((row) => row.key);
  if (ignoredOverrides.length > 0) {
    console.log(`\nDB runtime config ignored because ENV is authoritative: ${ignoredOverrides.join(", ")}`);
  }

  console.log(`\n== EmailLog Activity (${report.logs.windowDays} days) ==`);
  const statusRows = Object.entries(report.logs.statusCounts).map(([status, count]) => [status, String(count)]);
  console.log(statusRows.length ? formatTable([["status", "count"], ...statusRows]) : "No EmailLog rows in this window.");
  console.log(`Pending older than 5 minutes: ${report.logs.stuckPending}`);

  if (report.logs.missingOrInactiveRequiredTemplates.length > 0) {
    console.log("\n== Required Templates ==");
    console.log(formatTable([
      ["slug", "reason"],
      ...report.logs.missingOrInactiveRequiredTemplates.map((row) => [row.slug, row.reason]),
    ]));
  }

  if (report.logs.topFailures.length > 0) {
    console.log("\n== Top Failure Reasons (30 days, last 500 failures) ==");
    console.log(formatTable([
      ["count", "class", "message"],
      ...report.logs.topFailures.map((row) => [
        String(row.count),
        row.classification,
        row.message,
      ]),
    ]));
  }

  if (report.logs.byTemplate.length > 0) {
    console.log("\n== By Template ==");
    console.log(formatTable([
      ["template", "sent", "failed", "pending", "bounced", "total"],
      ...report.logs.byTemplate.slice(0, 15).map((row) => [
        row.slug || row.name,
        String(row.sent),
        String(row.failed),
        String(row.pending),
        String(row.bounced),
        String(row.total),
      ]),
    ]));
  }

  if (report.logs.recent.length > 0) {
    console.log("\n== Recent EmailLog Rows ==");
    console.log(formatTable([
      ["createdAt", "status", "class", "to", "template", "error"],
      ...report.logs.recent.map((row) => [
        row.createdAt,
        row.status,
        row.classification || "-",
        row.to || "-",
        row.templateSlug || "-",
        row.error || "-",
      ]),
    ]));
  }
}

async function buildReport(prisma: PrismaClient, args: Args) {
  const [config, logs] = await Promise.all([
    buildConfigReport(prisma),
    buildEmailLogReport(prisma, args.days, args.recent),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    productionLike: (
      process.env.NODE_ENV === "production" ||
      ["production", "staging", "preview"].includes((process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase()) ||
      Boolean(process.env.DIGITALOCEAN_APP_ID)
    ),
    config,
    logs,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  await loadEnvFiles(args.envFiles);
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Pass --env-file=PATH or set it in the shell.");
  }

  const prisma = new PrismaClient();
  try {
    const report = await buildReport(prisma, args);
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printHuman(report);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
