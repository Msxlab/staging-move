import { getUserSession } from "@/lib/auth";
import { loadUserPreferences } from "@/lib/user-preferences";
import DashboardClient, { type DashboardWidgetPrefs } from "./dashboard-client";

export const dynamic = "force-dynamic";

async function loadWidgetPrefs(): Promise<DashboardWidgetPrefs | null> {
  const session = await getUserSession();
  if (!session) return null;

  const user = await loadUserPreferences(session.userId);

  const raw = user?.dashboardWidgetPrefs;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const prefs = raw as { order?: unknown; visibility?: unknown };

  const order = Array.isArray(prefs.order)
    ? (prefs.order.filter((k) => typeof k === "string") as string[])
    : undefined;
  const visibility =
    prefs.visibility && typeof prefs.visibility === "object" && !Array.isArray(prefs.visibility)
      ? Object.fromEntries(
          Object.entries(prefs.visibility as Record<string, unknown>).filter(
            ([, v]) => typeof v === "boolean"
          ) as Array<[string, boolean]>
        )
      : undefined;

  return { order, visibility };
}

export default async function DashboardPage() {
  const initialPrefs = await loadWidgetPrefs();
  return <DashboardClient initialPrefs={initialPrefs} />;
}
