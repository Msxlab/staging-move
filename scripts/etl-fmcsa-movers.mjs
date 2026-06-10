#!/usr/bin/env node
/**
 * scripts/etl-fmcsa-movers.mjs — FMCSA household-goods mover ETL
 * ============================================================================
 *
 * Purpose
 * -------
 * Populate/refresh the read-only `MovingCompany` catalog (interstate
 * household-goods carriers) from PUBLIC FMCSA data. Idempotent: rows are
 * upserted on `usdotNumber`; carriers that drop out of the snapshot are
 * flipped `active=false` (never deleted) so existing links never 404.
 *
 * Data sources (researched June 2026 — the practical FREE path)
 * -------------------------------------------------------------
 *  1. FMCSA Motor Carrier Census file (PRIMARY, bulk, free, no key):
 *     - data.transportation.gov → "Motor Carrier Registrations - Census Files"
 *       (dataset 4a2k-zf79) → points at the SMS downloads page:
 *       https://ai.fmcsa.dot.gov/SMS/Tools/Downloads.aspx
 *     - The download is form-gated in a browser, so this script reads a LOCAL
 *       CSV you downloaded (`--file`), or a direct URL if you have one
 *       (`--url`). Census columns used here: DOT_NUMBER, LEGAL_NAME, DBA_NAME,
 *       PHY_STATE, PHY_CITY, TELEPHONE, NBR_POWER_UNIT (fleet size),
 *       HHG_IND (household-goods indicator — present in some extracts only),
 *       SAFETY_RATING (some extracts only).
 *
 *  2. FMCSA QCMobile API (OPTIONAL enrichment, free webKey via login.gov:
 *     https://mobile.fmcsa.dot.gov/QCDevsite/docs/getStarted):
 *     - `GET /qc/services/carriers/{dot}/authority?webKey=…` → authoritative
 *       per-carrier household-goods authority flag (used when the census
 *       extract has no HHG column).
 *     - `GET /qc/services/carriers/{dot}?webKey=…` → safetyRating and
 *       totalPowerUnits when the census extract lacks them.
 *     QCMobile is lookup-only (no bulk/state listing), so it is used to
 *     enrich census candidates, never as the primary list.
 *
 * What is NOT obtainable (documented limitation)
 * ----------------------------------------------
 *  - BULK complaint counts: the National Consumer Complaint Database (NCCDB)
 *    is NOT public — per DOT's PIA, "the general public does not have access
 *    to the complaint database". Per-company complaint history is only
 *    viewable interactively on the protectyourmove.gov mover search
 *    (https://ai.fmcsa.dot.gov/hhg/search.asp). `complaintCount2y` therefore
 *    stays 0 unless/until FMCSA exposes a bulk feed; the product UI links
 *    each row to protectyourmove.gov so users see the official record.
 *  - A per-company deep link into the protectyourmove search (the form has no
 *    documented GET parameters) — the UI links the search page + USDOT #.
 *
 * Usage
 * -----
 *   node scripts/etl-fmcsa-movers.mjs --file ./census.csv --state TX
 *   node scripts/etl-fmcsa-movers.mjs --file ./census.csv --state TX --webkey KEY
 *   node scripts/etl-fmcsa-movers.mjs --file ./census.csv --dry-run
 *
 * Flags
 *   --file <path>           Local census CSV (required unless --url).
 *   --url <https url>       Direct CSV URL to download instead of --file.
 *   --state <XX>            Only import carriers physically in this state.
 *   --webkey <key>          QCMobile webKey for HHG/safety enrichment.
 *   --enrich-limit <n>      Max QCMobile lookups per run (default 500).
 *   --as-of <YYYY-MM-DD>    Snapshot date stamped into dataAsOf (default today).
 *   --deactivate-missing    Flip active=false for DB rows (in --state scope)
 *                           absent from this snapshot.
 *   --dry-run               Parse + report, write nothing.
 *
 * House rules: idempotent, additive, graceful — a bad row is skipped and
 * counted, never fatal; QCMobile failures degrade to "skip enrichment".
 * ============================================================================
 */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    file: null,
    url: null,
    state: null,
    webkey: null,
    enrichLimit: 500,
    asOf: null,
    deactivateMissing: false,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") args.file = argv[++i] ?? null;
    else if (a === "--url") args.url = argv[++i] ?? null;
    else if (a === "--state") args.state = (argv[++i] ?? "").trim().toUpperCase() || null;
    else if (a === "--webkey") args.webkey = argv[++i] ?? null;
    else if (a === "--enrich-limit") args.enrichLimit = Math.max(0, Number(argv[++i]) || 0);
    else if (a === "--as-of") args.asOf = argv[++i] ?? null;
    else if (a === "--deactivate-missing") args.deactivateMissing = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--help" || a === "-h") {
      console.log("See the header comment of scripts/etl-fmcsa-movers.mjs for usage.");
      process.exit(0);
    }
  }
  return args;
}

// ── Minimal streaming CSV (quoted fields, embedded commas/quotes) ────────────
// No csv dependency exists at the repo root; the census file is large, so we
// stream line-by-line. Census exports do not contain embedded newlines inside
// quoted fields, which keeps a per-line parser correct for this source.

function parseCsvLine(line) {
  const out = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

/** Header lookup tolerant to the column-name variants seen across census extracts. */
function buildColumnIndex(headerCells) {
  const norm = headerCells.map((h) => h.trim().toUpperCase().replace(/\s+/g, "_"));
  const find = (...candidates) => {
    for (const c of candidates) {
      const idx = norm.indexOf(c);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  return {
    dot: find("DOT_NUMBER", "USDOT_NUMBER", "USDOT", "DOT"),
    legalName: find("LEGAL_NAME", "NAME"),
    dbaName: find("DBA_NAME", "DBA"),
    state: find("PHY_STATE", "PHY_ST", "STATE"),
    city: find("PHY_CITY", "CITY"),
    phone: find("TELEPHONE", "PHONE", "TEL_NUM"),
    powerUnits: find("NBR_POWER_UNIT", "TOT_PWR", "POWER_UNITS", "TOTAL_POWER_UNITS"),
    hhg: find("HHG_IND", "HHG", "HOUSEHOLD_GOODS", "HHG_FLAG", "HHG_AUTHORIZATION"),
    safetyRating: find("SAFETY_RATING", "RATING"),
  };
}

const TRUTHY = new Set(["Y", "YES", "1", "TRUE", "A", "ACTIVE"]);

function normalizeSafetyRating(raw) {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return null;
  if (v === "S" || v === "SATISFACTORY") return "Satisfactory";
  if (v === "C" || v === "CONDITIONAL") return "Conditional";
  if (v === "U" || v === "UNSATISFACTORY") return "Unsatisfactory";
  return null; // unknown codes are dropped, never stored raw
}

// ── QCMobile enrichment (optional; throttled; failures degrade gracefully) ───

const QC_BASE = "https://mobile.fmcsa.dot.gov/qc/services";
const QC_THROTTLE_MS = 150;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function qcGet(path, webkey) {
  const res = await fetch(`${QC_BASE}${path}?webKey=${encodeURIComponent(webkey)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`QCMobile ${path} -> HTTP ${res.status}`);
  return res.json();
}

/** True/false when QCMobile answers, null when it can't tell us (degrade). */
async function lookupHhgAuthority(dot, webkey) {
  try {
    const body = await qcGet(`/carriers/${dot}/authority`, webkey);
    const records = Array.isArray(body?.content) ? body.content : [];
    for (const rec of records) {
      const auth = rec?.carrierAuthority ?? rec;
      const flag = (auth?.householdGoods ?? auth?.hhg ?? "").toString().trim().toUpperCase();
      if (flag === "Y" || flag === "YES" || flag === "TRUE") return true;
    }
    return records.length > 0 ? false : null;
  } catch {
    return null;
  }
}

/** { safetyRating, fleetSize } best-effort; nulls when unavailable. */
async function lookupCarrierSnapshot(dot, webkey) {
  try {
    const body = await qcGet(`/carriers/${dot}`, webkey);
    const carrier = body?.content?.carrier ?? body?.content ?? null;
    if (!carrier || typeof carrier !== "object") return { safetyRating: null, fleetSize: null };
    const fleet = Number(carrier.totalPowerUnits);
    return {
      safetyRating: normalizeSafetyRating(carrier.safetyRating),
      fleetSize: Number.isFinite(fleet) && fleet > 0 ? Math.floor(fleet) : null,
    };
  } catch {
    return { safetyRating: null, fleetSize: null };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function openCsvLineReader(args) {
  if (args.file) {
    await stat(args.file); // fail fast with a clear ENOENT
    return createInterface({ input: createReadStream(args.file, "utf8"), crlfDelay: Infinity });
  }
  // --url: stream the response body through readline.
  const res = await fetch(args.url);
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status} for ${args.url}`);
  const { Readable } = await import("node:stream");
  return createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity });
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.file && !args.url) {
    console.error(
      "Provide the census CSV via --file <path> (download from https://ai.fmcsa.dot.gov/SMS/Tools/Downloads.aspx) or --url <direct csv url>.",
    );
    process.exit(1);
  }
  if (args.state && !/^[A-Z]{2}$/.test(args.state)) {
    console.error(`--state must be a 2-letter code, got "${args.state}"`);
    process.exit(1);
  }
  const dataAsOf = args.asOf ? new Date(`${args.asOf}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(dataAsOf.getTime())) {
    console.error(`--as-of must be YYYY-MM-DD, got "${args.asOf}"`);
    process.exit(1);
  }

  const summary = {
    parsed: 0,
    skippedBadRow: 0,
    skippedState: 0,
    skippedNonHhg: 0,
    skippedHhgUnknown: 0,
    enriched: 0,
    upserted: 0,
    deactivated: 0,
    errors: 0,
  };

  // Phase 1 — stream-parse the census file into candidate rows.
  const rl = await openCsvLineReader(args);
  let cols = null;
  /** @type {Map<number, object>} keyed by usdotNumber (last row wins) */
  const candidates = new Map();

  for await (const rawLine of rl) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim()) continue;
    if (!cols) {
      cols = buildColumnIndex(parseCsvLine(line));
      if (cols.dot === -1 || cols.legalName === -1 || cols.state === -1) {
        throw new Error(
          "Census header missing required columns (need DOT_NUMBER, LEGAL_NAME, PHY_STATE). " +
            "Is this the Motor Carrier Census CSV?",
        );
      }
      continue;
    }
    summary.parsed++;
    const cells = parseCsvLine(line);
    const usdot = Number((cells[cols.dot] ?? "").trim());
    const legalName = (cells[cols.legalName] ?? "").trim();
    const state = (cells[cols.state] ?? "").trim().toUpperCase();
    if (!Number.isInteger(usdot) || usdot <= 0 || !legalName || !/^[A-Z]{2}$/.test(state)) {
      summary.skippedBadRow++;
      continue;
    }
    if (args.state && state !== args.state) {
      summary.skippedState++;
      continue;
    }
    const powerUnits = cols.powerUnits === -1 ? NaN : Number((cells[cols.powerUnits] ?? "").trim());
    candidates.set(usdot, {
      usdotNumber: usdot,
      legalName: legalName.slice(0, 255),
      dbaName: cols.dbaName === -1 ? null : (cells[cols.dbaName] ?? "").trim().slice(0, 255) || null,
      state,
      city: cols.city === -1 ? null : (cells[cols.city] ?? "").trim().slice(0, 100) || null,
      phone: cols.phone === -1 ? null : (cells[cols.phone] ?? "").trim().slice(0, 30) || null,
      fleetSize: Number.isFinite(powerUnits) && powerUnits > 0 ? Math.floor(powerUnits) : null,
      // tri-state: true / false (census said no) / null (census doesn't say)
      hhgAuthorization:
        cols.hhg === -1
          ? null
          : TRUTHY.has((cells[cols.hhg] ?? "").trim().toUpperCase())
            ? true
            : false,
      safetyRating: cols.safetyRating === -1 ? null : normalizeSafetyRating(cells[cols.safetyRating]),
    });
  }
  console.log(
    `Parsed ${summary.parsed} census rows -> ${candidates.size} candidate carriers` +
      (args.state ? ` in ${args.state}` : "") +
      ".",
  );

  // Phase 2 — household-goods authority. Census HHG column when present;
  // otherwise QCMobile authority lookups (throttled, capped) when --webkey.
  const importable = [];
  let enrichBudget = args.webkey ? args.enrichLimit : 0;
  for (const row of candidates.values()) {
    if (row.hhgAuthorization === null && enrichBudget > 0) {
      enrichBudget--;
      summary.enriched++;
      row.hhgAuthorization = await lookupHhgAuthority(row.usdotNumber, args.webkey);
      if ((row.safetyRating === null || row.fleetSize === null) && row.hhgAuthorization === true) {
        const snap = await lookupCarrierSnapshot(row.usdotNumber, args.webkey);
        row.safetyRating = row.safetyRating ?? snap.safetyRating;
        row.fleetSize = row.fleetSize ?? snap.fleetSize;
      }
      await sleep(QC_THROTTLE_MS);
    }
    if (row.hhgAuthorization === true) importable.push(row);
    else if (row.hhgAuthorization === false) summary.skippedNonHhg++;
    else summary.skippedHhgUnknown++;
  }
  if (summary.skippedHhgUnknown > 0 && !args.webkey) {
    console.log(
      `NOTE: ${summary.skippedHhgUnknown} carriers had no HHG indicator in this census extract and were ` +
        "skipped. Re-run with --webkey <QCMobile key> to resolve household-goods authority per carrier.",
    );
  }
  console.log(`${importable.length} household-goods carriers ready to upsert.`);

  if (args.dryRun) {
    console.log("--dry-run: no database writes.");
    console.log("Summary:", JSON.stringify(summary, null, 2));
    return;
  }

  // Phase 3 — idempotent upserts + optional deactivation of dropped carriers.
  const prisma = new PrismaClient();
  try {
    for (const row of importable) {
      try {
        await prisma.movingCompany.upsert({
          where: { usdotNumber: row.usdotNumber },
          create: {
            usdotNumber: row.usdotNumber,
            legalName: row.legalName,
            dbaName: row.dbaName,
            state: row.state,
            city: row.city,
            phone: row.phone,
            hhgAuthorization: true,
            fleetSize: row.fleetSize,
            // complaintCount2y stays at its default 0 — no public bulk source
            // (see header: NCCDB is not public).
            safetyRating: row.safetyRating,
            dataAsOf,
            active: true,
          },
          update: {
            legalName: row.legalName,
            dbaName: row.dbaName,
            state: row.state,
            city: row.city,
            phone: row.phone,
            hhgAuthorization: true,
            fleetSize: row.fleetSize,
            safetyRating: row.safetyRating,
            dataAsOf,
            active: true,
          },
        });
        summary.upserted++;
      } catch (error) {
        summary.errors++;
        console.error(`Upsert failed for USDOT ${row.usdotNumber}:`, error?.message ?? error);
      }
    }

    if (args.deactivateMissing) {
      // Only within the snapshot's scope — a TX-only run must never deactivate
      // CA rows the file never covered.
      const seen = importable.map((r) => r.usdotNumber);
      const where = {
        active: true,
        usdotNumber: { notIn: seen.length > 0 ? seen : [0] },
        ...(args.state ? { state: args.state } : {}),
      };
      const res = await prisma.movingCompany.updateMany({ where, data: { active: false } });
      summary.deactivated = res.count;
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("Summary:", JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("etl-fmcsa-movers failed:", error);
  process.exit(1);
});
