import { describe, expect, it } from "vitest";
import {
  generateMonthlyBusinessReportPdf,
  type MonthlyBusinessReportData,
} from "./monthly-business-report";

const sampleData: MonthlyBusinessReportData = {
  monthLabel: "May 2026",
  kpis: {
    mrr: 64,
    newMrr: 16,
    churnedMrr: 8,
    netMrr: 8,
    churnPct: 2.4,
    activeSubscriptions: 8,
    newUsers: 5,
    priorMonthNewUsers: 3,
    totalUsers: 42,
    canceledSubscriptions: 1,
    supportTickets: 4,
  },
  mrrTrend: [
    { month: "2025-12", mrr: 32 },
    { month: "2026-01", mrr: 40 },
    { month: "2026-02", mrr: 48 },
    { month: "2026-03", mrr: 48 },
    { month: "2026-04", mrr: 56 },
    { month: "2026-05", mrr: 64 },
  ],
  userGrowth: [
    { month: "2025-12", newUsers: 2 },
    { month: "2026-01", newUsers: 4 },
    { month: "2026-02", newUsers: 3 },
    { month: "2026-03", newUsers: 6 },
    { month: "2026-04", newUsers: 3 },
    { month: "2026-05", newUsers: 5 },
  ],
  topCategories: [
    { category: "UTILITY_ELECTRIC", services: 12, monthlyCost: 1440 },
    { category: "INTERNET", services: 9, monthlyCost: 630 },
    { category: "STREAMING", services: 7, monthlyCost: 112 },
  ],
  integrationHealth: [
    { source: "fcc", total: 200, failures: 10 },
    { source: "nws", total: 42, failures: 0 },
  ],
};

describe("generateMonthlyBusinessReportPdf", () => {
  it("renders a multi-page PDF buffer", async () => {
    const buffer = await generateMonthlyBusinessReportPdf(sampleData);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
    // KPI page + growth/categories/integrations page → at least 2 pages.
    const pageCount = (buffer.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pageCount).toBeGreaterThanOrEqual(2);
  });

  it("degrades gracefully when optional sections are empty", async () => {
    const buffer = await generateMonthlyBusinessReportPdf({
      ...sampleData,
      mrrTrend: [],
      userGrowth: [],
      topCategories: [],
      integrationHealth: [],
    });

    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    // The empty-telemetry placeholder keeps the section present.
    expect(buffer.length).toBeGreaterThan(500);
  });
});
