import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type ResearchStatus = "resolved" | "partial" | "blocked";
type ZipRemediationPath =
  | "seed_exact_or_prefix_after_lookup"
  | "requires_live_address_check"
  | "needs_polygon_or_corridor_model"
  | "state_only_ok"
  | "manual_research_required";

type ProviderEntry = {
  name: string;
  category: string;
  scope: string;
  states: string[];
  repoCoverage: {
    zipRules: number;
    modeledAsStateOnly: boolean;
  };
  officialResearch: {
    status: ResearchStatus;
    zipRemediationPath: ZipRemediationPath;
  };
};

const ALL_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
] as const;

function getCoveredStates(entry: ProviderEntry) {
  if (entry.scope === "FEDERAL") return [...ALL_STATES];
  return entry.states;
}

async function main() {
  const inputPath = resolve(process.cwd(), "docs/generated/provider-official-coverage-research.json");
  const payload = JSON.parse(await readFile(inputPath, "utf8")) as {
    summary: { generatedAt: string };
    providers: ProviderEntry[];
  };

  const rows = ALL_STATES.map((state) => ({
    state,
    totalProviders: 0,
    modeledAsStateOnly: 0,
    resolved: 0,
    partial: 0,
    blocked: 0,
    zipReady: 0,
    liveAddressCheck: 0,
    polygonOrCorridor: 0,
    manualResearch: 0,
    sampleProviders: [] as string[],
  }));

  const byState = new Map(rows.map((row) => [row.state, row]));

  for (const entry of payload.providers) {
    for (const state of getCoveredStates(entry)) {
      const row = byState.get(state);
      if (!row) continue;

      row.totalProviders += 1;
      if (entry.repoCoverage.modeledAsStateOnly) row.modeledAsStateOnly += 1;
      row[entry.officialResearch.status] += 1;

      switch (entry.officialResearch.zipRemediationPath) {
        case "seed_exact_or_prefix_after_lookup":
          row.zipReady += 1;
          break;
        case "requires_live_address_check":
          row.liveAddressCheck += 1;
          break;
        case "needs_polygon_or_corridor_model":
          row.polygonOrCorridor += 1;
          break;
        case "manual_research_required":
          row.manualResearch += 1;
          break;
        default:
          break;
      }

      if (row.sampleProviders.length < 6 && !row.sampleProviders.includes(entry.name)) {
        row.sampleProviders.push(entry.name);
      }
    }
  }

  rows.sort(
    (a, b) =>
      b.manualResearch - a.manualResearch ||
      b.modeledAsStateOnly - a.modeledAsStateOnly ||
      a.state.localeCompare(b.state)
  );

  const markdownLines: string[] = [];
  markdownLines.push("# Provider Coverage State Backlog");
  markdownLines.push("");
  markdownLines.push(`Generated: ${payload.summary.generatedAt}`);
  markdownLines.push("");
  markdownLines.push("## State Summary");
  markdownLines.push("");

  for (const row of rows) {
    markdownLines.push(
      `- ${row.state}: total=${row.totalProviders}, modeledAsStateOnly=${row.modeledAsStateOnly}, resolved=${row.resolved}, partial=${row.partial}, blocked=${row.blocked}, zipReady=${row.zipReady}, liveAddressCheck=${row.liveAddressCheck}, polygonOrCorridor=${row.polygonOrCorridor}, manualResearch=${row.manualResearch}`
    );
    markdownLines.push(`  sample: ${row.sampleProviders.join(", ")}`);
  }

  const outDir = resolve(process.cwd(), "docs/generated");
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(outDir, "provider-coverage-state-backlog.md"), `${markdownLines.join("\n")}\n`, "utf8"),
    writeFile(resolve(outDir, "provider-coverage-state-backlog.json"), `${JSON.stringify({
      generatedAt: payload.summary.generatedAt,
      states: rows,
    }, null, 2)}\n`, "utf8"),
  ]);

  console.log(markdownLines.join("\n"));
  console.log("\nWrote state backlog artifacts to docs/generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
