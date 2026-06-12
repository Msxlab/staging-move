import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildIngestRecords, parseCliArgs, parseCsvLine } from "./fcc-bulk-ingest";

const tempDirs: string[] = [];

async function fixtureDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "fcc-bulk-ingest-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("fcc-bulk-ingest", () => {
  it("parses quoted CSV cells", () => {
    expect(parseCsvLine('111,"Xfinity, Comcast","a ""quoted"" value"')).toEqual([
      "111",
      "Xfinity, Comcast",
      'a "quoted" value',
    ]);
  });

  it("rolls fixed FCC rows up to provider ZIP coverage records", async () => {
    const dir = await fixtureDir();
    const fccPath = path.join(dir, "fcc.csv");
    const crosswalkPath = path.join(dir, "crosswalk.csv");
    const mappingPath = path.join(dir, "mapping.csv");

    await writeFile(
      fccPath,
      [
        "provider_id,brand_name,block_geoid,technology_code,max_advertised_download_speed,max_advertised_upload_speed",
        "111,Comcast,480010001001000,40,1000,35",
        "222,Verizon,480010001002000,50,500,50",
        "333,Mobile Only,480010001003000,300,100,20",
        "444,Unknown Fiber,480010001004000,50,100,20",
      ].join("\n"),
    );
    await writeFile(
      crosswalkPath,
      [
        "block_geoid,zip",
        "480010001001000,78701",
        "480010001002000,78702",
        "480010001003000,78703",
        "480010001004000,78704",
      ].join("\n"),
    );
    await writeFile(mappingPath, ["provider_id,provider_slug", "111,xfinity"].join("\n"));

    const result = await buildIngestRecords({
      fccPaths: [fccPath],
      crosswalkPath,
      mappingPath,
      catalogProviders: [
        { slug: "xfinity", name: "Xfinity (Comcast)" },
        { slug: "verizon-fios", name: "Verizon Fios" },
      ],
    });

    expect(result.records).toEqual([
      { providerSlug: "verizon-fios", scope: "STATE", zipCodes: ["78702"] },
      { providerSlug: "xfinity", scope: "STATE", zipCodes: ["78701"] },
    ]);
    expect(result.stats.rowsRead).toBe(4);
    expect(result.stats.rowsAccepted).toBe(2);
    expect(result.stats.skippedNonFixedTechnology).toBe(1);
    expect(result.stats.skippedNoProviderMapping).toBe(1);
  });

  it("supports direct ZIP rows and JSON brand mappings", async () => {
    const dir = await fixtureDir();
    const fccPath = path.join(dir, "fcc.csv");
    const mappingPath = path.join(dir, "mapping.json");

    await writeFile(
      fccPath,
      [
        "brand_name,zip,technology_code,max_advertised_download_speed,max_advertised_upload_speed",
        "AT&T,02110,50,1000,100",
        "AT&T,02110,50,1000,100",
      ].join("\n"),
    );
    await writeFile(mappingPath, JSON.stringify({ "brand:AT&T": "att-fiber" }));

    const result = await buildIngestRecords({
      fccPaths: [fccPath],
      mappingPath,
      catalogProviders: [{ slug: "att-fiber", name: "AT&T Fiber" }],
    });

    expect(result.records).toEqual([{ providerSlug: "att-fiber", scope: "STATE", zipCodes: ["02110"] }]);
    expect(result.stats.rowsRead).toBe(2);
    expect(result.stats.rowsAccepted).toBe(2);
  });

  it("parses CLI arguments", () => {
    expect(
      parseCliArgs([
        "--fcc",
        "data/fcc",
        "--crosswalk=geo.csv",
        "--mapping",
        "map.json",
        "--state",
        "tx",
        "--min-download-mbps",
        "100",
        "--apply",
      ]),
    ).toMatchObject({
      fccPaths: ["data/fcc"],
      crosswalkPath: "geo.csv",
      mappingPath: "map.json",
      state: "TX",
      minDownloadMbps: 100,
      apply: true,
    });
  });
});
