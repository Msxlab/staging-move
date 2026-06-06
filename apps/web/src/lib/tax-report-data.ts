import { prisma } from "@/lib/db";
import { monthlyAmountForCycle } from "@/lib/budget-planning";

/**
 * Canonical builder for the Pro "Tax & Property" report — a per-property summary
 * suitable for tax prep (rental/home-office expenses, moving expenses). Shared by
 * the CSV/JSON data export and the PDF generator so the two can never drift on
 * the cost math (the `monthlyCost` field stores the RAW per-cycle amount, so it
 * is normalized to a true monthly figure before annualizing; ONE_TIME counts
 * once). Grouped strictly by address id so two properties sharing a nickname
 * can't double-count.
 */

export interface TaxLineItem {
  addressId: string | null;
  property: string;
  propertyType: string;
  ownership: string;
  occupancyStart: Date | null;
  occupancyEnd: Date | null;
  serviceProvider: string;
  serviceCategory: string;
  billingCycle: string;
  oneTime: boolean;
  active: boolean;
  cycleAmount: number;
  monthlyEquivalent: number;
  annualizedCost: number;
}

export interface TaxMove {
  moveDate: Date;
  status: string;
  direction: "MOVED_IN" | "MOVED_OUT";
  from: string | null;
  to: string | null;
}

export interface TaxPropertySummary {
  property: string;
  propertyType: string;
  ownership: string;
  isPrimary: boolean;
  occupancyStart: Date | null;
  occupancyEnd: Date | null;
  serviceCount: number;
  totalMonthlyEquivalent: number;
  totalAnnualizedCost: number;
  moves: TaxMove[];
}

export interface TaxReportData {
  tax: TaxLineItem[];
  taxByProperty: TaxPropertySummary[];
  taxTotals: {
    propertyCount: number;
    serviceCount: number;
    unassignedServiceCount: number;
    totalMonthlyEquivalent: number;
    totalAnnualizedCost: number;
  };
}

export async function buildTaxReportData(userId: string): Promise<TaxReportData> {
  const [addresses, services, movingPlans] = await Promise.all([
    prisma.address.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        nickname: true,
        type: true,
        street: true,
        street2: true,
        city: true,
        state: true,
        zip: true,
        ownership: true,
        isPrimary: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { isPrimary: "desc" },
    }),
    prisma.service.findMany({
      where: { userId, deletedAt: null },
      select: { addressId: true, providerName: true, category: true, monthlyCost: true, billingCycle: true, isActive: true },
    }),
    prisma.movingPlan.findMany({
      where: { userId, deletedAt: null },
      select: {
        moveDate: true,
        status: true,
        fromAddressId: true,
        toAddressId: true,
        fromAddress: { select: { city: true, state: true } },
        toAddress: { select: { city: true, state: true } },
      },
      orderBy: { moveDate: "desc" },
    }),
  ]);

  const toNum = (value: unknown): number => {
    const n = typeof value === "number" ? value : Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const round2 = (n: number): number => Math.round(n * 100) / 100;
  const propertyLabel = (a: (typeof addresses)[number] | undefined): string => {
    if (!a) return "Unassigned";
    return a.nickname?.trim() || [a.street, a.city, a.state].filter(Boolean).join(", ") || "Address";
  };
  const addressById = new Map(addresses.map((a) => [a.id, a]));

  const tax: TaxLineItem[] = services.map((svc) => {
    const addr = svc.addressId ? addressById.get(svc.addressId) : undefined;
    const cycleAmount = round2(toNum(svc.monthlyCost));
    const billingCycle = svc.billingCycle ?? "";
    const oneTime = billingCycle.trim().toUpperCase() === "ONE_TIME";
    const monthlyEquivalent = round2(monthlyAmountForCycle(cycleAmount, billingCycle));
    const annualizedCost = oneTime ? cycleAmount : round2(monthlyEquivalent * 12);
    return {
      addressId: svc.addressId ?? null,
      property: propertyLabel(addr),
      propertyType: addr?.type ?? "",
      ownership: addr?.ownership ?? "",
      occupancyStart: addr?.startDate ?? null,
      occupancyEnd: addr?.endDate ?? null,
      serviceProvider: svc.providerName ?? "",
      serviceCategory: svc.category ?? "",
      billingCycle,
      oneTime,
      active: svc.isActive,
      cycleAmount,
      monthlyEquivalent,
      annualizedCost,
    };
  });

  const taxByProperty: TaxPropertySummary[] = addresses.map((addr) => {
    const propertyServices = tax.filter((li) => li.addressId === addr.id);
    const moves: TaxMove[] = movingPlans
      .filter((m) => m.fromAddressId === addr.id || m.toAddressId === addr.id)
      .map((m) => ({
        moveDate: m.moveDate,
        status: m.status,
        direction: m.toAddressId === addr.id ? "MOVED_IN" : "MOVED_OUT",
        from: m.fromAddress ? [m.fromAddress.city, m.fromAddress.state].filter(Boolean).join(", ") : null,
        to: m.toAddress ? [m.toAddress.city, m.toAddress.state].filter(Boolean).join(", ") : null,
      }));
    return {
      property: propertyLabel(addr),
      propertyType: addr.type ?? "",
      ownership: addr.ownership ?? "",
      isPrimary: addr.isPrimary,
      occupancyStart: addr.startDate ?? null,
      occupancyEnd: addr.endDate ?? null,
      serviceCount: propertyServices.length,
      totalMonthlyEquivalent: round2(propertyServices.reduce((sum, li) => sum + li.monthlyEquivalent, 0)),
      totalAnnualizedCost: round2(propertyServices.reduce((sum, li) => sum + li.annualizedCost, 0)),
      moves,
    };
  });

  const unassignedServiceCount = tax.filter((li) => !li.addressId || !addressById.has(li.addressId)).length;

  return {
    tax,
    taxByProperty,
    taxTotals: {
      propertyCount: addresses.length,
      serviceCount: tax.length,
      unassignedServiceCount,
      totalMonthlyEquivalent: round2(tax.reduce((sum, li) => sum + li.monthlyEquivalent, 0)),
      totalAnnualizedCost: round2(tax.reduce((sum, li) => sum + li.annualizedCost, 0)),
    },
  };
}
