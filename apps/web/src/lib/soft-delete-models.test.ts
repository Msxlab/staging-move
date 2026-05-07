import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { SOFT_DELETE_MODELS } from "@locateflow/db";

const SCHEMA_PATH = path.resolve(
  __dirname,
  "../../../../packages/db/prisma/schema.prisma",
);

function parseModelsWithDeletedAt(schema: string): Set<string> {
  const models = new Set<string>();
  const modelRegex = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(schema)) !== null) {
    const [, name, body] = match;
    if (/^\s*deletedAt\s+DateTime\?/m.test(body)) {
      models.add(name);
    }
  }
  return models;
}

function parseAllModels(schema: string): Set<string> {
  const models = new Set<string>();
  const modelRegex = /^model\s+(\w+)\s*\{/gm;
  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(schema)) !== null) {
    models.add(match[1]);
  }
  return models;
}

describe("SOFT_DELETE_MODELS schema parity", () => {
  const schema = readFileSync(SCHEMA_PATH, "utf-8");
  const modelsWithDeletedAt = parseModelsWithDeletedAt(schema);
  const allModels = parseAllModels(schema);

  it("includes every model that has a deletedAt column", () => {
    const missing: string[] = [];
    for (const model of modelsWithDeletedAt) {
      if (!SOFT_DELETE_MODELS.has(model)) missing.push(model);
    }
    expect(missing).toEqual([]);
  });

  it("does not reference any model that is not in the Prisma schema", () => {
    const stale: string[] = [];
    for (const model of SOFT_DELETE_MODELS) {
      if (!allModels.has(model)) stale.push(model);
    }
    expect(stale).toEqual([]);
  });

  it("only contains models that have a deletedAt column", () => {
    const noDeletedAt: string[] = [];
    for (const model of SOFT_DELETE_MODELS) {
      if (!modelsWithDeletedAt.has(model)) noDeletedAt.push(model);
    }
    expect(noDeletedAt).toEqual([]);
  });
});
