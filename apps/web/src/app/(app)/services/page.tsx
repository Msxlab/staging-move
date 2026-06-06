import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { resolveWorkspaceDataScope, scopedRecordWhere } from "@/lib/workspace-data-scope";
import { ServicesClient, type ServicesItem, type ServicesAddress } from "./services-client";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const userId = await requireDbUserId();
  const request = new Request("http://locateflow.local", { headers: await headers() });
  const scope = await resolveWorkspaceDataScope(request, userId);

  const [serviceRows, addressRows] = await Promise.all([
    prisma.service.findMany({
      where: activeTrackedServiceWhereForScope(
        { userId, workspaceId: scope.workspaceId },
        scope.memberRole === "CHILD" ? { userId } : {},
      ),
      include: {
        address: { select: { nickname: true, city: true, state: true } },
        provider: { select: { id: true, name: true, logoUrl: true, affiliateActive: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.address.findMany({
      where: scopedRecordWhere(scope, { deletedAt: null }, { childSelfOnly: true }),
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const initialServices: ServicesItem[] = serviceRows.map((s: any) => ({
    id: s.id,
    category: s.category,
    providerName: s.providerName,
    website: s.website ?? null,
    phone: null,
    monthlyCost: s.monthlyCost ? Number(s.monthlyCost) : 0,
    billingDay: s.billingDay ?? null,
    isActive: s.isActive,
    addressId: s.addressId,
    provider: s.provider ? {
      id: s.provider.id,
      name: s.provider.name,
      logoUrl: s.provider.logoUrl,
      affiliateActive: s.provider.affiliateActive === true,
    } : null,
    providerLogoUrl: s.provider?.logoUrl ?? null,
    logoUrl: s.provider?.logoUrl ?? null,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    address: s.address ? {
      nickname: s.address.nickname ?? undefined,
      city: s.address.city,
      state: s.address.state,
    } : undefined,
  }));

  const initialAddresses: ServicesAddress[] = addressRows.map((a: any) => ({
    id: a.id,
    nickname: a.nickname ?? undefined,
    street: a.street,
    city: a.city,
    state: a.state,
    zip: a.zip,
    type: a.type,
    isPrimary: a.isPrimary,
    ownership: a.ownership,
    startDate: (a.startDate instanceof Date ? a.startDate : new Date(a.startDate)).toISOString(),
  }));

  return <ServicesClient initialServices={initialServices} initialAddresses={initialAddresses} />;
}
