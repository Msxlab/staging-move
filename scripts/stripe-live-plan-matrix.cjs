#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BASE = process.env.LOCATEFLOW_QA_BASE_URL || "https://locateflow-staging-owew7.ondigitalocean.app";
const EMAIL = process.env.QA_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;
const SECRET_FILE =
  process.env.STRIPE_QA_SECRET_FILE ||
  path.join(os.tmpdir(), "locateflow-stripe-qa-secrets-20260603.json");
const LOG_PATH =
  process.env.STRIPE_MATRIX_LOG ||
  path.join(os.tmpdir(), `locateflow-plan-matrix-v2-${Date.now()}.jsonl`);
const SUMMARY_PATH =
  process.env.STRIPE_MATRIX_SUMMARY ||
  path.join(os.tmpdir(), `locateflow-plan-matrix-v2-${Date.now()}.json`);
const FORCE_RESET = ["1", "true", "yes"].includes(
  String(process.env.STRIPE_MATRIX_FORCE_RESET || "").toLowerCase(),
);

const DEFAULT_SOURCES = [
  { plan: "INDIVIDUAL", interval: "YEAR" },
  { plan: "FAMILY", interval: "MONTH" },
  { plan: "FAMILY", interval: "YEAR" },
  { plan: "PRO", interval: "MONTH" },
  { plan: "PRO", interval: "YEAR" },
];
const TARGETS = [
  { plan: "INDIVIDUAL", interval: "MONTH" },
  { plan: "INDIVIDUAL", interval: "YEAR" },
  { plan: "FAMILY", interval: "MONTH" },
  { plan: "FAMILY", interval: "YEAR" },
  { plan: "PRO", interval: "MONTH" },
  { plan: "PRO", interval: "YEAR" },
];
const TIER_RANK = { INDIVIDUAL: 1, FAMILY: 2, PRO: 3 };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseSources() {
  const raw = process.env.STRIPE_MATRIX_SOURCES;
  if (!raw) return DEFAULT_SOURCES;
  return raw.split(",").map((part) => {
    const [plan, interval] = part.trim().split("_");
    if (!TIER_RANK[plan] || !["MONTH", "YEAR"].includes(interval)) {
      throw new Error(`Invalid STRIPE_MATRIX_SOURCES entry: ${part}`);
    }
    return { plan, interval };
  });
}

function log(event) {
  const line = JSON.stringify({ ...event, at: new Date().toISOString() });
  fs.appendFileSync(LOG_PATH, `${line}\n`);
  console.log(line);
}

function requireEnv() {
  if (!EMAIL || !PASSWORD) throw new Error("QA_EMAIL and QA_PASSWORD are required.");
  if (!fs.existsSync(SECRET_FILE)) throw new Error(`Stripe QA secret file not found: ${SECRET_FILE}`);
}

function form(obj) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) params.append(key, String(value));
  }
  return params;
}

function cycle(interval) {
  return interval === "YEAR" ? "yearly" : "monthly";
}

function isReduction(source, target) {
  return (
    TIER_RANK[target.plan] < TIER_RANK[source.plan] ||
    (TIER_RANK[target.plan] === TIER_RANK[source.plan] &&
      source.interval === "YEAR" &&
      target.interval === "MONTH")
  );
}

function summarizeSubscription(body) {
  const subscription = body && body.subscription ? body.subscription : {};
  const entitlement = body && body.entitlement ? body.entitlement : {};
  return {
    plan: subscription.plan || null,
    status: subscription.status || null,
    provider: subscription.provider || null,
    accessType: subscription.accessType || null,
    billingInterval: subscription.billingInterval || null,
    currentPeriodEndsAt: subscription.currentPeriodEndsAt || null,
    pendingPlan: subscription.pendingPlan || null,
    pendingBillingInterval: subscription.pendingBillingInterval || null,
    pendingBillingIntervalEffectiveAt: subscription.pendingBillingIntervalEffectiveAt || null,
    entitlementActive: entitlement.isActive ?? null,
    managementKind: entitlement.managementKind || null,
  };
}

function shouldUseSwitchCycle(source, target) {
  return source.plan === "INDIVIDUAL" && source.plan === target.plan;
}

function changeAppliedKind(source, target, response) {
  if (shouldUseSwitchCycle(source, target)) {
    if (response.body?.scheduled === true) return "scheduled";
    if (response.status === 200) return "immediate";
    return null;
  }
  return response.body?.applied || null;
}

function changeError(response) {
  return response.body?.error || null;
}

function makeClient() {
  const jar = new Map();
  function storeCookies(res) {
    const cookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : res.headers.get("set-cookie")
          ? [res.headers.get("set-cookie")]
          : [];
    for (const cookie of cookies) {
      const first = cookie.split(";")[0];
      const index = first.indexOf("=");
      if (index > 0) jar.set(first.slice(0, index), first.slice(index + 1));
    }
  }
  return {
    async req(route, options = {}) {
      const headers = {
        "content-type": "application/json",
        ...(options.headers || {}),
      };
      const cookie = Array.from(jar, ([key, value]) => `${key}=${value}`).join("; ");
      if (cookie) headers.cookie = cookie;
      const res = await fetch(`${BASE}${route}`, {
        redirect: "manual",
        ...options,
        headers,
      });
      storeCookies(res);
      const text = await res.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text.slice(0, 500);
      }
      return {
        status: res.status,
        body,
        retryAfter: Number(res.headers.get("retry-after") || 0),
      };
    },
  };
}

async function reqRetry(client, label, route, options) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const response = await client.req(route, options);
    if (response.status !== 429) return response;
    const waitSeconds = Math.max(response.retryAfter || 0, 31);
    log({ event: "rate_limit_wait", label, waitSeconds, attempt });
    await delay(waitSeconds * 1000);
  }
  return client.req(route, options);
}

async function stripePost(auth, route, data) {
  const res = await fetch(`https://api.stripe.com/v1${route}`, {
    method: "POST",
    headers: {
      authorization: auth,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form(data),
  });
  const body = await res.json().catch(() => null);
  if (res.status >= 400) {
    throw new Error(`stripe ${route} ${res.status} ${body?.error?.message || "unknown"}`);
  }
  return body;
}

async function registerQaAccount(client) {
  const registerResponse = await reqRetry(client, "register", "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      firstName: "Mobile",
      lastName: "QA",
      legalConsents: {
        termsAccepted: true,
        disclaimerAccepted: true,
        termsVersion: "qa-2026-06-03",
        disclaimerVersion: "qa-2026-06-03",
        acceptedAt: new Date().toISOString(),
      },
    }),
  });
  if (registerResponse.status !== 201) {
    throw new Error(`register failed ${registerResponse.status}`);
  }
}

async function ensureSession(client) {
  async function login() {
    return reqRetry(client, "login", "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
  }

  if (FORCE_RESET) {
    log({ event: "force_reset_start" });
    await registerQaAccount(client);
    log({ event: "force_reset_complete" });
  }

  let loginResponse = await login();
  if (loginResponse.status === 401) {
    await registerQaAccount(client);
    loginResponse = await login();
  }
  if (loginResponse.status !== 200) {
    throw new Error(`login failed ${loginResponse.status}`);
  }

  const profile = await reqRetry(client, "profile-session", "/api/profile", { method: "GET" });
  if (profile.status !== 200 || !profile.body?.user?.id) {
    throw new Error(`profile failed ${profile.status}`);
  }
  return profile.body.user.id;
}

async function pollProfile(client, label, predicate, timeoutMs = 120000) {
  const start = Date.now();
  let latest = null;
  while (Date.now() - start < timeoutMs) {
    latest = await reqRetry(client, label, "/api/profile", { method: "GET" });
    if (latest.status === 200 && predicate(latest.body)) return latest;
    await delay(5000);
  }
  return latest;
}

async function createStripeSource({ auth, priceMap, userId, source }) {
  const customer = await stripePost(auth, "/customers", {
    email: EMAIL,
    source: "tok_visa",
    "metadata[userId]": userId,
    "metadata[qa]": "subscription-matrix",
  });
  const price = priceMap[`${source.plan}_${source.interval}`];
  if (!price) throw new Error(`Missing price for ${source.plan}_${source.interval}`);
  const subscription = await stripePost(auth, "/subscriptions", {
    customer: customer.id,
    "items[0][price]": price,
    payment_behavior: "error_if_incomplete",
    "metadata[userId]": userId,
    "metadata[plan]": source.plan,
    "metadata[billingInterval]": source.interval,
    "metadata[cycle]": cycle(source.interval),
    "metadata[provider]": "STRIPE",
    "metadata[platform]": "web",
    "expand[]": "items",
  });
  return {
    subscriptionId: subscription.id,
    customerId: customer.id,
  };
}

async function main() {
  requireEnv();
  fs.writeFileSync(LOG_PATH, "");
  const sources = parseSources();
  const secrets = JSON.parse(fs.readFileSync(SECRET_FILE, "utf8"));
  const auth = `Basic ${Buffer.from(`${secrets.stripeSecret}:`).toString("base64")}`;
  const priceMap = {
    INDIVIDUAL_MONTH: secrets.prices.STRIPE_PRICE_INDIVIDUAL_MONTHLY,
    INDIVIDUAL_YEAR: secrets.prices.STRIPE_PRICE_INDIVIDUAL_YEARLY,
    FAMILY_MONTH: secrets.prices.STRIPE_PRICE_FAMILY_MONTHLY,
    FAMILY_YEAR: secrets.prices.STRIPE_PRICE_FAMILY_YEARLY,
    PRO_MONTH: secrets.prices.STRIPE_PRICE_PRO_MONTHLY,
    PRO_YEAR: secrets.prices.STRIPE_PRICE_PRO_YEARLY,
  };
  const client = makeClient();
  const userId = await ensureSession(client);
  const results = [];
  const createdSubscriptions = [];

  log({ event: "matrix_start", base: BASE, sources, targets: TARGETS, logPath: LOG_PATH, summaryPath: SUMMARY_PATH });
  for (const source of sources) {
    log({ event: "source_start", source });
    for (const target of TARGETS) {
      const label = `${source.plan}_${source.interval}->${target.plan}_${target.interval}`;
      const stripeSource = await createStripeSource({ auth, priceMap, userId, source });
      createdSubscriptions.push(stripeSource.subscriptionId);
      const sourceProfile = await pollProfile(
        client,
        `source-${label}`,
        (body) => {
          const subscription = body.subscription || {};
          return (
            subscription.provider === "STRIPE" &&
            subscription.plan === source.plan &&
            subscription.billingInterval === source.interval &&
            subscription.status === "ACTIVE" &&
            Boolean(subscription.currentPeriodEndsAt)
          );
        },
        120000,
      );
      const sourceOk = sourceProfile.status === 200 && Boolean(sourceProfile.body?.subscription?.currentPeriodEndsAt);
      await delay(2500);
      const stableSourceProfile = await pollProfile(
        client,
        `stable-source-${label}`,
        (body) => {
          const subscription = body.subscription || {};
          return (
            subscription.provider === "STRIPE" &&
            subscription.plan === source.plan &&
            subscription.billingInterval === source.interval &&
            subscription.status === "ACTIVE" &&
            Boolean(subscription.currentPeriodEndsAt)
          );
        },
        30000,
      );
      const stableSourceOk =
        stableSourceProfile.status === 200 &&
        stableSourceProfile.body?.subscription?.plan === source.plan &&
        stableSourceProfile.body?.subscription?.billingInterval === source.interval &&
        stableSourceProfile.body?.subscription?.status === "ACTIVE";
      let change;
      let profile = stableSourceProfile;
      let kind = "noop";
      let passed = false;

      if (source.plan === target.plan && source.interval === target.interval) {
        const route = shouldUseSwitchCycle(source, target)
          ? "/api/subscription/switch-cycle"
          : "/api/subscription/change-plan";
        const body = shouldUseSwitchCycle(source, target)
          ? { targetInterval: target.interval, acceptedSubscriptionTerms: true }
          : {
              targetPlan: target.plan,
              targetInterval: target.interval,
              acceptedSubscriptionTerms: true,
            };
        change = await reqRetry(client, `noop-${label}`, route, {
          method: "POST",
          body: JSON.stringify(body),
        });
        profile = await reqRetry(client, `final-noop-${label}`, "/api/profile", { method: "GET" });
        passed = sourceOk && stableSourceOk && change.status === 400;
      } else {
        const reduction = isReduction(source, target);
        kind = reduction ? "scheduled" : "immediate";
        const route = shouldUseSwitchCycle(source, target)
          ? "/api/subscription/switch-cycle"
          : "/api/subscription/change-plan";
        const body = shouldUseSwitchCycle(source, target)
          ? { targetInterval: target.interval, acceptedSubscriptionTerms: true }
          : {
              targetPlan: target.plan,
              targetInterval: target.interval,
              acceptedSubscriptionTerms: true,
            };
        change = await reqRetry(client, `change-${label}`, route, {
          method: "POST",
          body: JSON.stringify(body),
        });
        profile = await pollProfile(
          client,
          `target-${label}`,
          (body) => {
            const subscription = body.subscription || {};
            if (reduction) {
              return (
                subscription.plan === source.plan &&
                subscription.billingInterval === source.interval &&
                subscription.pendingPlan === target.plan &&
                subscription.pendingBillingInterval === target.interval &&
                Boolean(subscription.currentPeriodEndsAt)
              );
            }
            return (
              subscription.plan === target.plan &&
              subscription.billingInterval === target.interval &&
              subscription.status === "ACTIVE" &&
              Boolean(subscription.currentPeriodEndsAt)
            );
          },
          reduction ? 120000 : 90000,
        );
        const summary = summarizeSubscription(profile.body);
        passed =
          sourceOk &&
          stableSourceOk &&
          change.status === 200 &&
          changeAppliedKind(source, target, change) === kind &&
          (reduction
            ? summary.plan === source.plan &&
              summary.billingInterval === source.interval &&
              summary.pendingPlan === target.plan &&
              summary.pendingBillingInterval === target.interval &&
              Boolean(summary.currentPeriodEndsAt)
            : summary.plan === target.plan &&
              summary.billingInterval === target.interval &&
              summary.status === "ACTIVE" &&
              Boolean(summary.currentPeriodEndsAt));
      }

      const result = {
        label,
        source,
        target,
        kind,
        passed,
        changeStatus: change.status,
        changeApplied: changeAppliedKind(source, target, change),
        changeError: changeError(change),
        sourceProfile: summarizeSubscription(sourceProfile.body),
        stableSourceProfile: summarizeSubscription(stableSourceProfile.body),
        finalProfile: summarizeSubscription(profile.body),
      };
      results.push(result);
      log({ event: "transition_result", ...result });
      await delay(1500);
    }
    const sourceResults = results.filter((result) => result.label.startsWith(`${source.plan}_${source.interval}->`));
    log({
      event: "source_complete",
      source,
      total: sourceResults.length,
      passed: sourceResults.filter((result) => result.passed).length,
    });
  }

  for (const subscriptionId of createdSubscriptions) {
    await stripePost(auth, `/subscriptions/${subscriptionId}`, { cancel_at_period_end: "true" }).catch((error) => {
      log({ event: "cleanup_warning", subscriptionId, message: error.message });
    });
  }

  const summary = {
    base: BASE,
    sources,
    targets: TARGETS,
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed),
    results,
    createdSubscriptions: createdSubscriptions.length,
    logPath: LOG_PATH,
    summaryPath: SUMMARY_PATH,
    finishedAt: new Date().toISOString(),
  };
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));
  log({ event: "matrix_complete", total: summary.total, passed: summary.passed, failed: summary.failed.length, summaryPath: SUMMARY_PATH });
  if (summary.failed.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  log({ event: "matrix_error", message: error.message, stack: String(error.stack).split("\n").slice(0, 5) });
  process.exitCode = 1;
});
