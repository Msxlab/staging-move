import { expandCoverageRows } from "@locateflow/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

export interface RebuildCoverageInput {
  providerId: string;
  scope: string;
  states?: string[] | string | null;
  zipCodes?: string[] | string | null;
}

export async function rebuildProviderCoverage(
  tx: TxClient,
  input: RebuildCoverageInput
): Promise<number> {
  const rows = expandCoverageRows({
    scope: input.scope,
    states: input.states,
    zipCodes: input.zipCodes,
  });

  await tx.serviceProviderCoverage.deleteMany({
    where: { providerId: input.providerId },
  });

  if (rows.length === 0) return 0;

  await tx.serviceProviderCoverage.createMany({
    data: rows.map((r) => ({
      providerId: input.providerId,
      state: r.state,
      zipPrefix: r.zipPrefix,
      zipExact: r.zipExact,
    })),
  });

  return rows.length;
}
