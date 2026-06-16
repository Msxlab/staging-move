#!/usr/bin/env node
/**
 * Presence-only Dokploy env checker.
 *
 * This script intentionally never prints environment variable values. It reads
 * key names from an env file or from process.env and reports only presence,
 * missing required keys, duplicates, and unknown key names.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envCatalogPath = resolve(root, "packages/shared/src/env-catalog.ts");
const dokployComposePath = resolve(root, "docker-compose.dokploy.yml");

const COMPOSE_REQUIRED_KEYS = [
  "MYSQL_ROOT_PASSWORD",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "ADMIN_SEED_EMAIL",
  "ADMIN_SEED_PASSWORD",
];

function usage(exitCode = 0) {
  const out = exitCode === 0 ? console.log : console.error;
  out(`Usage:
  node scripts/dokploy-env-audit.mjs --env-file <path>
  node scripts/dokploy-env-audit.mjs --from-process

The report is presence-only and never prints values.`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { envFile: null, fromProcess: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--env-file") {
      args.envFile = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === "--from-process") {
      args.fromProcess = true;
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    usage(2);
  }
  if (Boolean(args.envFile) === args.fromProcess) usage(2);
  return args;
}

function parseEnvCatalog() {
  const source = readFileSync(envCatalogPath, "utf8");
  const start = source.indexOf("export const EXPECTED_ENV_KEYS");
  if (start === -1) throw new Error("Could not find EXPECTED_ENV_KEYS in env catalog.");
  const block = source.slice(start);
  const entryRe = /\{\s*key:\s*"([A-Z0-9_]+)"([\s\S]*?)\n\s*\},/g;
  const required = new Set(COMPOSE_REQUIRED_KEYS);
  const requiredGroups = COMPOSE_REQUIRED_KEYS.map((key) => [key]);
  const optional = new Set();
  const platform = new Set();

  for (const match of block.matchAll(entryRe)) {
    const key = match[1];
    const body = match[2];
    const classification = body.match(/classification:\s*"([a-z]+)"/)?.[1];
    const aliases = body.match(/aliases:\s*\[([^\]]+)\]/)?.[1] || "";
    const aliasKeys = [];
    for (const aliasMatch of aliases.matchAll(/"([A-Z0-9_]+)"/g)) {
      aliasKeys.push(aliasMatch[1]);
    }

    if (classification === "required") {
      required.add(key);
      for (const alias of aliasKeys) optional.add(alias);
      requiredGroups.push([key, ...aliasKeys]);
    } else if (classification === "platform") {
      platform.add(key);
    } else {
      optional.add(key);
      for (const alias of aliasKeys) optional.add(alias);
    }
  }

  return { required, requiredGroups, optional, platform };
}

function parseComposeVariableNames() {
  const source = readFileSync(dokployComposePath, "utf8");
  const referenced = new Set();
  const required = new Set();
  for (const match of source.matchAll(/\$\{([A-Z0-9_]+)(?::([-?])[^}]*)?\}/g)) {
    referenced.add(match[1]);
    if (match[2] === "?") required.add(match[1]);
  }
  return { referenced, required };
}

function parseEnvFile(path) {
  const source = readFileSync(path, "utf8");
  const present = new Set();
  const duplicates = new Set();
  const seen = new Set();

  source.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) {
      console.error(`WARN malformed env line ${index + 1}: key is not parseable`);
      return;
    }
    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) {
      console.error(`WARN malformed env line ${index + 1}: key name is not uppercase env format`);
      return;
    }
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
    const rawValue = withoutExport.slice(eq + 1);
    if (rawValue.trim() !== "") present.add(key);
  });

  return { present, duplicates };
}

function parseProcessEnv() {
  const present = new Set();
  for (const [key, value] of Object.entries(process.env)) {
    if (/^[A-Z0-9_]+$/.test(key) && typeof value === "string" && value.trim() !== "") {
      present.add(key);
    }
  }
  return { present, duplicates: new Set() };
}

function printList(title, values) {
  console.log(`\n${title} (${values.length})`);
  if (values.length === 0) {
    console.log("  none");
    return;
  }
  for (const value of values) console.log(`  ${value}`);
}

function requiredGroupSatisfied(group, present) {
  if (group[0] === "DATABASE_URL") {
    const mysqlVarsPresent = ["MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"].every((key) => present.has(key));
    return present.has("DATABASE_URL") || mysqlVarsPresent;
  }
  return group.some((key) => present.has(key));
}

function requiredGroupLabel(group) {
  if (group[0] === "DATABASE_URL") {
    return "DATABASE_URL (or MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD for Dokploy MySQL)";
  }
  return group.length === 1 ? group[0] : `${group[0]} (or ${group.slice(1).join(", ")})`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalog = parseEnvCatalog();
  const composeKeys = parseComposeVariableNames();
  const expected = new Set([
    ...catalog.required,
    ...catalog.optional,
    ...catalog.platform,
    ...composeKeys.referenced,
  ]);
  const { present, duplicates } = args.fromProcess
    ? parseProcessEnv()
    : parseEnvFile(resolve(process.cwd(), args.envFile));

  const missingRequired = catalog.requiredGroups
    .filter((group) => !requiredGroupSatisfied(group, present))
    .map(requiredGroupLabel)
    .sort();
  const missingCompose = [...composeKeys.required].filter((key) => !present.has(key)).sort();
  const presentRequired = catalog.requiredGroups.filter((group) => requiredGroupSatisfied(group, present));
  const presentOptional = [...catalog.optional].filter((key) => present.has(key)).sort();
  const unknown = [...present].filter((key) => !expected.has(key)).sort();

  console.log("Dokploy env audit: presence-only report");
  console.log(`Source: ${args.fromProcess ? "process.env" : args.envFile}`);
  console.log(`Required groups present: ${presentRequired.length}/${catalog.requiredGroups.length}`);
  console.log(`Optional present: ${presentOptional.length}/${catalog.optional.size}`);
  console.log(`Required compose vars present: ${[...composeKeys.required].filter((key) => present.has(key)).length}/${composeKeys.required.size}`);
  console.log("Values printed: 0");

  printList("Missing required env keys", missingRequired);
  printList("Missing required compose interpolation keys", missingCompose);
  printList("Duplicate keys", [...duplicates].sort());
  printList("Unknown present keys", unknown);

  if (missingRequired.length > 0 || missingCompose.length > 0 || duplicates.size > 0) {
    process.exitCode = 1;
  }
}

main();
