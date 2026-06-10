import { requirePagePermission } from "@/lib/page-guard";
import { prisma } from "@/lib/db";
import { InsightsClient } from "./insights-client";
import {
  HEALTH_WINDOW_DAYS,
  FEEDBACK_WINDOW_DAYS,
  PROVIDER_USER_FLOOR,
  lastNDayKeys,
  buildSourceHealth,
  buildBriefingTrend,
  aggregateFeedback,
  buildAreaPreferences,
  type DailyStatRow,
} from "./insights-data";

// Read-only intelligence over the insights foundation tables: integration
// telemetry (IntegrationDailyStat), AI briefing outcomes, recommendation
// feedback, and aggregated area preferences. Server component queries prisma
// directly (same pattern as /affiliate and /plans); all aggregation math
// lives in insights-data.ts where it is unit-tested.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Insights — Admin",
  robots: { index: false, follow: false },
};

export default async function InsightsPage() {
  // Read-only module: VIEWER floor on the users resource — the panels
  // aggregate user-domain rows (services, addresses, feedback), mirroring
  // the analytics module's resource with the standard read-only floor.
  await requirePagePermission("users", "canRead", { minimumRole: "VIEWER" });

  const now = new Date();
  const dayKeys = lastNDayKeys(HEALTH_WINDOW_DAYS, now);
  const healthSince = new Date(`${dayKeys[0]}T00:00:00.000Z`);
  const feedbackSince = new Date(
    now.getTime() - FEEDBACK_WINDOW_DAYS * 86_400_000,
  );

  // Graceful degradation: each panel's query falls back to "no data" on
  // failure so one broken table never blanks the whole page.
  const [statRows, feedbackRows, serviceRows] = await Promise.all([
    prisma.integrationDailyStat
      .findMany({
        where: { day: { gte: healthSince } },
        select: { day: true, source: true, statusCounts: true },
        orderBy: { day: "asc" },
      })
      .catch((): DailyStatRow[] => []),
    prisma.recommendationFeedback
      .findMany({
        where: { createdAt: { gte: feedbackSince } },
        select: { action: true, provider: { select: { category: true } } },
      })
      .catch(
        (): Array<{ action: string; provider: { category: string } | null }> =>
          [],
      ),
    prisma.service
      .findMany({
        where: { isActive: true, deletedAt: null, providerId: { not: null } },
        select: {
          userId: true,
          providerId: true,
          providerName: true,
          category: true,
          address: { select: { state: true } },
        },
      })
      .catch(
        (): Array<{
          userId: string;
          providerId: string | null;
          providerName: string;
          category: string;
          address: { state: string };
        }> => [],
      ),
  ]);

  const health = buildSourceHealth(statRows, dayKeys);
  const briefing = buildBriefingTrend(statRows, dayKeys);

  const feedback = aggregateFeedback(
    feedbackRows.map((r) => ({
      action: r.action,
      category: r.provider?.category ?? null,
    })),
  );

  // NOTE on the omitted "services created from confirmed-at-address
  // providers" metric: Service rows carry no provenance field — there is no
  // source/createdVia column recording whether a service was created from a
  // dossier/recommendation surface (migrationAction/previousServiceId only
  // track move-over migration, and connector confirmations live on
  // ConnectorDispatch without a Service link). The count is not derivable
  // honestly today, so it is omitted rather than approximated.
  const area = buildAreaPreferences(
    serviceRows
      .filter(
        (r): r is typeof r & { providerId: string } => r.providerId !== null,
      )
      .map((r) => ({
        userId: r.userId,
        providerId: r.providerId,
        providerName: r.providerName,
        category: r.category,
        state: r.address.state,
      })),
  );

  return (
    <InsightsClient
      health={health}
      briefing={briefing}
      feedback={feedback}
      area={area}
      windows={{
        healthDays: HEALTH_WINDOW_DAYS,
        feedbackDays: FEEDBACK_WINDOW_DAYS,
        floor: PROVIDER_USER_FLOOR,
      }}
    />
  );
}
