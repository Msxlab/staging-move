import { NextRequest, NextResponse } from "next/server";
import { verifyInternalAuth } from "@/lib/internal-secrets";
import { getConfiguredAppUrl } from "@/lib/app-url";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Production synthetic monitor.
 *
 * Hits a small set of read-only critical paths and returns a structured
 * report. Designed to be called by an external scheduler (DigitalOcean
 * scheduled job, GitHub Actions, Ofelia in docker-compose.prod.yml, etc.)
 * 3× daily — see docs/qa/test-automation-strategy.md for the full strategy.
 *
 * Hard guarantees:
 *   - Read-only. No DB writes. No emails. No payments.
 *   - Bounded by maxDuration; each check has its own per-request timeout.
 *   - Always returns a structured JSON report; never throws.
 *   - Honours TEST_AUTOMATION_ENABLED kill switch (default: enabled).
 *   - CRON_SECRET-gated via the shared verifyInternalAuth helper.
 */

interface CheckResult {
  name: string;
  url: string;
  ok: boolean;
  status: number | null;
  ms: number;
  expected: number | "ok-or-redirect";
  error?: string;
}

interface MonitorReport {
  ok: boolean;
  testRunId: string;
  baseUrl: string;
  durationMs: number;
  checks: CheckResult[];
  failures: string[];
  skipped?: string;
}

const PER_CHECK_TIMEOUT_MS = 8_000;

interface CheckSpec {
  name: string;
  path: string;
  expected: number | "ok-or-redirect";
}

const CHECKS: CheckSpec[] = [
  { name: "homepage", path: "/", expected: 200 },
  { name: "health", path: "/api/health", expected: "ok-or-redirect" },
  { name: "sign-in", path: "/sign-in", expected: 200 },
  { name: "sign-up", path: "/sign-up", expected: 200 },
  { name: "pricing", path: "/pricing", expected: 200 },
  { name: "faq", path: "/faq", expected: 200 },
  { name: "robots", path: "/robots.txt", expected: 200 },
  { name: "sitemap", path: "/sitemap.xml", expected: 200 },
  { name: "dashboard-auth-gate", path: "/dashboard", expected: "ok-or-redirect" },
];

function isAcceptableStatus(spec: CheckSpec, status: number): boolean {
  if (spec.expected === "ok-or-redirect") {
    if (spec.name === "dashboard-auth-gate") {
      // Unauth /dashboard MUST redirect to /sign-in. A 200 means the auth
      // gate is broken and protected pages are leaking — that's a failure.
      return status >= 300 && status < 400;
    }
    return (status >= 200 && status < 300) || (status >= 300 && status < 400);
  }
  return status === spec.expected;
}

async function runCheck(baseUrl: string, spec: CheckSpec): Promise<CheckResult> {
  const url = `${baseUrl}${spec.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CHECK_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        // Identify ourselves so analytics/logs can exclude monitor traffic.
        "user-agent": "LocateFlowSyntheticMonitor/1.0",
        "x-locateflow-synthetic": "1",
      },
      cache: "no-store",
    });
    const ms = Date.now() - start;
    const ok = isAcceptableStatus(spec, res.status);
    return {
      name: spec.name,
      url,
      ok,
      status: res.status,
      ms,
      expected: spec.expected,
      ...(ok ? {} : { error: `unexpected status ${res.status}` }),
    };
  } catch (err) {
    const ms = Date.now() - start;
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? `timeout after ${PER_CHECK_TIMEOUT_MS}ms`
          : err.message
        : "fetch failed";
    return {
      name: spec.name,
      url,
      ok: false,
      status: null,
      ms,
      expected: spec.expected,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildTestRunId(now: Date): string {
  return `synthetic-${now.toISOString().replace(/\.\d{3}Z$/, "Z")}`;
}

function isAutomationEnabled(): boolean {
  // Default: enabled. Operators flip TEST_AUTOMATION_ENABLED=false to silence
  // the monitor mid-incident without redeploying.
  const raw = (process.env.TEST_AUTOMATION_ENABLED || "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}

async function handle(request: NextRequest): Promise<NextResponse<MonitorReport>> {
  const xCronSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const effective = authHeader || (xCronSecret ? `Bearer ${xCronSecret}` : null);
  if (!verifyInternalAuth(effective, "cron")) {
    return NextResponse.json(
      {
        ok: false,
        testRunId: "unauthorized",
        baseUrl: "",
        durationMs: 0,
        checks: [],
        failures: ["unauthorized"],
      },
      { status: 401 },
    );
  }

  const start = Date.now();
  const now = new Date();
  const testRunId = buildTestRunId(now);

  if (!isAutomationEnabled()) {
    return NextResponse.json({
      ok: true,
      testRunId,
      baseUrl: "",
      durationMs: Date.now() - start,
      checks: [],
      failures: [],
      skipped: "TEST_AUTOMATION_ENABLED=false",
    });
  }

  let baseUrl: string;
  try {
    baseUrl = await getConfiguredAppUrl();
  } catch (err) {
    const message = err instanceof Error ? err.message : "app-url-unavailable";
    logger.error("synthetic-monitor: failed to resolve base url", {
      action: "synthetic-monitor",
      testRunId,
      message,
    });
    return NextResponse.json(
      {
        ok: false,
        testRunId,
        baseUrl: "",
        durationMs: Date.now() - start,
        checks: [],
        failures: [`base-url:${message}`],
      },
      { status: 500 },
    );
  }

  const checks = await Promise.all(CHECKS.map((spec) => runCheck(baseUrl, spec)));
  const failures = checks.filter((c) => !c.ok).map((c) => `${c.name}:${c.error || "fail"}`);
  const ok = failures.length === 0;
  const durationMs = Date.now() - start;

  const report: MonitorReport = {
    ok,
    testRunId,
    baseUrl,
    durationMs,
    checks,
    failures,
  };

  if (!ok) {
    logger.error("synthetic-monitor: failures", {
      action: "synthetic-monitor",
      testRunId,
      durationMs,
      failureCount: failures.length,
      failures,
    });
  } else {
    logger.info("synthetic-monitor: ok", {
      action: "synthetic-monitor",
      testRunId,
      durationMs,
      checkCount: checks.length,
    });
  }

  return NextResponse.json(report, { status: ok ? 200 : 503 });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

// GET is allowed so simple uptime probes (statuscake, BetterStack, etc.) that
// only support GET can call the monitor too. Same auth, same response shape.
export async function GET(request: NextRequest) {
  return handle(request);
}
