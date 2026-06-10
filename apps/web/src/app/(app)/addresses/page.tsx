import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { resolveWorkspaceDataScope, scopedRecordWhere } from "@/lib/workspace-data-scope";
import { AddressesClient, type AddressItem } from "./addresses-client";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const userId = await requireDbUserId();
  const request = new Request("http://locateflow.local", { headers: await headers() });
  const scope = await resolveWorkspaceDataScope(request, userId);

  const rows = await prisma.address.findMany({
    where: scopedRecordWhere(scope, { deletedAt: null }, { childSelfOnly: true }),
    include: {
      services: {
        where: activeTrackedServiceWhereForScope(
          { userId, workspaceId: scope.workspaceId },
          scope.memberRole === "CHILD" ? { userId } : {},
        ),
        select: { id: true, monthlyCost: true, billingCycle: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const initial: AddressItem[] = rows.map((a: any) => ({
    id: a.id,
    type: a.type,
    nickname: a.nickname ?? undefined,
    street: a.street,
    city: a.city,
    state: a.state,
    zip: a.zip,
    isPrimary: a.isPrimary,
    ownership: a.ownership,
    startDate: (a.startDate instanceof Date ? a.startDate : new Date(a.startDate)).toISOString(),
    services: a.services?.map((s: any) => ({
      id: s.id,
      monthlyCost: s.monthlyCost ? Number(s.monthlyCost) : undefined,
      billingCycle: s.billingCycle ?? null,
    })),
  }));

  return <AddressesClient initial={initial} />;
}
