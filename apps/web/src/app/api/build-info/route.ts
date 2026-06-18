import { readBuildInfo } from "@locateflow/shared";
import type { BuildInfoFallback } from "@locateflow/shared";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readGeneratedBuildInfo(): Promise<BuildInfoFallback> {
  const file = process.env.BUILD_INFO_FILE;
  if (!file) return {};
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as BuildInfoFallback;
    return {
      commitSha: typeof parsed.commitSha === "string" ? parsed.commitSha : undefined,
      sourceBranch: typeof parsed.sourceBranch === "string" ? parsed.sourceBranch : undefined,
      builtAt: typeof parsed.builtAt === "string" ? parsed.builtAt : undefined,
      environment: typeof parsed.environment === "string" ? parsed.environment : undefined,
    };
  } catch {
    return {};
  }
}

export async function GET() {
  return NextResponse.json(readBuildInfo("web", process.env, await readGeneratedBuildInfo()), {
    headers: { "Cache-Control": "no-store" },
  });
}
