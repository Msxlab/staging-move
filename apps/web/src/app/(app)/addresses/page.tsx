import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { activeTrackedServiceWhere } from "@/lib/service-active";
import { AddressesClient, type AddressItem } from "./addresses-client";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const userId = await requireDbUserId();

  const rows = await prisma.address.findMany({
    where: { userId, deletedAt: null },
    include: {
      services: {
        where: activeTrackedServiceWhere(userId),
        select: { id: true, monthlyCost: true },
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
    })),
  }));

  return <AddressesClient initial={initial} />;
}
