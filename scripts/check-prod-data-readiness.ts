import {
  getRuntimeConfigDefinition,
  maskRuntimeConfigValue,
  normalizeRuntimeConfigValue,
  validateRuntimeConfigValueShape,
} from "../packages/shared/src/runtime-config";

type Level = "ok" | "warn" | "fail" | "info";

type CheckResult = {
  id: string;
  level: Level;
  title: string;
  message: string;
  keys: string[];
};

type Args = {
  json: boolean;
  strict: boolean;
  production: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): Args {
  return {
    json: argv.includes("--json"),
    strict: argv.includes("--strict"),
    production: argv.includes("--production"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function value(key: string): string | null {
  return normalizeRuntimeConfigValue(process.env[key]);
}

function isTrue(key: string): boolean {
  return value(key)?.toLowerCase() === "true";
}

function presentHint(key: string): string {
  const raw = value(key);
  if (!raw) return "missing";
  const definition = getRuntimeConfigDefinition(key);
  return maskRuntimeConfigValue(raw, definition?.maskStrategy || "secret");
}

function validationMessage(key: string): string | null {
  const raw = value(key);
  if (!raw) return null;
  const validation = validateRuntimeConfigValueShape(key, raw, { productionLike: true });
  return validation.ok ? null : `${key} looks invalid: ${validation.reason}`;
}

function checkCloudflare(productionLike: boolean): CheckResult {
  const mode = value("TRUSTED_PROXY_HEADERS")?.toLowerCase() || "";
  if (mode === "cloudflare") {
    return {
      id: "cloudflare-trusted-proxy",
      level: "ok",
      title: "Cloudflare trusted proxy headers",
      message: "TRUSTED_PROXY_HEADERS=cloudflare; client IP and rate-limit keys should use Cloudflare headers.",
      keys: ["TRUSTED_PROXY_HEADERS"],
    };
  }

  return {
    id: "cloudflare-trusted-proxy",
    level: productionLike ? "warn" : "info",
    title: "Cloudflare trusted proxy headers",
    message: `Set TRUSTED_PROXY_HEADERS=cloudflare in production behind Cloudflare. Current: ${mode || "unset"}.`,
    keys: ["TRUSTED_PROXY_HEADERS"],
  };
}

function checkEnabledPair(input: {
  id: string;
  title: string;
  flag: string;
  requiredKeys: string[];
  optionalKeys?: string[];
  enabledMessage: string;
  disabledMessage: string;
}): CheckResult {
  const enabled = isTrue(input.flag);
  const missingRequired = input.requiredKeys.filter((key) => !value(key));
  const invalid = [...input.requiredKeys, ...(input.optionalKeys || [])]
    .map(validationMessage)
    .filter(Boolean) as string[];

  if (enabled && missingRequired.length > 0) {
    return {
      id: input.id,
      level: "fail",
      title: input.title,
      message: `Enabled but missing ${missingRequired.join(", ")}. ${input.disabledMessage}`,
      keys: [input.flag, ...input.requiredKeys, ...(input.optionalKeys || [])],
    };
  }

  if (invalid.length > 0) {
    return {
      id: input.id,
      level: "warn",
      title: input.title,
      message: invalid.join("; "),
      keys: [input.flag, ...input.requiredKeys, ...(input.optionalKeys || [])],
    };
  }

  if (enabled) {
    return {
      id: input.id,
      level: "ok",
      title: input.title,
      message: `${input.enabledMessage} Keys: ${input.requiredKeys.map((key) => `${key}=${presentHint(key)}`).join(", ")}.`,
      keys: [input.flag, ...input.requiredKeys, ...(input.optionalKeys || [])],
    };
  }

  const keyPresent = input.requiredKeys.some((key) => Boolean(value(key)));
  return {
    id: input.id,
    level: keyPresent ? "warn" : "info",
    title: input.title,
    message: keyPresent
      ? `${input.flag} is not true, so present keys are ignored.`
      : input.disabledMessage,
    keys: [input.flag, ...input.requiredKeys, ...(input.optionalKeys || [])],
  };
}

function checkOptionalKey(input: {
  id: string;
  title: string;
  key: string;
  presentMessage: string;
  missingMessage: string;
  missingLevel?: Level;
}): CheckResult {
  const invalid = validationMessage(input.key);
  if (invalid) {
    return {
      id: input.id,
      level: "warn",
      title: input.title,
      message: invalid,
      keys: [input.key],
    };
  }

  if (value(input.key)) {
    return {
      id: input.id,
      level: "ok",
      title: input.title,
      message: `${input.presentMessage} ${input.key}=${presentHint(input.key)}.`,
      keys: [input.key],
    };
  }

  return {
    id: input.id,
    level: input.missingLevel || "info",
    title: input.title,
    message: input.missingMessage,
    keys: [input.key],
  };
}

function buildChecks(productionLike: boolean): CheckResult[] {
  return [
    checkCloudflare(productionLike),
    checkEnabledPair({
      id: "fcc-bdc",
      title: "FCC BDC ISP serviceability",
      flag: "FCC_BDC_ENABLED",
      requiredKeys: ["FCC_BDC_API_KEY"],
      optionalKeys: ["FCC_BDC_USERNAME", "FCC_BDC_API_BASE"],
      enabledMessage: "ISP address verification can enrich provider recommendations.",
      disabledMessage: "Internet recommendations will fall back to catalog and address-check-required confidence.",
    }),
    checkEnabledPair({
      id: "openei-electric",
      title: "OpenEI electric utility lookup",
      flag: "ELECTRIC_LOOKUP_ENABLED",
      requiredKeys: ["OPENEI_API_KEY"],
      enabledMessage: "Electric utility address verification can enrich provider recommendations.",
      disabledMessage: "Electric recommendations will fall back to catalog and address-check-required confidence.",
    }),
    checkOptionalKey({
      id: "airnow",
      title: "AirNow air quality",
      key: "AIRNOW_API_KEY",
      presentMessage: "Dossier air-quality lookups can call AirNow.",
      missingMessage: "Dossier air-quality section will return a graceful not-configured status.",
      missingLevel: "warn",
    }),
    checkOptionalKey({
      id: "census-acs",
      title: "Census ACS",
      key: "CENSUS_API_KEY",
      presentMessage: "Dossier economy lookups can use authenticated Census ACS calls.",
      missingMessage: "Dossier economy lookups may be rate-limited or unavailable depending on Census behavior.",
      missingLevel: "warn",
    }),
    checkOptionalKey({
      id: "fmcsa",
      title: "FMCSA mover verification",
      key: "FMCSA_WEBKEY",
      presentMessage: "Admin mover verification can call FMCSA QCMobile.",
      missingMessage: "Admin mover verification still works manually, but live USDOT cross-checks are disabled.",
    }),
  ];
}

function printHelp() {
  console.log(`Usage: pnpm check:prod-data-readiness [--production] [--json] [--strict]

Checks deployment env variables used by provider serviceability and dossier data.
Secrets are masked. Default mode reports findings but exits 0; --strict exits 1
when a feature is enabled without the keys it needs.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const productionLike = args.production || process.env.NODE_ENV === "production";
  const checks = buildChecks(productionLike);
  const totals = checks.reduce<Record<Level, number>>(
    (acc, check) => {
      acc[check.level] += 1;
      return acc;
    },
    { ok: 0, warn: 0, fail: 0, info: 0 },
  );

  if (args.json) {
    console.log(JSON.stringify({ productionLike, totals, checks }, null, 2));
  } else {
    console.log(`Production data readiness (${productionLike ? "production-like" : "local"})`);
    console.log(`ok=${totals.ok} warn=${totals.warn} fail=${totals.fail} info=${totals.info}`);
    for (const check of checks) {
      console.log(`[${check.level}] ${check.title}: ${check.message}`);
    }
  }

  if (args.strict && totals.fail > 0) {
    process.exitCode = 1;
  }
}

void main();
